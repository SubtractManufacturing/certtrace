use serde::Serialize;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

const BACKUP_CANCELLED: &str = "Library backup was cancelled.";
const RESTORE_CANCELLED: &str = "Library restore was cancelled.";
const INVALID_ZIP_PATH: &str = "Invalid path in ZIP archive.";
const TMP_SUFFIX: &str = ".certtrace-tmp";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LibraryArchiveProgress {
    current: u64,
    total: u64,
    relative_path: String,
}

pub struct ArchiveState {
    cancelled: Arc<AtomicBool>,
}

impl ArchiveState {
    pub fn new() -> Self {
        Self {
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    fn flag(&self) -> Arc<AtomicBool> {
        Arc::clone(&self.cancelled)
    }

    fn reset(&self) {
        self.cancelled.store(false, Ordering::SeqCst);
    }

    fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }
}

fn is_cancelled(flag: &AtomicBool) -> bool {
    flag.load(Ordering::SeqCst)
}

fn normalize_relative(path: &str) -> String {
    path.replace('\\', "/")
        .trim_start_matches("./")
        .trim_start_matches('/')
        .trim_end_matches('/')
        .to_string()
}

fn should_skip(relative: &str, skip_prefixes: &[String], skip_names: &[String]) -> bool {
    let normalized = normalize_relative(relative);
    if skip_prefixes
        .iter()
        .any(|prefix| normalized == *prefix || normalized.starts_with(&format!("{prefix}/")))
    {
        return true;
    }
    let base_name = normalized.rsplit('/').next().unwrap_or(&normalized);
    skip_names.iter().any(|name| name == base_name)
}

fn relative_to_root(root: &Path, path: &Path) -> Result<String, String> {
    let relative = path
        .strip_prefix(root)
        .map_err(|error| error.to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    Ok(normalize_relative(&relative))
}

fn collect_files(
    root: &Path,
    skip_prefixes: &[String],
    skip_names: &[String],
) -> Result<Vec<(PathBuf, String)>, String> {
    let mut files = Vec::new();
    let walker = WalkDir::new(root).into_iter().filter_entry(|entry| {
        if entry.path() == root {
            return true;
        }
        match relative_to_root(root, entry.path()) {
            Ok(relative) => !should_skip(&relative, skip_prefixes, skip_names),
            Err(_) => false,
        }
    });

    for entry in walker {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry.file_type().is_file() {
            continue;
        }
        let relative = relative_to_root(root, entry.path())?;
        if should_skip(&relative, skip_prefixes, skip_names) {
            continue;
        }
        files.push((entry.path().to_path_buf(), relative));
    }

    files.sort_by(|left, right| left.1.cmp(&right.1));
    Ok(files)
}

fn emit_progress(app: Option<&AppHandle>, current: u64, total: u64, relative_path: &str) {
    if let Some(app) = app {
        let _ = app.emit(
            "library-archive-progress",
            LibraryArchiveProgress {
                current,
                total,
                relative_path: relative_path.to_string(),
            },
        );
    }
}

fn tmp_path_for_dest(dest: &Path) -> PathBuf {
    let mut tmp = dest.as_os_str().to_os_string();
    tmp.push(TMP_SUFFIX);
    PathBuf::from(tmp)
}

fn remove_file_if_exists(path: &Path) {
    let _ = fs::remove_file(path);
}

fn remove_dir_if_exists(path: &Path) {
    let _ = fs::remove_dir_all(path);
}

pub fn zip_library_dir_sync(
    root: &Path,
    dest: &Path,
    skip_prefixes: &[String],
    skip_names: &[String],
    cancelled: &AtomicBool,
    app: Option<&AppHandle>,
) -> Result<(), String> {
    emit_progress(app, 0, 0, "");
    if is_cancelled(cancelled) {
        return Err(BACKUP_CANCELLED.to_string());
    }

    let files = collect_files(root, skip_prefixes, skip_names)?;
    if is_cancelled(cancelled) {
        return Err(BACKUP_CANCELLED.to_string());
    }

    let tmp = tmp_path_for_dest(dest);
    remove_file_if_exists(&tmp);

    let write_result = (|| {
        let file = File::create(&tmp).map_err(|error| error.to_string())?;
        let mut zip = ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        let total = files.len() as u64;

        for (index, (path, relative)) in files.iter().enumerate() {
            if is_cancelled(cancelled) {
                return Err(BACKUP_CANCELLED.to_string());
            }
            zip.start_file(relative, options)
                .map_err(|error| error.to_string())?;
            let mut source = File::open(path).map_err(|error| error.to_string())?;
            std::io::copy(&mut source, &mut zip).map_err(|error| error.to_string())?;
            emit_progress(app, index as u64 + 1, total, relative);
        }

        zip.finish().map_err(|error| error.to_string())?;
        Ok(())
    })();

    if let Err(error) = write_result {
        remove_file_if_exists(&tmp);
        return Err(error);
    }

    if dest.exists() {
        remove_file_if_exists(dest);
    }
    fs::rename(&tmp, dest).map_err(|error| {
        remove_file_if_exists(&tmp);
        error.to_string()
    })?;
    Ok(())
}

fn append_safe(dest: &Path, relative: &str) -> Result<PathBuf, String> {
    let mut out = dest.to_path_buf();
    for part in normalize_relative(relative).split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            return Err(INVALID_ZIP_PATH.to_string());
        }
        out.push(part);
    }
    Ok(out)
}

