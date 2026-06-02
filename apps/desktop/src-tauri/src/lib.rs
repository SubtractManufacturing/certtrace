mod open_local;
mod print;
mod watch;

use tauri_plugin_fs::FsExt;
use watch::{start_library_watch, stop_library_watch, sync_library_watch, WatchState};

#[tauri::command]
fn allow_library_directory(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.fs_scope()
        .allow_directory(path, true)
        .map_err(|err| err.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(WatchState::new())
        .invoke_handler(tauri::generate_handler![
            allow_library_directory,
            open_local::open_local_path,
            print::print_pdf_file,
            start_library_watch,
            stop_library_watch,
            sync_library_watch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
