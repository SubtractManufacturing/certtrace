use std::path::Path;
#[cfg(any(target_os = "macos", target_os = "linux"))]
use std::process::Command;

#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn parse_lpstat_queues(stdout: &str) -> Vec<String> {
    stdout
        .lines()
        .filter_map(|line| line.split_whitespace().next())
        .filter(|name| !name.is_empty())
        .map(str::to_owned)
        .collect()
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn list_printer_queues_platform() -> Result<Vec<String>, String> {
    let output = Command::new("lpstat")
        .arg("-a")
        .output()
        .map_err(|err| format!("Could not list OS printers with lpstat: {err}"))?;
    if !output.status.success() {
        return Err(format!(
            "lpstat failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(parse_lpstat_queues(&String::from_utf8_lossy(
        &output.stdout,
    )))
}

#[cfg(target_os = "windows")]
fn list_printer_queues_platform() -> Result<Vec<String>, String> {
    use winprint::printer::PrinterDevice;

    PrinterDevice::all()
        .map(|devices| {
            devices
                .into_iter()
                .map(|device| device.name().to_owned())
                .collect()
        })
        .map_err(|err| format!("Could not list Windows printers: {err}"))
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn list_printer_queues_platform() -> Result<Vec<String>, String> {
    Err("Printing is not supported on this platform.".to_string())
}

#[tauri::command]
pub fn list_printer_queues() -> Result<Vec<String>, String> {
    list_printer_queues_platform()
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn print_pdf_platform(
    path: &Path,
    queue_name: &str,
    width_microns: u32,
    height_microns: u32,
) -> Result<(), String> {
    let path_str = path.to_str().ok_or("Invalid PDF path")?;
    let media = format!(
        "Custom.{:.3}x{:.3}mm",
        width_microns as f64 / 1000.0,
        height_microns as f64 / 1000.0
    );
    let output = Command::new("lp")
        .args([
            "-d",
            queue_name,
            "-o",
            &format!("media={media}"),
            "-o",
            "scaling=100",
            "-o",
            "print-scaling=none",
        ])
        .arg(path_str)
        .output()
        .map_err(|err| format!("Could not run lp for queue “{queue_name}”: {err}"))?;
    if output.status.success() {
        return Ok(());
    }
    Err(format!(
        "Queue “{queue_name}” rejected the Label: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    ))
}

#[cfg(target_os = "windows")]
fn custom_media_ticket(width_microns: u32, height_microns: u32) -> winprint::ticket::PrintTicket {
    use winprint::ticket::PrintTicket;

    PrintTicket::from_xml(format!(
        r#"<psf:PrintTicket xmlns:psf="http://schemas.microsoft.com/windows/2003/08/printing/printschemaframework" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" version="1" xmlns:psk="http://schemas.microsoft.com/windows/2003/08/printing/printschemakeywords">
  <psf:Feature name="psk:PageMediaSize">
    <psf:Option name="psk:CustomMediaSize">
      <psf:ScoredProperty name="psk:MediaSizeWidth">
        <psf:ParameterRef name="psk:PageMediaSizeMediaSizeWidth"/>
      </psf:ScoredProperty>
      <psf:ScoredProperty name="psk:MediaSizeHeight">
        <psf:ParameterRef name="psk:PageMediaSizeMediaSizeHeight"/>
      </psf:ScoredProperty>
    </psf:Option>
  </psf:Feature>
  <psf:ParameterInit name="psk:PageMediaSizeMediaSizeWidth">
    <psf:Value xsi:type="xsd:integer">{width_microns}</psf:Value>
  </psf:ParameterInit>
  <psf:ParameterInit name="psk:PageMediaSizeMediaSizeHeight">
    <psf:Value xsi:type="xsd:integer">{height_microns}</psf:Value>
  </psf:ParameterInit>
</psf:PrintTicket>"#
    ))
}

#[cfg(target_os = "windows")]
fn print_pdf_platform(
    path: &Path,
    queue_name: &str,
    width_microns: u32,
    height_microns: u32,
) -> Result<(), String> {
    use winprint::printer::{FilePrinter, PdfiumPrinter, PrinterDevice};
    use winprint::ticket::PrintTicketBuilder;

    let device = PrinterDevice::all()
        .map_err(|err| format!("Could not list Windows printers: {err}"))?
        .into_iter()
        .find(|device| device.name() == queue_name)
        .ok_or_else(|| format!("OS printer queue is no longer available: {queue_name}"))?;
    let mut builder = PrintTicketBuilder::new(&device)
        .map_err(|err| format!("Could not prepare “{queue_name}”: {err}"))?;
    builder
        .merge(custom_media_ticket(width_microns, height_microns))
        .map_err(|err| {
            format!(
                "Printer “{queue_name}” rejected the Label size {:.3} × {:.3} mm: {err}",
                width_microns as f64 / 1000.0,
                height_microns as f64 / 1000.0
            )
        })?;
    let ticket = builder
        .build()
        .map_err(|err| format!("Could not prepare “{queue_name}”: {err}"))?;
    PdfiumPrinter::new(device)
        .print(path, ticket)
        .map_err(|err| format!("Could not print the Label on “{queue_name}”: {err}"))
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
fn print_pdf_platform(
    _path: &Path,
    _queue_name: &str,
    _width_microns: u32,
    _height_microns: u32,
) -> Result<(), String> {
    Err("Printing is not supported on this platform.".to_string())
}

#[tauri::command]
pub fn print_pdf_file(
    path: String,
    queue_name: String,
    width_microns: u32,
    height_microns: u32,
) -> Result<(), String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err(format!("PDF not found: {path}"));
    }
    if !list_printer_queues_platform()?
        .iter()
        .any(|queue| queue == &queue_name)
    {
        return Err(format!(
            "OS printer queue is no longer available: {queue_name}"
        ));
    }
    print_pdf_platform(file_path, &queue_name, width_microns, height_microns)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_available_cups_queues() {
        assert_eq!(
            parse_lpstat_queues(
                "Zebra_ZD421 accepting requests since Sun\nBrother-QL accepting requests since Mon\n"
            ),
            vec!["Zebra_ZD421", "Brother-QL"]
        );
    }
}
