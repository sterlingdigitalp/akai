mod midi;

use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Manager, State};

#[derive(Default)]
struct StoreState {
    lock: Mutex<()>,
}

fn store_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("store.json"))
        .map_err(|error| error.to_string())
}

fn read_store(path: &Path) -> Result<HashMap<String, String>, String> {
    match fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|error| error.to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(HashMap::new()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn store_get(app: AppHandle, state: State<'_, StoreState>, key: String) -> Option<String> {
    let _guard = state.lock.lock().ok()?;
    let path = store_path(&app).ok()?;
    read_store(&path).ok()?.remove(&key)
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
    let path = store_path(&app)?;
    let mut store = read_store(&path)?;
    store.insert(key, value);

    let parent = path
        .parent()
        .ok_or_else(|| "The data store path has no parent directory".to_owned())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("json.tmp");
    let data = serde_json::to_vec_pretty(&store).map_err(|error| error.to_string())?;
    fs::write(&temporary, data).map_err(|error| error.to_string())?;
    fs::rename(&temporary, &path).map_err(|error| error.to_string())
}

#[tauri::command]
fn export_json(app: AppHandle, data: String, filename: String) -> Result<String, String> {
    let safe_name = Path::new(&filename)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .ok_or_else(|| "Choose a valid export filename".to_owned())?;
    let downloads = app
        .path()
        .download_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&downloads).map_err(|error| error.to_string())?;
    let path = downloads.join(safe_name);
    fs::write(&path, data).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(StoreState::default())
        .invoke_handler(tauri::generate_handler![store_get, store_set, export_json])
        .setup(|app| {
            midi::start(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Woodshed");
}
