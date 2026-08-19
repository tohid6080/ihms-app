import * as XLSX from "xlsx";
import JSZip from "jszip";
import { isNativeApp, writeAndShare } from "./nativeFile.js";

/**
 * Builds ONE zip containing the Excel file (at the root) plus a "files/"
 * folder with every attachment, and saves it as a single download.
 *
 * Why one zip instead of two separate downloads: Excel's relative-path
 * hyperlinks resolve relative to wherever the .xlsx file itself sits on
 * disk. If Excel and the attachments were two separate downloads, the user
 * could easily extract them into different folders and every link would
 * break. Bundling both into one zip means: extract the zip → open the
 * Excel from right there → the "files/…" relative links always resolve,
 * no internet, no Supabase, ever.
 *
 * `attachments`: [{ relativePath: "files/x.jpg", content: Blob|ArrayBuffer }]
 */
/**
 * `workbook`: خروجی SheetJS (XLSX.utils.book_new)، برای همه‌ی ماژول‌های
 * آرشیو به‌جز آنومالی — روش قبلی، دست‌نخورده.
 * `excelBuffer`: خروجی آماده (ArrayBuffer/Uint8Array) از یک کتابخانه‌ی
 * دیگر مثل ExcelJS — وقتی استایل‌دهی واقعی سلول (رنگ/فونت) لازم است، چون
 * نسخه‌ی رایگان xlsx امکان نوشتن استایل را ندارد. اگر excelBuffer داده
 * شود، workbook نادیده گرفته می‌شود.
 */
export async function buildArchiveZip({ workbook, excelBuffer, excelFileName, attachments, zipFileName }) {
  const zip = new JSZip();
  const excelArray = excelBuffer || XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  zip.file(excelFileName, excelArray);

  for (const att of attachments) {
    zip.file(att.relativePath, att.content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  await saveBlobNativeAware(blob, zipFileName);
}

export async function saveBlobNativeAware(blob, fileName) {
  if (isNativeApp()) {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    await writeAndShare(base64, fileName, "ذخیره یا ارسال آرشیو");
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// از URL (روی Supabase Storage) یا دیتای base64 محلی، بایت واقعی فایل را
// برای قرار دادن داخل zip برمی‌گرداند.
export async function fetchAttachmentBytes(urlOrBase64) {
  if (typeof urlOrBase64 !== "string") return null;
  if (urlOrBase64.startsWith("data:")) {
    const base64 = urlOrBase64.split(",")[1] || "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  try {
    const res = await fetch(urlOrBase64);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

// اسم فایل امن برای داخل zip (بدون کاراکترهای غیرمجاز ویندوز)
export function safeFileName(name) {
  return String(name || "file").replace(/[\\/:*?"<>|]/g, "_");
}
