use std::fs;
use std::path::{Path, PathBuf};

#[path = "../build_support/pdfium.rs"]
mod pdfium;

/// Cargo's build dir layout before rustc 1.100: `build/<crate>-<hash>/out`.
fn old_layout(build: &Path, krate: &str) -> PathBuf {
    build.join(format!("{krate}-abc123")).join("out")
}

/// Cargo's build dir layout since rustc 1.100: `build/<crate>/<hash>/out`.
fn new_layout(build: &Path, krate: &str) -> PathBuf {
    build.join(krate).join("abc123").join("out")
}

type Layout = fn(&Path, &str) -> PathBuf;

const LAYOUTS: [(&str, Layout); 2] = [("old", old_layout), ("new", new_layout)];

fn write_dll(dir: &Path, bytes: &[u8]) -> PathBuf {
    fs::create_dir_all(dir).unwrap();
    let dll = dir.join(pdfium::PDFIUM_DLL);
    fs::write(&dll, bytes).unwrap();
    dll
}

#[test]
fn profile_dir_from_old_layout_out_dir() {
    let host = PathBuf::from("target/release/build/certtrace-desktop-hash/out");
    assert_eq!(
        pdfium::profile_dir_from_out_dir(&host),
        Some(Path::new("target/release"))
    );

    let triple = PathBuf::from("target/x86_64-pc-windows-msvc/release/build/pkg-hash/out");
    assert_eq!(
        pdfium::profile_dir_from_out_dir(&triple),
        Some(Path::new("target/x86_64-pc-windows-msvc/release"))
    );
}

#[test]
fn profile_dir_from_new_layout_out_dir() {
    let host = PathBuf::from("target/release/build/certtrace-desktop/hash/out");
    assert_eq!(
        pdfium::profile_dir_from_out_dir(&host),
        Some(Path::new("target/release"))
    );

    let triple = PathBuf::from("target/x86_64-pc-windows-msvc/release/build/pkg/hash/out");
    assert_eq!(
        pdfium::profile_dir_from_out_dir(&triple),
        Some(Path::new("target/x86_64-pc-windows-msvc/release"))
    );
}

#[test]
fn profile_dir_rejects_unknown_layout() {
    let out = PathBuf::from("target/release/elsewhere/pkg/hash/out");
    assert_eq!(pdfium::profile_dir_from_out_dir(&out), None);
}

#[test]
fn finds_pdfium_under_winprint_out_dir() {
    for (name, layout) in LAYOUTS {
        let tmp = tempfile::tempdir().unwrap();
        let build = tmp.path().join("build");
        let dll = write_dll(
            &layout(&build, "winprint").join("pdfium_binaries_7802"),
            b"pdfium",
        );
        write_dll(&layout(&build, "other-crate"), b"nope");

        assert_eq!(
            pdfium::find_winprint_pdfium_dll(tmp.path()),
            Some(dll),
            "{name} layout"
        );
    }
}

#[test]
fn newest_winprint_pdfium_wins_across_layouts() {
    let tmp = tempfile::tempdir().unwrap();
    let build = tmp.path().join("build");
    let older = write_dll(&old_layout(&build, "winprint"), b"old");
    let newer = write_dll(&new_layout(&build, "winprint"), b"new");
    let past = std::time::SystemTime::now() - std::time::Duration::from_secs(3600);
    fs::File::options()
        .write(true)
        .open(&older)
        .unwrap()
        .set_modified(past)
        .unwrap();

    assert_eq!(pdfium::find_winprint_pdfium_dll(tmp.path()), Some(newer));
}

#[test]
fn newest_of_several_new_layout_hashes_wins() {
    let tmp = tempfile::tempdir().unwrap();
    let winprint = tmp.path().join("build").join("winprint");
    let older = write_dll(&winprint.join("aaa").join("out"), b"old");
    let newer = write_dll(&winprint.join("bbb").join("out"), b"new");
    let past = std::time::SystemTime::now() - std::time::Duration::from_secs(3600);
    fs::File::options()
        .write(true)
        .open(&older)
        .unwrap()
        .set_modified(past)
        .unwrap();

    assert_eq!(pdfium::find_winprint_pdfium_dll(tmp.path()), Some(newer));
}

