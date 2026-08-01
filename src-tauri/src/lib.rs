mod midi;

use std::{
    collections::HashMap,
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State};

type Store = HashMap<String, String>;

#[derive(Default)]
struct StoreState {
    lock: Mutex<()>,
}

fn timestamp() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn store_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("store.json"))
        .map_err(|error| error.to_string())
}

fn corrupt_path(path: &Path) -> PathBuf {
    path.with_file_name(format!("store.corrupt-{}.json", timestamp()))
}

fn read_store(path: &Path) -> Result<Store, String> {
    match fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|error| error.to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(HashMap::new()),
        Err(error) => Err(error.to_string()),
    }
}

fn read_store_recovering(path: &Path) -> Result<Store, String> {
    match read_store(path) {
        Ok(store) => Ok(store),
        Err(parse_error) if path.exists() => {
            let quarantine = corrupt_path(path);
            fs::rename(path, &quarantine).map_err(|error| {
                format!("Could not quarantine corrupt data ({parse_error}): {error}")
            })?;
            Ok(HashMap::new())
        }
        Err(error) => Err(error),
    }
}

fn write_store(path: &Path, store: &Store) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "The data store path has no parent directory".to_owned())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("json.tmp");
    let data = serde_json::to_vec_pretty(store).map_err(|error| error.to_string())?;
    let mut file = File::create(&temporary).map_err(|error| error.to_string())?;
    file.write_all(&data).map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())?;
    if path.exists() {
        fs::copy(path, path.with_extension("json.bak")).map_err(|error| error.to_string())?;
    }
    fs::rename(&temporary, path).map_err(|error| error.to_string())
}

fn update_store(path: &Path, key: String, value: Option<String>) -> Result<(), String> {
    let mut store = read_store_recovering(path)?;
    if let Some(value) = value {
        store.insert(key, value);
    } else {
        store.remove(&key);
    }
    write_store(path, &store)
}

#[tauri::command]
fn store_get(
    app: AppHandle,
    state: State<'_, StoreState>,
    key: String,
) -> Result<Option<String>, String> {
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "The data store lock is unavailable".to_owned())?;
    let path = store_path(&app)?;
    Ok(read_store_recovering(&path)?.remove(&key))
}

#[tauri::command]
fn store_set(
    app: AppHandle,
    state: State<'_, StoreState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "The data store lock is unavailable".to_owned())?;
    update_store(&store_path(&app)?, key, Some(value))
}

#[tauri::command]
fn store_remove(app: AppHandle, state: State<'_, StoreState>, key: String) -> Result<(), String> {
    let _guard = state
        .lock
        .lock()
        .map_err(|_| "The data store lock is unavailable".to_owned())?;
    update_store(&store_path(&app)?, key, None)
}

fn safe_export_name(filename: &str) -> Result<&str, String> {
    Path::new(filename)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| {
            !name.is_empty()
                && *name != "."
                && *name != ".."
                && name.ends_with(".json")
                && !name.contains(['/', '\\'])
        })
        .ok_or_else(|| "Choose a valid .json export filename".to_owned())
}

fn collision_safe_path(directory: &Path, filename: &str) -> PathBuf {
    let requested = directory.join(filename);
    if !requested.exists() {
        return requested;
    }
    let stem = Path::new(filename)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("woodshed-export");
    for suffix in 1..=9999 {
        let candidate = directory.join(format!("{stem}-{suffix}.json"));
        if !candidate.exists() {
            return candidate;
        }
    }
    directory.join(format!("{stem}-{}.json", timestamp()))
}

#[tauri::command]
fn export_json(app: AppHandle, data: String, filename: String) -> Result<String, String> {
    let safe_name = safe_export_name(&filename)?;
    let downloads = app
        .path()
        .download_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&downloads).map_err(|error| error.to_string())?;
    let path = collision_safe_path(&downloads, safe_name);
    let mut file = File::create(&path).map_err(|error| error.to_string())?;
    file.write_all(data.as_bytes())
        .map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(StoreState::default())
        .invoke_handler(tauri::generate_handler![
            store_get,
            store_set,
            store_remove,
            export_json
        ])
        .setup(|app| {
            midi::start(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Woodshed");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{env, sync::Arc, thread};

    fn test_dir(name: &str) -> PathBuf {
        let path = env::temp_dir().join(format!(
            "woodshed-{name}-{}-{}",
            std::process::id(),
            timestamp()
        ));
        fs::create_dir_all(&path).expect("test directory");
        path
    }

    #[test]
    fn store_round_trip_remove_and_backup() {
        let directory = test_dir("store");
        let path = directory.join("store.json");
        update_store(&path, "progress".into(), Some("one".into())).unwrap();
        update_store(&path, "profile".into(), Some("two".into())).unwrap();
        assert_eq!(
            read_store(&path).unwrap().get("progress"),
            Some(&"one".to_owned())
        );
        assert!(path.with_extension("json.bak").exists());
        update_store(&path, "progress".into(), None).unwrap();
        assert!(!read_store(&path).unwrap().contains_key("progress"));
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn corrupt_store_is_quarantined_without_deleting_bytes() {
        let directory = test_dir("corrupt");
        let path = directory.join("store.json");
        fs::write(&path, b"{not-json").unwrap();
        assert!(read_store_recovering(&path).unwrap().is_empty());
        let quarantined: Vec<_> = fs::read_dir(&directory)
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with("store.corrupt-")
            })
            .collect();
        assert_eq!(quarantined.len(), 1);
        assert_eq!(fs::read(quarantined[0].path()).unwrap(), b"{not-json");
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn writes_are_safe_under_a_shared_lock() {
        let directory = test_dir("concurrent");
        let path = Arc::new(directory.join("store.json"));
        let lock = Arc::new(Mutex::new(()));
        let handles: Vec<_> = (0..12)
            .map(|index| {
                let path = Arc::clone(&path);
                let lock = Arc::clone(&lock);
                thread::spawn(move || {
                    let _guard = lock.lock().unwrap();
                    update_store(&path, format!("key-{index}"), Some(index.to_string())).unwrap();
                })
            })
            .collect();
        handles
            .into_iter()
            .for_each(|handle| handle.join().unwrap());
        assert_eq!(read_store(&path).unwrap().len(), 12);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn export_names_are_sanitized_and_collision_safe() {
        assert!(safe_export_name("../data.json").is_ok());
        assert!(safe_export_name("data.txt").is_err());
        assert!(safe_export_name("..").is_err());
        let directory = test_dir("export");
        fs::write(directory.join("woodshed-progress.json"), "{}").unwrap();
        assert_eq!(
            collision_safe_path(&directory, "woodshed-progress.json"),
            directory.join("woodshed-progress-1.json")
        );
        fs::remove_dir_all(directory).unwrap();
    }
}
