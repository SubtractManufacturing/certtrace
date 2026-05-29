use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Clone)]
struct LibraryWatchEvent {
    kind: String,
    paths: Vec<String>,
}

pub struct WatchState(pub Mutex<Option<RecommendedWatcher>>);

#[tauri::command]
pub fn start_library_watch(
    app: AppHandle,
    state: State<'_, WatchState>,
    root: String,
) -> Result<(), String> {
    let app_handle = app.clone();
    let mut watcher = RecommendedWatcher::new(
        move |result: Result<notify::Event, notify::Error>| {
            if let Ok(event) = result {
                let payload = LibraryWatchEvent {
                    kind: format!("{:?}", event.kind),
                    paths: event
                        .paths
                        .iter()
                        .map(|path| path.to_string_lossy().into_owned())
                        .collect(),
                };
                let _ = app_handle.emit("library-fs-changed", payload);
            }
        },
        Config::default(),
    )
    .map_err(|error| error.to_string())?;

    watcher
        .watch(Path::new(&root), RecursiveMode::Recursive)
        .map_err(|error| error.to_string())?;

    *state.0.lock().map_err(|error| error.to_string())? = Some(watcher);
    Ok(())
}

#[tauri::command]
pub fn stop_library_watch(state: State<'_, WatchState>) -> Result<(), String> {
    *state.0.lock().map_err(|error| error.to_string())? = None;
    Ok(())
}
