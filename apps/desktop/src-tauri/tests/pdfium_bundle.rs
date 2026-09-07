use std::fs;
use std::path::{Path, PathBuf};

#[path = "../build_support/pdfium.rs"]
mod pdfium;

#[test]
fn profile_dir_is_three_levels_above_out_dir() {
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
fn finds_pdfium_under_winprint_out_dir() {
    let tmp = tempfile::tempdir().unwrap();
    let dll_dir = tmp
        .path()
        .join("build")
        .join("winprint-abc123")
        .join("out")
        .join("pdfium_binaries_7802");
    fs::create_dir_all(&dll_dir).unwrap();
    let dll = dll_dir.join(pdfium::PDFIUM_DLL);
    fs::write(&dll, b"pdfium").unwrap();

    let other = tmp.path().join("build").join("other-crate").join("out");
    fs::create_dir_all(&other).unwrap();
    fs::write(other.join(pdfium::PDFIUM_DLL), b"nope").unwrap();

    assert_eq!(pdfium::find_winprint_pdfium_dll(tmp.path()), Some(dll));
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
fn ignores_pdfium_from_other_crates() {
    let tmp = tempfile::tempdir().unwrap();
    let other = tmp.path().join("build").join("not-winprint").join("out");
    fs::create_dir_all(&other).unwrap();
    fs::write(other.join(pdfium::PDFIUM_DLL), b"nope").unwrap();

    assert_eq!(pdfium::find_winprint_pdfium_dll(tmp.path()), None);
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
