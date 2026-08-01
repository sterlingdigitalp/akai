use midir::{Ignore, MidiInput, MidiInputConnection};
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct MidiPort {
    id: String,
    name: String,
    index: usize,
}

#[derive(Clone, Serialize)]
struct MidiMessagePayload {
    bytes: Vec<u8>,
    port: String,
}

pub fn start(app: AppHandle) {
    thread::spawn(move || {
        let mut connections: HashMap<String, MidiInputConnection<()>> = HashMap::new();

        loop {
            let Some(ports) = available_ports() else {
                connections.clear();
                let _ = app.emit("midi-ports", Vec::<MidiPort>::new());
                thread::sleep(Duration::from_secs(2));
                continue;
            };

            let available: HashSet<&str> = ports.iter().map(|port| port.id.as_str()).collect();
            connections.retain(|id, _| available.contains(id.as_str()));

            for port in &ports {
                if connections.contains_key(&port.id) {
                    continue;
                }
                if let Some(connection) = connect_port(&app, port) {
                    connections.insert(port.id.clone(), connection);
                }
            }

            // Repeat the snapshot so a webview that started after setup never misses it.
            let _ = app.emit("midi-ports", ports);
            thread::sleep(Duration::from_secs(2));
        }
    });
}

fn port_descriptors(names: Vec<String>) -> Vec<MidiPort> {
    names
        .into_iter()
        .enumerate()
        .map(|(index, name)| MidiPort {
            id: format!("{index}:{name}"),
            name,
            index,
        })
        .collect()
}

fn available_ports() -> Option<Vec<MidiPort>> {
    let input = MidiInput::new("Woodshed MIDI discovery").ok()?;
    let names = input
        .ports()
        .iter()
        .map(|port| {
            input
                .port_name(port)
                .unwrap_or_else(|_| "Unnamed MIDI input".to_owned())
        })
        .collect();
    Some(port_descriptors(names))
}

fn connect_port(app: &AppHandle, target: &MidiPort) -> Option<MidiInputConnection<()>> {
    let mut input = MidiInput::new("Woodshed MIDI input").ok()?;
    input.ignore(Ignore::None);
    let port = input.ports().into_iter().nth(target.index)?;
    let app = app.clone();
    let port_id = target.id.clone();
    let connection_name = format!("Woodshed - {}", target.name);

    input
        .connect(
            &port,
            &connection_name,
            move |_timestamp, message, _| {
                let _ = app.emit(
                    "midi-message",
                    MidiMessagePayload {
                        bytes: message.to_vec(),
                        port: port_id.clone(),
                    },
                );
            },
            (),
        )
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duplicate_names_keep_distinct_stable_snapshot_ids() {
        let ports = port_descriptors(vec!["MPK mini".into(), "MPK mini".into(), "Other".into()]);
        assert_eq!(ports.len(), 3);
        assert_ne!(ports[0].id, ports[1].id);
        assert_eq!(ports[0].name, ports[1].name);
        assert_eq!(ports[1].index, 1);
    }
}
