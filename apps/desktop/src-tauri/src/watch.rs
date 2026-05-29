use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashSet;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Clone)]
struct LibraryWatchEvent {
    kind: String,
    root: String,
    paths: Vec<String>,
}

pub struct WatchState {
    pub roots: Mutex<HashSet<String>>,
    pub watcher: Mutex<Option<RecommendedWatcher>>,
}

impl WatchState {
    pub fn new() -> Self {
        Self {
            roots: Mutex::new(HashSet::new()),
            watcher: Mutex::new(None),
        }
    }
}

fn matching_root(roots: &HashSet<String>, changed: &Path) -> String {
    let changed = changed.to_string_lossy();
    let mut best: Option<(usize, String)> = None;

    for root in roots {
        if changed.starts_with(root.as_str()) {
            let len = root.len();
            if best.as_ref().is_none_or(|(current, _)| len > *current) {
                best = Some((len, root.clone()));
            }
        }
    }

    best.map(|(_, root)| root)
        .unwrap_or_else(|| changed.to_string())
}

fn rebuild_watcher(app: AppHandle, state: &State<'_, WatchState>) -> Result<(), String> {
    let roots = state.roots.lock().map_err(|error| error.to_string())?.clone();

    let app_handle = app.clone();
    let watched_roots = roots.clone();
    let mut watcher = RecommendedWatcher::new(
        move |result: Result<notify::Event, notify::Error>| match result {
            Ok(event) => {
                let changed_paths: Vec<String> = event
                    .paths
                    .iter()
                    .map(|path| path.to_string_lossy().into_owned())
                    .collect();

                let root = event
                    .paths
                    .first()
                    .map(|path| matching_root(&watched_roots, path))
                    .unwrap_or_else(|| "unknown".to_string());

                let payload = LibraryWatchEvent {
                    kind: format!("{:?}", event.kind),
                    root,
                    paths: changed_paths,
                };
                let _ = app_handle.emit("library-fs-changed", payload);
            }
            Err(error) => {
                let _ = app_handle.emit("library-fs-watch-error", error.to_string());
            }
        },
        Config::default(),
    )
    .map_err(|error| error.to_string())?;

    for root in roots {
        watcher
            .watch(Path::new(&root), RecursiveMode::Recursive)
            .map_err(|error| error.to_string())?;
    }

    *state.watcher.lock().map_err(|error| error.to_string())? = Some(watcher);
    Ok(())
}

#[tauri::command]
pub fn sync_library_watch(
    app: AppHandle,
    state: State<'_, WatchState>,
    roots: Vec<String>,
) -> Result<(), String> {
    {
        let mut stored = state.roots.lock().map_err(|error| error.to_string())?;
        stored.clear();
        for root in roots {
            if !root.is_empty() {
                stored.insert(root);
            }
        }
    }

    rebuild_watcher(app, &state)
}

#[tauri::command]
pub fn start_library_watch(
    app: AppHandle,
    state: State<'_, WatchState>,
    root: String,
) -> Result<(), String> {
    sync_library_watch(app, state, vec![root])
}

#[tauri::command]
pub fn stop_library_watch(state: State<'_, WatchState>) -> Result<(), String> {
    state
        .roots
        .lock()
        .map_err(|error| error.to_string())?
        .clear();
    *state.watcher.lock().map_err(|error| error.to_string())? = None;
    Ok(())
}
