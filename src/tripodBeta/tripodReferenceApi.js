import { sb, sbOk } from "../shared.js";

// جداول مرجع سراسری (نه به‌ازای شرکت) — همان ۱۱ گروه، ۵۵ پیش‌شرط، ۱۴۰
// اشکال پنهان، ۱۱ دسته BRF، ۴ دسته هدف که در فاز اول seed شدند.

export async function loadReferenceGroups() {
  const [groupsRes, precondsRes, hiddensRes] = await Promise.all([
    sb("tripod_ref_checklist_group?select=*&order=group_no.asc"),
    sb("tripod_ref_precondition?select=*&order=code.asc"),
    sb("tripod_ref_hidden_failure?select=*&order=code.asc"),
  ]);
  const groups = sbOk(groupsRes) ? groupsRes : [];
  const preconds = sbOk(precondsRes) ? precondsRes : [];
  const hiddens = sbOk(hiddensRes) ? hiddensRes : [];

  return groups.map((g) => ({
    groupNo: g.group_no,
    titleFa: g.title_fa,
    preconditions: preconds.filter((p) => p.group_no === g.group_no).map((p) => ({ id: p.id, code: p.code, textFa: p.text_fa, groupNo: p.group_no })),
    hiddenFailures: hiddens.filter((h) => h.group_no === g.group_no).map((h) => ({ id: h.id, code: h.code, textFa: h.text_fa, groupNo: h.group_no, brfCode: h.brf_code })),
  }));
}

export async function loadTargetCategories() {
  const rows = await sb("tripod_ref_target_category?select=*");
  return sbOk(rows) ? rows.map((r) => ({ code: r.code, titleFa: r.title_fa, potentialDamageFa: r.potential_damage_fa || "" })) : [];
}

// مسطح‌کردن گروه‌ها برای انتخابگر جست‌وجوپذیر — دقیقاً معادل flattenChecklist در checklist-picker.js
export function flattenChecklist(groups, kind) {
  const out = [];
  groups.forEach((g) => {
    const items = kind === "precondition" ? g.preconditions : g.hiddenFailures;
    items.forEach((it) => out.push({ ...it, groupTitle: g.titleFa }));
  });
  return out;
}
