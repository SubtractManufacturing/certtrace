fn main() {
    println!("cargo:rerun-if-changed=build_support/pdfium.rs");
    // Stage before tauri_build so Windows bundle.resources can see pdfium.dll.
    #[cfg(windows)]
    stage_windows_pdfium();
    build_tauri();
}

/// The Common Controls v6 dependency Tauri's dialog stack needs on Windows.
/// Same content as tauri-build's default app manifest.
const WINDOWS_APP_MANIFEST: &str = r#"<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity
        type="win32"
        name="Microsoft.Windows.Common-Controls"
        version="6.0.0.0"
        processorArchitecture="*"
        publicKeyToken="6595b64144ccf1df"
        language="*"
      />
    </dependentAssembly>
  </dependency>
</assembly>
"#;

fn build_tauri() {
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_env = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
    if target_os != "windows" || target_env != "msvc" {
        tauri_build::build();
        return;
    }

    // tauri-build only embeds its manifest into the app binary, so the lib's
    // unit-test exe starts without Common Controls v6 and dies with
    // STATUS_ENTRYPOINT_NOT_FOUND once the Tauri stack imports TaskDialog APIs.
    // Embed the manifest through linker args instead, which reach every target.
    let windows = tauri_build::WindowsAttributes::new_without_app_manifest();
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
        .expect("failed to run tauri-build");

    let out_dir =
        std::path::PathBuf::from(std::env::var("OUT_DIR").expect("OUT_DIR is set by Cargo"));
    let manifest = out_dir.join("windows-app-manifest.xml");
    std::fs::write(&manifest, WINDOWS_APP_MANIFEST).expect("failed to write Windows app manifest");
    println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
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