fn strip_entry_prefix(name: &str, strip_prefix: &str) -> Option<String> {
    let normalized = normalize_relative(name);
    if strip_prefix.is_empty() {
        return Some(normalized);
    }
    let prefix = normalize_relative(strip_prefix);
    if normalized == prefix {
        return None;
    }
    normalized
        .strip_prefix(&format!("{prefix}/"))
        .map(ToString::to_string)
}

pub fn unzip_library_dir_sync(
    zip_path: &Path,
    dest: &Path,
    strip_prefix: &str,
    cancelled: &AtomicBool,
    app: Option<&AppHandle>,
) -> Result<(), String> {
    emit_progress(app, 0, 0, "");

    let file = File::open(zip_path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|error| error.to_string())?;
    fs::create_dir_all(dest).map_err(|error| error.to_string())?;

    if is_cancelled(cancelled) {
        remove_dir_if_exists(dest);
        return Err(RESTORE_CANCELLED.to_string());
    }

    let extract_result = (|| {
        let mut total = 0_u64;
        for index in 0..archive.len() {
            let entry = archive.by_index(index).map_err(|error| error.to_string())?;
            if entry.is_file() {
                total += 1;
            }
        }
        let mut current = 0_u64;

        for index in 0..archive.len() {
            if is_cancelled(cancelled) {
                return Err(RESTORE_CANCELLED.to_string());
            }
            let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
            if !entry.is_file() {
                continue;
            }
            let Some(relative) = strip_entry_prefix(entry.name(), strip_prefix) else {
                continue;
            };
            if relative.is_empty() {
                continue;
            }
            let out_path = append_safe(dest, &relative)?;
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            let mut out = File::create(&out_path).map_err(|error| error.to_string())?;
            std::io::copy(&mut entry, &mut out).map_err(|error| error.to_string())?;
            current += 1;
            emit_progress(app, current, total, &relative);
        }
        Ok(())
    })();

    if let Err(error) = extract_result {
        remove_dir_if_exists(dest);
        return Err(error);
    }
    Ok(())
}

pub fn list_zip_file_entries(zip_path: &Path) -> Result<Vec<String>, String> {
    let file = File::open(zip_path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|error| error.to_string())?;
    let mut names = Vec::new();
    for index in 0..archive.len() {
        let entry = archive.by_index(index).map_err(|error| error.to_string())?;
        if entry.is_file() {
            names.push(normalize_relative(entry.name()));
        }
    }
    Ok(names)
}

pub fn read_zip_file_entry_text(zip_path: &Path, entry_name: &str) -> Result<String, String> {
    let file = File::open(zip_path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|error| error.to_string())?;
    let mut entry = archive
        .by_name(&normalize_relative(entry_name))
        .map_err(|error| error.to_string())?;
    let mut raw = String::new();
    entry
        .read_to_string(&mut raw)
        .map_err(|error| error.to_string())?;
    Ok(raw)
}

