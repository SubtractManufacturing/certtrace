use std::path::Path;
use std::process::Command;

use tauri_plugin_fs::FsExt;

#[cfg(target_os = "linux")]
fn file_uri(path: &Path) -> String {
    let mut uri = String::from("file://");
    for byte in path.to_string_lossy().bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'/' | b'-' | b'_' | b'.' | b'~') {
            uri.push(char::from(byte));
        } else {
            uri.push_str(&format!("%{byte:02X}"));
        }
    }
    uri
}

fn open_with_default_app(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if path.is_dir() {
            let status = Command::new("open")
                .arg(path)
                .status()
                .map_err(|err| format!("Failed to open folder: {err}"))?;

            if status.success() {
                return Ok(());
            }

            return Err("Could not open this folder.".to_string());
        }

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

        Err(if stderr.is_empty() {
            "Could not open this file.".to_string()
        } else {
            stderr
        })
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

        Err(format!(
            "Could not open file (exit code {:?})",
            status.code()
        ))
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

        Err(format!(
            "Could not open file (exit code {:?})",
            status.code()
        ))
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = path;
        Err("Opening files is not supported on this platform.".to_string())
    }
}

fn reveal_in_file_browser(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let status = Command::new("open")
        .arg("-R")
        .arg(path)
        .status()
        .map_err(|err| format!("Failed to reveal file in Finder: {err}"))?;

    #[cfg(target_os = "windows")]
    let status = Command::new("explorer")
        .arg(format!("/select,{}", path.display()))
        .status()
        .map_err(|err| format!("Failed to reveal file in Explorer: {err}"))?;

    #[cfg(target_os = "linux")]
    let status = {
        let reveal = Command::new("dbus-send")
            .args([
                "--session",
                "--dest=org.freedesktop.FileManager1",
                "--type=method_call",
                "/org/freedesktop/FileManager1",
                "org.freedesktop.FileManager1.ShowItems",
            ])
            .arg(format!("array:string:{}", file_uri(path)))
            .arg("string:")
            .status();

        match reveal {
            Ok(status) if status.success() => status,
            _ => Command::new("xdg-open")
                .arg(path.parent().unwrap_or(path))
                .status()
                .map_err(|err| format!("Failed to reveal file or open containing folder: {err}"))?,
        }
    };

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return Err("Revealing files is not supported on this platform.".to_string());

    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "Could not reveal file (exit code {:?})",
            status.code()
        ))
    }
}

fn allowed_canonical_path(
    app: &tauri::AppHandle,
    path: &Path,
) -> Result<std::path::PathBuf, String> {
    if !path.exists() {
        return Err(format!("Path not found: {}", path.display()));
    }

    let canonical = path
        .canonicalize()
        .map_err(|err| format!("File not found: {err}"))?;

    if !app.fs_scope().is_allowed(&canonical) {
        return Err("Access to this path is not allowed.".to_string());
    }

    Ok(canonical)
}

#[tauri::command]
pub fn open_local_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let canonical = allowed_canonical_path(&app, Path::new(&path))?;
    open_with_default_app(&canonical)
}

#[tauri::command]
pub fn reveal_local_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let canonical = allowed_canonical_path(&app, Path::new(&path))?;
    reveal_in_file_browser(&canonical)
}
