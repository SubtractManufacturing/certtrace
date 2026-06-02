use std::path::Path;
use std::process::Command;

use tauri_plugin_fs::FsExt;

fn open_with_default_app(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("open")
            .arg(path)
            .output()
            .map_err(|err| format!("Failed to open file: {err}"))?;

        if output.status.success() {
            return Ok(());
        }

        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let reveal = Command::new("open")
            .arg("-R")
            .arg(path)
            .status()
            .map_err(|err| format!("Failed to reveal file in Finder: {err}"))?;

        if reveal.success() {
            return Err(if stderr.is_empty() {
                "No default app for this file type. The file was shown in Finder.".to_string()
            } else {
                format!("{stderr} The file was shown in Finder.")
            });
        }

        return Err(if stderr.is_empty() {
            "Could not open this file.".to_string()
        } else {
            stderr
        });
    }

    #[cfg(target_os = "windows")]
    {
        let path_arg = path
            .to_str()
            .ok_or_else(|| "Path is not valid UTF-8".to_string())?;
        let status = Command::new("cmd")
            .args(["/C", "start", "", path_arg])
            .status()
            .map_err(|err| format!("Failed to open file: {err}"))?;

        if status.success() {
            return Ok(());
        }

        return Err(format!(
            "Could not open file (exit code {:?})",
            status.code()
        ));
    }

    #[cfg(target_os = "linux")]
    {
        let status = Command::new("xdg-open")
            .arg(path)
            .status()
            .map_err(|err| format!("Failed to open file: {err}"))?;

        if status.success() {
            return Ok(());
        }

        return Err(format!(
            "Could not open file (exit code {:?})",
            status.code()
        ));
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = path;
        Err("Opening files is not supported on this platform.".to_string())
    }
}

#[tauri::command]
pub fn open_local_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let path = Path::new(&path);

    if !app.fs_scope().is_allowed(path) {
        return Err("Access to this path is not allowed.".to_string());
    }

    let canonical = path
        .canonicalize()
        .map_err(|err| format!("File not found: {err}"))?;

    open_with_default_app(&canonical)
}
