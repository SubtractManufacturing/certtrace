fn main() {
    println!("cargo:rerun-if-changed=build_support/pdfium.rs");
    // Stage before tauri_build so Windows bundle.resources can see pdfium.dll.
    #[cfg(windows)]
    stage_windows_pdfium();
    tauri_build::build();
}

#[cfg(windows)]
fn stage_windows_pdfium() {
    #[path = "build_support/pdfium.rs"]
    mod pdfium;

    use std::env;
    use std::fs;
    use std::path::PathBuf;

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let staged = manifest_dir.join(pdfium::PDFIUM_DLL);
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR is set by Cargo"));
    if let Some(profile_dir) = pdfium::profile_dir_from_out_dir(&out_dir) {
        if let Some(dll) = pdfium::find_winprint_pdfium_dll(profile_dir) {
            pdfium::stage_pdfium_dll(&dll, &[staged, profile_dir.join(pdfium::PDFIUM_DLL)])
                .unwrap_or_else(|err| panic!("Could not stage {}: {err}", pdfium::PDFIUM_DLL));
            return;
        }
    }
    // Cargo may run this script before winprint has unpacked PDFium. A
    // placeholder keeps tauri_build happy; stage-pdfium.ps1 replaces it
    // after the Rust build, before the Windows installer is packed.
    if !staged.exists() {
        fs::write(&staged, []).unwrap_or_else(|err| {
            panic!("Could not write placeholder {}: {err}", pdfium::PDFIUM_DLL)
        });
    }
}
