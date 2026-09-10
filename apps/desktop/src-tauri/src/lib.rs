mod library_archive;
mod open_local;
mod print;
mod watch;

use library_archive::ArchiveState;
use tauri::Manager;
use tauri_plugin_fs::FsExt;
use tauri_plugin_window_state::{StateFlags, WindowExt};
use watch::{start_library_watch, stop_library_watch, sync_library_watch, WatchState};

fn window_layout_flags() -> StateFlags {
    StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED | StateFlags::FULLSCREEN
}

fn restore_and_raise_main_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let _ = window.restore_state(window_layout_flags());
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();

    #[cfg(target_os = "macos")]
    activate_macos_app();
}

#[cfg(target_os = "macos")]
fn activate_macos_app() {
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSApplication;

    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    let app = NSApplication::sharedApplication(mtm);
    #[allow(deprecated)]
    app.activateIgnoringOtherApps(true);
}

#[tauri::command]
fn allow_library_directory(
    app: tauri::AppHandle,
    path: String,
    recursive: Option<bool>,
) -> Result<(), String> {
    app.fs_scope()
        .allow_directory(path, recursive.unwrap_or(true))
        .map_err(|err| err.to_string())
}

fn allow_app_directory(app: &tauri::AppHandle, path: Result<std::path::PathBuf, tauri::Error>) {
    if let Ok(path) = path {
        let _ = app.fs_scope().allow_directory(path, true);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(window_layout_flags())
                .skip_initial_state("main")
                .build(),
        )
        .manage(WatchState::new())
        .manage(ArchiveState::new())
        .setup(|app| {
            let handle = app.handle();
            allow_app_directory(handle, app.path().app_data_dir());
            allow_app_directory(handle, app.path().app_cache_dir());
            allow_app_directory(handle, app.path().app_config_dir());
            allow_app_directory(handle, app.path().app_log_dir());
            restore_and_raise_main_window(handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            allow_library_directory,
            open_local::open_local_path,
            open_local::reveal_local_path,
            print::list_printer_queues,
            print::print_pdf_file,
            library_archive::cancel_library_archive,
            library_archive::list_zip_entries,
            library_archive::read_zip_entry_text,
            library_archive::unzip_library_dir,
            library_archive::zip_library_dir,
            start_library_watch,
            stop_library_watch,
            sync_library_watch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
