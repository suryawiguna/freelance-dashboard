import { describe, expect, it } from "vitest";
import { fillTemplate, parseTemplates } from "./templates";

const SOP = `## 5. Paket

**Termasuk:** branding, input menu.

**Template harga (setelah kualifikasi dan demo):**

> Untuk biayanya ada biaya setup Rp1.400.000.

## 8. Template Pesan

**Respon pertama POS:**
> Halo kak, makasih sudah tertarik.

**Kirim demo POS:**
> Ini demo dengan menu kakak: [link].
> Silakan dicoba dulu ya.

**Bukan template:**

Paragraf biasa, bukan kutipan.

> Kutipan tanpa judul diabaikan.
`;

describe("parseTemplates", () => {
  it("judul tebal diikuti kutipan, baris kosong boleh", () => {
    expect(parseTemplates(SOP)).toEqual([
      { title: "Template harga (setelah kualifikasi dan demo)", text: "Untuk biayanya ada biaya setup Rp1.400.000." },
      { title: "Respon pertama POS", text: "Halo kak, makasih sudah tertarik." },
      { title: "Kirim demo POS", text: "Ini demo dengan menu kakak: [link].\nSilakan dicoba dulu ya." },
    ]);
  });
  it("teks tebal dengan isi di baris yang sama bukan judul", () => {
    expect(parseTemplates("**Termasuk:** branding\n> bukan template")).toEqual([]);
  });
  it("judul tanpa titik dua dan baris CRLF", () => {
    expect(parseTemplates("**Salam**\r\n> Halo\r\n")).toEqual([{ title: "Salam", text: "Halo" }]);
  });
  it("kosong", () => {
    expect(parseTemplates("")).toEqual([]);
  });
});

describe("fillTemplate", () => {
  it("mengisi [link] bila ada", () => {
    expect(fillTemplate("Demo: [link]", { link: "https://kasir-demo.web.app/d/a" })).toBe("Demo: https://kasir-demo.web.app/d/a");
  });
  it("membiarkan [link] bila link kosong", () => {
    expect(fillTemplate("Demo: [link]", { link: "" })).toBe("Demo: [link]");
  });
});
