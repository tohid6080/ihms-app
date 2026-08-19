/**
 * Native file save/share helper — only activates inside a Capacitor native
 * build (window.Capacitor.isNativePlatform() === true). In the browser
 * (GitHub Pages / `npm run dev` / any non-native context) this is a no-op
 * and every existing export function keeps working exactly as it does
 * today via XLSX.writeFile() / window.open()+print().
 *
 * Why this is needed: inside an Android WebView, window.open("", "_blank")
 * for a blank popup and blob-download links (what XLSX.writeFile() uses
 * internally) are both unreliable — they work in a real browser tab but
 * commonly fail silently in a WebView. The reliable, standard pattern on
 * Android is: write the file into the app's cache directory, then hand it
 * to the native Share sheet so the user can save/open/send it with any
 * app they have installed.
 */

export function isNativeApp() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

export async function writeAndShare(base64Data, fileName, dialogTitle) {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
  const result = await Filesystem.writeFile({ path: fileName, data: cleanBase64, directory: Directory.Cache });
  await Share.share({ title: fileName, url: result.uri, dialogTitle: dialogTitle || "ذخیره یا ارسال فایل" });
}

/**
 * Excel export. Caller passes the SheetJS workbook object (not a filename
 * write) — we handle both the native and browser paths from one place.
 */
export async function exportWorkbookNativeAware(XLSX, wb, fileName) {
  if (!isNativeApp()) {
    XLSX.writeFile(wb, fileName);
    return;
  }
  try {
    const base64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
    await writeAndShare(base64, fileName, "ذخیره یا ارسال فایل Excel");
  } catch (e) {
    console.error("Native Excel export failed, falling back to browser download", e);
    XLSX.writeFile(wb, fileName);
  }
}

/**
 * "PDF" export. In the browser this opens a printable tab exactly as
 * before (window.open + window.print — the user chooses "Save as PDF" in
 * the print dialog). Inside the native app, window.open() for a blank tab
 * is unreliable, and true PDF generation would need a whole extra library
 * — so instead we share the same content as an .html report via the
 * native Share sheet. It's not a one-tap PDF on Android, but it's an
 * honest, working fallback: the user can open it in Chrome and use
 * "Print → Save as PDF" from there, same output, one extra tap.
 */
export async function exportHtmlReportNativeAware(html, fileName) {
  if (!isNativeApp()) return false; // caller keeps using window.open()+print() as before
  try {
    const base64 = btoa(unescape(encodeURIComponent(html)));
    await writeAndShare(base64, fileName.endsWith(".html") ? fileName : `${fileName}.html`, "ذخیره یا ارسال گزارش (باز کنید و از Chrome چاپ/PDF بگیرید)");
    return true;
  } catch (e) {
    console.error("Native HTML report export failed", e);
    return false;
  }
}

/**
 * Downloads an arbitrary URL (a Storage file, in practice) to the user's
 * device — used by the Archive tool so a file is safely on the admin's
 * computer/phone BEFORE it gets deleted from Supabase.
 */
export async function downloadUrlNativeAware(url, fileName) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`دانلود فایل ناموفق بود (${res.status})`);
  const blob = await res.blob();

  if (isNativeApp()) {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    await writeAndShare(base64, fileName, "ذخیره یا ارسال فایل آرشیوشده");
    return;
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
