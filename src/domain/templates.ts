/**
 * Template pesan dibaca dari Panduan (Markdown), jadi cukup diedit di satu
 * tempat. Bentuk yang dikenali: satu baris tebal sebagai judul, lalu kutipan
 * (`> ...`) sebagai isi. Baris kosong di antaranya boleh.
 *
 *   **Follow-up H+3:**
 *   > Halo kak, sudah sempat coba demonya?
 *
 * Modul murni, dites.
 */
export interface MessageTemplate {
  title: string;
  text: string;
}

/** `**Judul:**`, `**Judul**:`, atau `**Judul (catatan):**`, tanpa teks lain di baris itu. */
const TITLE = /^\*\*(.+?)\*\*\s*:?\s*$/;

export function parseTemplates(markdown: string): MessageTemplate[] {
  const lines = markdown.split(/\r?\n/);
  const out: MessageTemplate[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = TITLE.exec(lines[i].trim());
    if (!m) continue;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j++;
    const quote: string[] = [];
    while (j < lines.length && /^\s*>/.test(lines[j])) {
      quote.push(lines[j].replace(/^\s*>\s?/, ""));
      j++;
    }
    const text = quote.join("\n").trim();
    if (!text) continue;
    out.push({ title: m[1].replace(/:\s*$/, "").trim(), text });
    i = j - 1;
  }
  return out;
}

/** Isi `[link]` dengan link proyek bila ada; selain itu biarkan untuk diisi manual. */
export function fillTemplate(text: string, vars: { link?: string }): string {
  return vars.link ? text.replaceAll("[link]", vars.link) : text;
}
