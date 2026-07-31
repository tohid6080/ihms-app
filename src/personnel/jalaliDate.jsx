import React from "react";
import { styles } from "../shared.js";

// نسخه‌ی مستقل تبدیل تاریخ شمسی — عمداً کپی محلی است (نه import از App.jsx)
// تا این ماژول کاملاً خودکفا بماند و به فایل‌های دیگر پروژه دست نخورد.

function isLeapJalaliYear(jy) {
  return (((jy - (jy > 0 ? 474 : 473)) % 2820 + 474 + 38) * 682) % 2816 < 682;
}
function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaliYear(jy) ? 30 : 29;
}
function gregorianToJalali(gy, gm, gd) {
  const gDaysInMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  const gy2 = gy <= 1600 ? gy - 621 : gy - 1600;
  const gy3 = gm > 2 ? gy2 + 1 : gy2;
  let days = 365 * gy2 + Math.floor((gy3 + 3) / 4) - Math.floor((gy3 + 99) / 100) + Math.floor((gy3 + 399) / 400) - 80 + gd + gDaysInMonth[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}
function jalaliToGregorian(jy, jm, jd) {
  let gy = jy <= 979 ? 621 : 1600;
  const jy2 = jy <= 979 ? jy : jy - 979;
  let days = 365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4) + 78 + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor((days - 1) / 36524);
    days = (days - 1) % 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const gd = days + 1;
  const isGLeap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const gMonthLen = [0, 31, isGLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1; let rem = gd;
  while (gm <= 12 && rem > gMonthLen[gm]) { rem -= gMonthLen[gm]; gm++; }
  return [gy, gm, rem];
}
function todayJalaliParts() {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
function isoToJalali(iso) {
  if (!iso) return null;
  const [gy, gm, gd] = iso.split("-").map(Number);
  if (!gy) return null;
  return gregorianToJalali(gy, gm, gd);
}
export function isoToJalaliDisplay(iso) {
  const p = isoToJalali(iso);
  if (!p) return "";
  return `${p[0]}/${String(p[1]).padStart(2, "0")}/${String(p[2]).padStart(2, "0")}`;
}

/**
 * Same as isoToJalaliDisplay, but also safe for full timestamps
 * ("2026-07-30T12:34:56.789Z"), not just bare dates ("2026-07-30") —
 * isoToJalali() would otherwise choke on the "T12:34..." suffix. Use this
 * for any created_at/updated_at/uploaded_at/reviewed_at style column.
 */
export function toJalaliSafe(value) {
  if (!value) return "";
  const datePart = String(value).slice(0, 10);
  return isoToJalaliDisplay(datePart);
}

// همان toJalaliSafe به‌همراه ساعت محلی، برای جاهایی که ساعت هم لازم است
// (مثل ثبت زمان دقیق آرشیو).
export function toJalaliDateTime(value) {
  if (!value) return "";
  const jalaliDate = toJalaliSafe(value);
  if (!jalaliDate) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return jalaliDate;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${jalaliDate} - ${hh}:${mm}`;
}

// برای اسم فایل اکسل آرشیو: "1405-05-10_14-35" (خط‌تیره به‌جای اسلش، چون
// اسلش در اسم فایل مجاز نیست)
export function jalaliFileTimestamp() {
  const now = new Date();
  const jalaliDate = toJalaliSafe(now.toISOString()).replaceAll("/", "-");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${jalaliDate}_${hh}-${mm}`;
}

const JALALI_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

export function JalaliDateInput({ value, onChange, allowEmpty }) {
  const todayParts = todayJalaliParts();
  const parsed = isoToJalali(value);
  const jy = parsed ? parsed[0] : todayParts[0];
  const jm = parsed ? parsed[1] : todayParts[1];
  const jd = parsed ? parsed[2] : todayParts[2];

  React.useEffect(() => {
    if (!value && !allowEmpty) {
      const [gy, gm, gd] = jalaliToGregorian(todayParts[0], todayParts[1], todayParts[2]);
      onChange(`${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const years = [];
  for (let y = todayParts[0] - 6; y <= todayParts[0] + 2; y++) years.push(y);
  const dayCount = jalaliMonthLength(jy, jm);
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);

  const emit = (ny, nm, nd) => {
    const maxD = jalaliMonthLength(ny, nm);
    const safeD = Math.min(nd, maxD);
    const [gy, gm, gd] = jalaliToGregorian(ny, nm, safeD);
    onChange(`${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`);
  };

  return (
    <div style={{ display: "flex", gap: 6 }} dir="rtl">
      <select style={{ ...styles.input, flex: 1.2 }} value={jy} onChange={(e) => emit(Number(e.target.value), jm, jd)}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select style={{ ...styles.input, flex: 1.4 }} value={jm} onChange={(e) => emit(jy, Number(e.target.value), jd)}>
        {JALALI_MONTHS.map((m, idx) => <option key={idx} value={idx + 1}>{m}</option>)}
      </select>
      <select style={{ ...styles.input, flex: 1 }} value={jd} onChange={(e) => emit(jy, jm, Number(e.target.value))}>
        {days.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
    </div>
  );
}
