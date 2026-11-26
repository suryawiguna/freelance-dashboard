/**
 * Salin teks. Clipboard API dulu; bila ditolak (izin, webview, iOS lama),
 * pakai textarea + execCommand("copy") selama masih dalam klik pengguna.
 * Textarea ditaruh di samping elemen yang fokus supaya focus trap dialog
 * (panel edit) tidak merebut fokusnya.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const host = document.activeElement?.parentElement ?? document.body;
    const t = document.createElement("textarea");
    t.value = text;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.opacity = "0";
    host.appendChild(t);
    t.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    t.remove();
    return ok;
  }
}
