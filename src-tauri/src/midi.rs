use midir::{Ignore, MidiInput, MidiInputConnection};
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
struct MidiMessagePayload {
    bytes: Vec<u8>,
    port: String,
}

pub fn start(app: AppHandle) {
    thread::spawn(move || {
        let mut connections: HashMap<String, MidiInputConnection<()>> = HashMap::new();

        loop {
            let Some(port_names) = available_port_names() else {
                thread::sleep(Duration::from_secs(2));
                continue;
            };

            let available: HashSet<&str> = port_names.iter().map(String::as_str).collect();
            connections.retain(|name, _| available.contains(name.as_str()));

            for name in &port_names {
                if connections.contains_key(name) {
                    continue;
                }
                if let Some(connection) = connect_port(&app, name) {
                    connections.insert(name.clone(), connection);
                }
            }

            // Repeat the snapshot so a webview that started after setup never misses it.
            let _ = app.emit("midi-ports", port_names);

            thread::sleep(Duration::from_secs(2));
        }
    });
}

fn available_port_names() -> Option<Vec<String>> {
    let input = MidiInput::new("Woodshed MIDI discovery").ok()?;
    let mut names: Vec<String> = input
        .ports()
        .iter()
        .filter_map(|port| input.port_name(port).ok())
        .collect();
    names.sort();
    names.dedup();
    Some(names)
}

fn connect_port(app: &AppHandle, target_name: &str) -> Option<MidiInputConnection<()>> {
    let mut input = MidiInput::new("Woodshed MIDI input").ok()?;
    input.ignore(Ignore::None);
    let port = input
        .ports()
        .into_iter()
        .find(|port| input.port_name(port).ok().as_deref() == Some(target_name))?;
    let app = app.clone();
    let port_name = target_name.to_owned();
    let connection_name = format!("Woodshed - {target_name}");

    input
        .connect(
            &port,
            &connection_name,
            move |_timestamp, message, _| {
                let _ = app.emit(
                    "midi-message",
                    MidiMessagePayload {
                        bytes: message.to_vec(),
                        port: port_name.clone(),
                    },
                );
            },
            (),
        )
        .ok()
}
