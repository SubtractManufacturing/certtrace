use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

pub const PDFIUM_DLL: &str = "pdfium.dll";

/// `OUT_DIR` is `target[/triple]/profile/build/<crate-hash>/out`.
pub fn profile_dir_from_out_dir(out_dir: &Path) -> Option<&Path> {
    out_dir.parent()?.parent()?.parent()
}

/// Locate the `pdfium.dll` that winprint downloaded into its build output.
pub fn find_winprint_pdfium_dll(profile_dir: &Path) -> Option<PathBuf> {
    let build_dir = profile_dir.join("build");
    let entries = fs::read_dir(build_dir).ok()?;
    let mut matches = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name();
        if !name.to_string_lossy().starts_with("winprint-") || !entry.path().is_dir() {
            continue;
        }
        if let Some(dll) = find_named_file(&entry.path(), PDFIUM_DLL) {
            if fs::metadata(&dll)
                .map(|meta| meta.len() > 0)
                .unwrap_or(false)
            {
                matches.push(dll);
            }
        }
    }
    matches.sort_by_key(|path| {
        fs::metadata(path)
            .and_then(|meta| meta.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH)
    });
    matches.pop()
}

pub fn stage_pdfium_dll(src: &Path, destinations: &[PathBuf]) -> io::Result<()> {
    for dest in destinations {
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(src, dest)?;
    }
    Ok(())
}

fn find_named_file(dir: &Path, file_name: &str) -> Option<PathBuf> {
    let mut stack = vec![dir.to_path_buf()];
    while let Some(current) = stack.pop() {
        let Ok(entries) = fs::read_dir(&current) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.file_name().is_some_and(|name| name == file_name) {
                return Some(path);
            }
        }
    }
    None
}
