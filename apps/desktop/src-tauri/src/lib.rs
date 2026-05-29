mod watch;

use watch::{start_library_watch, stop_library_watch, sync_library_watch, WatchState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(WatchState::new())
        .invoke_handler(tauri::generate_handler![
            start_library_watch,
            stop_library_watch,
            sync_library_watch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