#[test]
fn copies_pdfium_to_each_destination() {
    let tmp = tempfile::tempdir().unwrap();
    let src = tmp.path().join("src.dll");
    fs::write(&src, b"pdfium-bytes").unwrap();
    let dest_a = tmp.path().join("a").join(pdfium::PDFIUM_DLL);
    let dest_b = tmp.path().join("b").join(pdfium::PDFIUM_DLL);

    pdfium::stage_pdfium_dll(&src, &[dest_a.clone(), dest_b.clone()]).unwrap();

    assert_eq!(fs::read(dest_a).unwrap(), b"pdfium-bytes");
    assert_eq!(fs::read(dest_b).unwrap(), b"pdfium-bytes");
}

#[test]
fn ignores_empty_winprint_pdfium_dll() {
    for (name, layout) in LAYOUTS {
        let tmp = tempfile::tempdir().unwrap();
        write_dll(&layout(&tmp.path().join("build"), "winprint"), b"");

        assert_eq!(
            pdfium::find_winprint_pdfium_dll(tmp.path()),
            None,
            "{name} layout"
        );
    }
}

#[test]
fn empty_new_layout_dll_does_not_hide_a_real_one() {
    let tmp = tempfile::tempdir().unwrap();
    let winprint = tmp.path().join("build").join("winprint");
    let real = write_dll(&winprint.join("aaa").join("out"), b"pdfium");
    write_dll(&winprint.join("bbb").join("out"), b"");

    assert_eq!(pdfium::find_winprint_pdfium_dll(tmp.path()), Some(real));
}

#[test]
fn ignores_pdfium_from_other_crates() {
    for (name, layout) in LAYOUTS {
        let tmp = tempfile::tempdir().unwrap();
        let build = tmp.path().join("build");
        write_dll(&layout(&build, "not-winprint"), b"nope");
        write_dll(&layout(&build, "winprintx"), b"nope");

        assert_eq!(
            pdfium::find_winprint_pdfium_dll(tmp.path()),
            None,
            "{name} layout"
        );
    }
}

/// Runs the real `stage-pdfium.ps1` against a fake Cargo target dir.
#[cfg(windows)]
fn run_stage_script(search_root: &Path, destination: &Path) -> std::process::Output {
    let script = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("scripts")
        .join("stage-pdfium.ps1");
    std::process::Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"])
        .arg(script)
        .arg("-SearchRoot")
        .arg(search_root)
        .arg("-Destination")
        .arg(destination)
        .output()
        .expect("run powershell")
}

#[cfg(windows)]
#[test]
fn stage_script_finds_pdfium_in_both_layouts() {
    for (name, layout) in LAYOUTS {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("target");
        let build = target.join("release").join("build");
        write_dll(
            &layout(&build, "winprint").join("pdfium_binaries_7802"),
            b"pdfium",
        );
        write_dll(&layout(&build, "other-crate"), b"nope");
        write_dll(&layout(&build, "winprintx"), b"nope");
        let staged = tmp.path().join("staged").join(pdfium::PDFIUM_DLL);
        fs::create_dir_all(staged.parent().unwrap()).unwrap();

        let out = run_stage_script(&target, &staged);
        assert!(
            out.status.success(),
            "{name} layout: {}",
            String::from_utf8_lossy(&out.stderr)
        );
        assert_eq!(fs::read(&staged).unwrap(), b"pdfium", "{name} layout");
    }
}

#[cfg(windows)]
#[test]
fn stage_script_skips_empty_and_foreign_dlls() {
    for (name, layout) in LAYOUTS {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("target");
        let build = target.join("release").join("build");
        write_dll(&layout(&build, "winprint"), b"");
        write_dll(&layout(&build, "other-crate"), b"nope");
        let staged = tmp.path().join(pdfium::PDFIUM_DLL);

        let out = run_stage_script(&target, &staged);
        assert!(!out.status.success(), "{name} layout should fail");
        assert!(!staged.exists(), "{name} layout must not stage anything");
    }
}

#[test]
fn windows_bundle_places_pdfium_beside_the_exe() {
    let conf = include_str!("../tauri.windows.conf.json");
    let value: serde_json::Value = serde_json::from_str(conf).unwrap();
    assert_eq!(value["bundle"]["resources"]["pdfium.dll"], "pdfium.dll");
    assert!(
        value["build"]["beforeBundleCommand"]
            .as_str()
            .is_some_and(|cmd| cmd.contains("stage-pdfium.ps1")),
        "Windows bundle must restage pdfium.dll after cargo build"
    );
}
