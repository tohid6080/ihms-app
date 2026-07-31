const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB خام (قبل از فشرده‌سازی)

// عکس‌ها فشرده می‌شوند (مثل بقیه‌ی اپ)، فایل‌های غیرعکسی (PDF) بدون تغییر خوانده می‌شوند
export function fileToBase64(file, maxDim = 1600, quality = 0.8) {
  if (file.size > MAX_FILE_BYTES) {
    return Promise.reject(new Error("حجم فایل بیش از حد مجاز است (حداکثر ۸ مگابایت)"));
  }
  if (file.type && file.type.startsWith("image/")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("خطا در خواندن فایل"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("فایل تصویر معتبر نیست"));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
            else { width = Math.round((width * maxDim) / height); height = maxDim; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  // PDF / other: no resize, just base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("خطا در خواندن فایل"));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export function isPdfDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return false;
  // یا یک data URL کلاسیک (هنوز روی دستگاه، آفلاین و سینک‌نشده)
  // یا یک آدرس واقعی در Supabase Storage که با پسوند pdf. ذخیره شده
  return dataUrl.startsWith("data:application/pdf") || dataUrl.toLowerCase().endsWith(".pdf");
}
