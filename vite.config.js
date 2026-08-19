import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  // زمان واقعی اجرای build، برای نمایش صادقانه در صفحه‌ی «درباره‌ی IHMS» —
  // نه یک عدد ساختگی، بلکه دقیقاً همان لحظه‌ای که npm run build اجرا شده.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
