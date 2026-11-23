use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

pub const PDFIUM_DLL: &str = "pdfium.dll";

/// `OUT_DIR` is `target[/triple]/profile/build/<crate>/<hash>/out` since
/// rustc 1.100, and `target[/triple]/profile/build/<crate>-<hash>/out` before.
pub fn profile_dir_from_out_dir(out_dir: &Path) -> Option<&Path> {
    let is_build = |dir: &Path| dir.file_name().is_some_and(|name| name == "build");
    let mut dir = out_dir.parent()?.parent()?;
    if !is_build(dir) {
        dir = dir.parent()?;
    }
    if !is_build(dir) {
        return None;
    }
    dir.parent()
}

/// Locate the `pdfium.dll` that winprint downloaded into its build output.
/// Only winprint's own build dirs are searched, empty DLLs are skipped, and
/// the newest match wins.
pub fn find_winprint_pdfium_dll(profile_dir: &Path) -> Option<PathBuf> {
    let mut matches = Vec::new();
    for root in winprint_build_dirs(&profile_dir.join("build")) {
        find_named_files(&root, PDFIUM_DLL, &mut matches);
    }
    matches.retain(|dll| {
        fs::metadata(dll)
            .map(|meta| meta.len() > 0)
            .unwrap_or(false)
    });
    matches.sort_by_key(|path| {
        fs::metadata(path)
            .and_then(|meta| meta.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH)
    });
    matches.pop()
}

/// `build/winprint-<hash>` (old layout) and `build/winprint` (new layout).
fn winprint_build_dirs(build_dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(build_dir) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter(|entry| {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            (name == "winprint" || name.starts_with("winprint-")) && entry.path().is_dir()
        })
        .map(|entry| entry.path())
        .collect()
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

fn find_named_files(dir: &Path, file_name: &str, found: &mut Vec<PathBuf>) {
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
                found.push(path);
            }
        }
    }
}