#[tauri::command]
pub fn list_zip_entries(zip_path: String) -> Result<Vec<String>, String> {
    list_zip_file_entries(Path::new(&zip_path))
}

#[tauri::command]
pub fn read_zip_entry_text(zip_path: String, entry: String) -> Result<String, String> {
    read_zip_file_entry_text(Path::new(&zip_path), &entry)
}

#[tauri::command]
pub async fn zip_library_dir(
    app: AppHandle,
    state: State<'_, ArchiveState>,
    root: String,
    dest: String,
    skip_prefixes: Vec<String>,
    skip_names: Vec<String>,
) -> Result<(), String> {
    state.reset();
    let cancelled = state.flag();
    tauri::async_runtime::spawn_blocking(move || {
        zip_library_dir_sync(
            Path::new(&root),
            Path::new(&dest),
            &skip_prefixes,
            &skip_names,
            cancelled.as_ref(),
            Some(&app),
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn unzip_library_dir(
    app: AppHandle,
    state: State<'_, ArchiveState>,
    zip_path: String,
    dest: String,
    strip_prefix: String,
) -> Result<(), String> {
    state.reset();
    let cancelled = state.flag();
    tauri::async_runtime::spawn_blocking(move || {
        unzip_library_dir_sync(
            Path::new(&zip_path),
            Path::new(&dest),
            &strip_prefix,
            cancelled.as_ref(),
            Some(&app),
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn cancel_library_archive(state: State<'_, ArchiveState>) -> Result<(), String> {
    state.cancel();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn skip_prefixes() -> Vec<String> {
        vec![".certtrace/backups".to_string()]
    }

    fn skip_names() -> Vec<String> {
        vec![".DS_Store".to_string(), "Thumbs.db".to_string()]
    }

    fn write_file(path: &Path, contents: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, contents).unwrap();
    }

    fn create_sample_library(root: &Path) {
        write_file(
            &root.join(".certtrace/library.json"),
            r#"{"name":"Main Shop"}"#,
        );
        write_file(&root.join(".certtrace/naming-rules.json"), "{}");
        write_file(&root.join(".certtrace/word-lists.json"), "{}");
        write_file(&root.join(".certtrace/field-schema.json"), "{}");
        write_file(&root.join(".certtrace/backups/old/library.json"), "skip-me");
        write_file(&root.join(".DS_Store"), "junk");
        write_file(&root.join("materials/.DS_Store"), "junk");
        write_file(&root.join("README.md"), "library readme");
        write_file(&root.join("materials/AL-1/cert.pdf"), "pdf-bytes");
    }

    #[test]
    fn zip_skips_backup_prefix_and_junk_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("shop");
        create_sample_library(&root);
        let dest = dir.path().join("shop backup.zip");
        let cancelled = AtomicBool::new(false);

        zip_library_dir_sync(
            &root,
            &dest,
            &skip_prefixes(),
            &skip_names(),
            &cancelled,
            None,
        )
        .unwrap();

        let entries = list_zip_file_entries(&dest).unwrap();
        assert!(entries.contains(&".certtrace/library.json".to_string()));
        assert!(entries.contains(&"README.md".to_string()));
        assert!(entries.contains(&"materials/AL-1/cert.pdf".to_string()));
        assert!(!entries.iter().any(|entry| entry.contains("backups")));
        assert!(!entries.iter().any(|entry| entry.ends_with(".DS_Store")));
    }

    #[test]
    fn zip_round_trip_preserves_shop_records() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("shop");
        create_sample_library(&root);
        let dest = dir.path().join("shop backup.zip");
        let restored = dir.path().join("restored");
        let cancelled = AtomicBool::new(false);

        zip_library_dir_sync(
            &root,
            &dest,
            &skip_prefixes(),
            &skip_names(),
            &cancelled,
            None,
        )
        .unwrap();
        unzip_library_dir_sync(&dest, &restored, "", &cancelled, None).unwrap();

        assert_eq!(
            fs::read_to_string(restored.join(".certtrace/library.json")).unwrap(),
            r#"{"name":"Main Shop"}"#
        );
        assert_eq!(
            fs::read_to_string(restored.join("materials/AL-1/cert.pdf")).unwrap(),
            "pdf-bytes"
        );
        assert!(!restored
            .join(".certtrace/backups/old/library.json")
            .exists());
    }

    #[test]
    fn unzip_strips_a_single_wrapping_folder() {
        let dir = tempfile::tempdir().unwrap();
        let zip_path = dir.path().join("explorer.zip");
        {
            let file = File::create(&zip_path).unwrap();
            let mut zip = ZipWriter::new(file);
            let options =
                SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
            zip.start_file("Shop Materials/.certtrace/library.json", options)
                .unwrap();
            zip.write_all(br#"{"name":"Shop Materials"}"#).unwrap();
            zip.finish().unwrap();
        }

        let restored = dir.path().join("out");
        unzip_library_dir_sync(
            &zip_path,
            &restored,
            "Shop Materials",
            &AtomicBool::new(false),
            None,
        )
        .unwrap();

        assert_eq!(
            fs::read_to_string(restored.join(".certtrace/library.json")).unwrap(),
            r#"{"name":"Shop Materials"}"#
        );
    }

    #[test]
    fn unzip_rejects_zip_slip_and_removes_dest() {
        let dir = tempfile::tempdir().unwrap();
        let zip_path = dir.path().join("evil.zip");
        {
            let file = File::create(&zip_path).unwrap();
            let mut zip = ZipWriter::new(file);
            let options =
                SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
            zip.start_file("../evil.txt", options).unwrap();
            zip.write_all(b"pwned").unwrap();
            zip.finish().unwrap();
        }

        let dest = dir.path().join("dest");
        let error = unzip_library_dir_sync(&zip_path, &dest, "", &AtomicBool::new(false), None)
            .unwrap_err();

        assert_eq!(error, INVALID_ZIP_PATH);
        assert!(!dest.exists());
        assert!(!dir.path().join("evil.txt").exists());
    }

    #[test]
    fn backup_cancel_deletes_tmp_and_leaves_no_dest() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("shop");
        create_sample_library(&root);
        let dest = dir.path().join("shop backup.zip");
        let cancelled = AtomicBool::new(true);

        let error = zip_library_dir_sync(
            &root,
            &dest,
            &skip_prefixes(),
            &skip_names(),
            &cancelled,
            None,
        )
        .unwrap_err();

        assert_eq!(error, BACKUP_CANCELLED);
        assert!(!dest.exists());
        assert!(!tmp_path_for_dest(&dest).exists());
    }

    #[test]
    fn restore_cancel_removes_destination_folder() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("shop");
        create_sample_library(&root);
        let zip_path = dir.path().join("shop backup.zip");
        zip_library_dir_sync(
            &root,
            &zip_path,
            &skip_prefixes(),
            &skip_names(),
            &AtomicBool::new(false),
            None,
        )
        .unwrap();

        let dest = dir.path().join("copy");
        let error =
            unzip_library_dir_sync(&zip_path, &dest, "", &AtomicBool::new(true), None).unwrap_err();

        assert_eq!(error, RESTORE_CANCELLED);
        assert!(!dest.exists());
    }

    #[test]
    fn zip_does_not_replace_existing_dest_until_tmp_succeeds() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("shop backup.zip");
        fs::write(&dest, "previous-backup").unwrap();
        let cancelled = AtomicBool::new(true);

        zip_library_dir_sync(
            dir.path(),
            &dest,
            &skip_prefixes(),
            &skip_names(),
            &cancelled,
            None,
        )
        .unwrap_err();

        assert_eq!(fs::read_to_string(&dest).unwrap(), "previous-backup");
        assert!(!tmp_path_for_dest(&dest).exists());
    }

    #[test]
    fn read_zip_entry_text_returns_utf8_contents() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("shop");
        create_sample_library(&root);
        let dest = dir.path().join("shop backup.zip");
        zip_library_dir_sync(
            &root,
            &dest,
            &skip_prefixes(),
            &skip_names(),
            &AtomicBool::new(false),
            None,
        )
        .unwrap();

        assert_eq!(
            read_zip_file_entry_text(&dest, ".certtrace/library.json").unwrap(),
            r#"{"name":"Main Shop"}"#
        );
    }
}
