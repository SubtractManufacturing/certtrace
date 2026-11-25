import { describe, expect, it } from "vitest";
import { sanitizeAttachmentName, uniqueAttachmentName } from "../src/index.js";

describe("sanitizeAttachmentName", () => {
  it.each([
    "Certificate for 04203SAMPLE line 1.pdf",
    "Cert, A+B (rev 2) #7 [final]'s é 証明書.pdf",
    ".hidden",
    "console.pdf",
  ])("leaves %j unchanged", (name) => {
    expect(sanitizeAttachmentName(name)).toBe(name);
  });

  it.each([
    ["x&calc&.pdf", "x_calc_.pdf"],
    ['a|b<c>d^e%f!g"h`i$j;k:l*m?n.pdf', "a_b_c_d_e_f_g_h_i_j_k_l_m_n.pdf"],
    ["a\nb\u0000c.pdf", "a_b_c.pdf"],
    ["cert\u202Efdp.exe", "cert_fdp.exe"],
    [" cert.pdf. . ", "cert.pdf"],
    ["CON.pdf", "_CON.pdf"],
    ["nul", "_nul"],
  ])("cleans %j", (name, expected) => {
    expect(sanitizeAttachmentName(name)).toBe(expected);
  });

  it("leaves folder separators for callers to reject", () => {
    expect(sanitizeAttachmentName("../a\\b.pdf")).toBe("../a\\b.pdf");
  });
});

describe("uniqueAttachmentName", () => {
  it.each([
    ["cert.pdf", ["other.pdf"], "cert.pdf"],
    ["CERT.pdf", ["cert.PDF"], "CERT-2.pdf"],
    ["cert.pdf", ["Cert.pdf", "CERT-2.pdf"], "cert-3.pdf"],
    // Composed and decomposed é name the same file on macOS.
    ["é.pdf", ["é.pdf"], "é-2.pdf"],
  ])("names %j alongside %j", (name, existing, expected) => {
    expect(uniqueAttachmentName(name, existing)).toBe(expected);
  });
});
