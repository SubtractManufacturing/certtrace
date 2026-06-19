use std::path::Path;
use std::process::Command;

#[cfg(target_os = "macos")]
fn escape_applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(target_os = "macos")]
fn print_pdf_macos(path: &Path) -> Result<(), String> {
    let posix_path = escape_applescript_string(&path.to_string_lossy());

    let script = format!(
        r#"tell application "Preview"
    activate
    open POSIX file "{posix_path}"
    delay 0.8
    try
        print document 1
    on error
        tell application "System Events"
            tell process "Preview"
                keystroke "p" using command down
            end tell
        end tell
    end try
end tell"#
    );

    let status = Command::new("osascript")
        .args(["-e", &script])
        .status()
        .map_err(|err| err.to_string())?;

    if status.success() {
        return Ok(());
    }

    Err(
        "Could not open the print dialog. In System Settings → Privacy & Security → Accessibility, allow CertTrace, then try again.".to_string(),
    )
}

#[cfg(target_os = "windows")]
fn print_pdf_windows(path: &Path) -> Result<(), String> {
    let path_str = path.to_string_lossy();
    let escaped = path_str.replace('\'', "''");
    let command = format!("Start-Process -FilePath '{escaped}' -Verb Print");

    let status = Command::new("powershell")
        .args(["-NoProfile", "-Command", &command])
        .status()
        .map_err(|err| err.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err("Failed to send the label PDF to the printer.".to_string())
    }
}

#[cfg(target_os = "linux")]
fn print_pdf_linux(path: &Path) -> Result<(), String> {
    let path_str = path.to_str().ok_or("Invalid PDF path")?;

    if Command::new("which")
        .arg("evince")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
    {
        Command::new("evince")
            .args(["--print-dialog", path_str])
            .spawn()
            .map_err(|err| err.to_string())?;
        return Ok(());
    }

    let status = Command::new("lp")
        .arg(path_str)
        .status()
        .map_err(|err| err.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err("Failed to print the label PDF. Install evince or CUPS lp.".to_string())
    }
}

#[tauri::command]
pub fn print_pdf_file(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err(format!("PDF not found: {path}"));
    }

    #[cfg(target_os = "macos")]
    return print_pdf_macos(file_path);

    #[cfg(target_os = "windows")]
    return print_pdf_windows(file_path);

    #[cfg(target_os = "linux")]
    return print_pdf_linux(file_path);

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    Err("Printing is not supported on this platform.".to_string())
}
