import { sb, sbOk, uid, getCurrentCompanyId } from "../shared.js";
import { uploadBase64ToStorage } from "../offline/storageUpload.js";

/**
 * Internal chat — direct + group conversations, scoped to the current
 * company (same multi-tenant boundary every other module already uses).
 * No external chat service; messages are plain rows read/written through
 * the same anon-key REST pattern the rest of the app uses. New messages
 * are picked up by polling while a thread is open (see ChatThread.jsx),
 * not websockets — consistent with the rest of this offline-aware app
 * rather than introducing a second, different connectivity model.
 */

function convFromRow(r) {
  return {
    id: r.id,
    type: r.type || "direct",
    title: r.title || "",
    linkedModule: r.linked_module || "",
    linkedId: r.linked_id || "",
    linkedLabel: r.linked_label || "",
    createdBy: r.created_by || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function msgFromRow(r) {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderUsername: r.sender_username || "",
    senderName: r.sender_name || "",
    senderRole: r.sender_role || "",
    body: r.body || "",
    attachmentUrl: r.attachment_url || "",
    attachmentName: r.attachment_name || "",
    attachmentType: r.attachment_type || "",
    isSystem: r.is_system === true,
    createdAt: r.created_at,
  };
}
function participantFromRow(r) {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    username: r.username,
    fullName: r.full_name || "",
    role: r.role || "",
    lastReadAt: r.last_read_at || "",
    joinedAt: r.joined_at,
  };
}

// ---------- فهرست همکاران قابل‌گفتگو (فقط داخل همان شرکت) ----------

// ---------- یافتن نام کاربری واقعی بر اساس نام نمایشی ----------
// وقتی از داخل ماژول آنومالی/BowTie می‌خواهیم طرف مرتبط را خودکار به چت
// اضافه کنیم، فقط «نام» او را داریم (نه نام کاربری) — این تابع نام کاربری
// واقعی را پیدا می‌کند تا عضویت درست ثبت شود.
export async function resolveContractorUsername(name) {
  if (!name) return null;
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`contractors?name=eq.${encodeURIComponent(name)}&select=username${filter}`);
  return sbOk(rows) && rows[0]?.username ? rows[0].username : null;
}

// کلید هویت برای قوانین دسترسی: نقش + عنوان شغلی با هم. چون یک عنوان شغلی
// (مثلاً «سرپرست کارگاه») می‌تواند هم سمت کارفرما هم سمت پیمانکار استفاده
// شود، بلاک‌کردن فقط بر اساس عنوان شغلی کافی نیست — دو «سرپرست کارگاه» از
// دو طرف مختلف باید بتوانند مستقل از هم بلاک شوند.
function identityKey(role, jobPositionId) {
  return `${role || ""}::${jobPositionId || ""}`;
}

// جهت‌دار نیست: اگر (نقش+عنوان شغلی) A با B بلاک شده باشد، افراد هر دو گروه
// در لیست «گفتگوی جدید» یکدیگر را نمی‌بینند. افرادی که عنوان شغلی ندارند،
// یا هویتشان در هیچ قانونی نیست، طبق پیش‌فرض برای همه قابل‌مشاهده‌اند.
// حساب‌های ADMIN همیشه قابل‌مشاهده می‌مانند (مسدودشدن کامل مدیر سامانه از
// دید کسی منطقی نیست).
export async function loadChatDirectory(myRole, myJobPositionId) {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const [employers, contractors, rules] = await Promise.all([
    sb(`employer_accounts?select=username,name,role,job_position_id${filter}`),
    sb(`contractors?select=username,name,job_position_id${filter}`),
    sb(`chat_visibility_rules?select=*${filter}`),
  ]);
  const people = [];
  if (sbOk(employers)) employers.forEach((e) => { if (e.username) people.push({ username: e.username, name: e.name, role: e.role === "admin" ? "ADMIN" : "EMPLOYER", jobPositionId: e.job_position_id || "" }); });
  if (sbOk(contractors)) contractors.forEach((c) => { if (c.username) people.push({ username: c.username, name: c.name, role: "CONTRACTOR", jobPositionId: c.job_position_id || "" }); });

  if (myRole === "ADMIN" || !myJobPositionId || !sbOk(rules) || rules.length === 0) return people;

  const myKey = identityKey(myRole, myJobPositionId);
  const blockedKeys = new Set();
  rules.forEach((r) => {
    const keyA = identityKey(r.role_a, r.job_position_id_a);
    const keyB = identityKey(r.role_b, r.job_position_id_b);
    if (keyA === myKey) blockedKeys.add(keyB);
    if (keyB === myKey) blockedKeys.add(keyA);
  });
  if (blockedKeys.size === 0) return people;

  return people.filter((p) => p.role === "ADMIN" || !blockedKeys.has(identityKey(p.role, p.jobPositionId)));
}

// ---------- تشخیص اینکه هر عنوان شغلی واقعاً سمت کدام نقش استفاده می‌شود ----------
// برای اینکه ماتریس دسترسی چت فقط ترکیب‌های واقعی را نشان بدهد (مثلاً
// «کارشناس بهداشت و محیط‌زیست» ممکن است فقط سمت پیمانکار وجود داشته باشد،
// نه کارفرما) — نه هر عنوان شغلی را برای هر دو نقش به‌صورت فرضی.
export async function loadUsedJobPositionsByRole() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const [employers, contractors] = await Promise.all([
    sb(`employer_accounts?select=job_position_id${filter}`),
    sb(`contractors?select=job_position_id${filter}`),
  ]);
  const employerIds = new Set((sbOk(employers) ? employers : []).map((r) => r.job_position_id).filter(Boolean));
  const contractorIds = new Set((sbOk(contractors) ? contractors : []).map((r) => r.job_position_id).filter(Boolean));
  return { employerJobPositionIds: employerIds, contractorJobPositionIds: contractorIds };
}

// ---------- افزودن دستی هویت به ماتریس (برای عناوینی که هنوز حسابی باهاشون نیست) ----------
export async function loadExtraIdentities() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`chat_matrix_extra_identities?select=job_position_id,role${filter}`);
  return sbOk(rows) ? rows.map((r) => ({ jobPositionId: r.job_position_id, role: r.role })) : [];
}

export async function addExtraIdentity(jobPositionId, role) {
  const result = await sb("chat_matrix_extra_identities", { method: "POST", body: JSON.stringify([{ job_position_id: jobPositionId, role, company_id: getCurrentCompanyId() }]) });
  if (!sbOk(result)) return { __error: true, message: "خطا در افزودن" };
  return { ok: true };
}

export async function removeExtraIdentity(jobPositionId, role) {
  await sb(`chat_matrix_extra_identities?job_position_id=eq.${jobPositionId}&role=eq.${role}`, { method: "DELETE", prefer: "return=minimal" });
  return { ok: true };
}

// ---------- مدیریت قوانین دسترسی چت (فقط ادمین) ----------

export async function loadVisibilityRules() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const rows = await sb(`chat_visibility_rules?select=*${filter}`);
  return sbOk(rows) ? rows.map((r) => ({ roleA: r.role_a, jobPositionIdA: r.job_position_id_a, roleB: r.role_b, jobPositionIdB: r.job_position_id_b })) : [];
}

export async function setVisibilityRule(roleA, jobPositionIdA, roleB, jobPositionIdB, blocked) {
  if (blocked) {
    const existing = await sb(`chat_visibility_rules?role_a=eq.${roleA}&job_position_id_a=eq.${jobPositionIdA}&role_b=eq.${roleB}&job_position_id_b=eq.${jobPositionIdB}&select=id`);
    if (sbOk(existing) && existing.length > 0) return { ok: true };
    const reverseExisting = await sb(`chat_visibility_rules?role_a=eq.${roleB}&job_position_id_a=eq.${jobPositionIdB}&role_b=eq.${roleA}&job_position_id_b=eq.${jobPositionIdA}&select=id`);
    if (sbOk(reverseExisting) && reverseExisting.length > 0) return { ok: true };
    const result = await sb("chat_visibility_rules", { method: "POST", body: JSON.stringify([{ role_a: roleA, job_position_id_a: jobPositionIdA, role_b: roleB, job_position_id_b: jobPositionIdB, company_id: getCurrentCompanyId() }]) });
    if (!sbOk(result)) return { __error: true, message: "خطا در ذخیره‌سازی: " + (result?.message || "نامشخص") };
    return { ok: true };
  }
  await sb(`chat_visibility_rules?role_a=eq.${roleA}&job_position_id_a=eq.${jobPositionIdA}&role_b=eq.${roleB}&job_position_id_b=eq.${jobPositionIdB}`, { method: "DELETE", prefer: "return=minimal" });
  await sb(`chat_visibility_rules?role_a=eq.${roleB}&job_position_id_a=eq.${jobPositionIdB}&role_b=eq.${roleA}&job_position_id_b=eq.${jobPositionIdA}`, { method: "DELETE", prefer: "return=minimal" });
  return { ok: true };
}

// ---------- مکالمات کاربر جاری ----------

export async function loadMyConversations(username) {
  console.log("[chat] loadMyConversations: شروع برای", username);
  const partRows = await sb(`chat_participants?username=eq.${encodeURIComponent(username)}&select=*`);
  console.log("[chat] loadMyConversations: ردیف‌های عضویت این کاربر", partRows);
  if (!sbOk(partRows) || partRows.length === 0) {
    console.warn("[chat] loadMyConversations: هیچ ردیف عضویتی برای این کاربر یافت نشد — لیست خالی برمی‌گردد");
    return [];
  }
  const convIds = partRows.map((p) => p.conversation_id);
  const myParticipant = {};
  partRows.forEach((p) => { myParticipant[p.conversation_id] = participantFromRow(p); });

  const convRows = await sb(`chat_conversations?id=in.(${convIds.join(",")})&select=*&order=updated_at.desc`);
  console.log("[chat] loadMyConversations: ردیف‌های مکالمه بر اساس آن عضویت‌ها", convRows);
  const conversations = sbOk(convRows) ? convRows.map(convFromRow) : [];

  // برای هر مکالمه، بقیه‌ی اعضا (برای نمایش نام طرف مقابل در چت مستقیم) و آخرین پیام را بگیر
  const allParticipants = await sb(`chat_participants?conversation_id=in.(${convIds.join(",")})&select=*`);
  const participantsByConv = {};
  if (sbOk(allParticipants)) {
    allParticipants.forEach((p) => {
      if (!participantsByConv[p.conversation_id]) participantsByConv[p.conversation_id] = [];
      participantsByConv[p.conversation_id].push(participantFromRow(p));
    });
  }

  const lastMsgRows = await sb(`chat_messages?conversation_id=in.(${convIds.join(",")})&select=*&order=created_at.desc`);
  const lastMessageByConv = {};
  const unreadCountByConv = {};
  if (sbOk(lastMsgRows)) {
    lastMsgRows.forEach((m) => {
      if (!lastMessageByConv[m.conversation_id]) lastMessageByConv[m.conversation_id] = msgFromRow(m);
      const myLastRead = myParticipant[m.conversation_id]?.lastReadAt;
      const isUnread = m.sender_username !== username && (!myLastRead || new Date(m.created_at) > new Date(myLastRead));
      if (isUnread) unreadCountByConv[m.conversation_id] = (unreadCountByConv[m.conversation_id] || 0) + 1;
    });
  }

  const result = conversations.map((c) => ({
    ...c,
    participants: participantsByConv[c.id] || [],
    lastMessage: lastMessageByConv[c.id] || null,
    unreadCount: unreadCountByConv[c.id] || 0,
  })).sort((a, b) => {
    const at = a.lastMessage?.createdAt || a.createdAt;
    const bt = b.lastMessage?.createdAt || b.createdAt;
    return bt.localeCompare(at);
  });
  console.log("[chat] loadMyConversations: نتیجه‌ی نهایی", result);
  return result;
}

// ---------- شروع/یافتن یک مکالمه‌ی مستقیم ----------

export async function findOrCreateDirectConversation(me, otherUsername, otherName, otherRole) {
  // اگر از قبل مکالمه‌ی مستقیم بین این دو نفر وجود دارد، همان را برگردان
  const myConvs = await sb(`chat_participants?username=eq.${encodeURIComponent(me.username)}&select=conversation_id`);
  if (sbOk(myConvs) && myConvs.length > 0) {
    const ids = myConvs.map((r) => r.conversation_id);
    const theirConvs = await sb(`chat_participants?username=eq.${encodeURIComponent(otherUsername)}&conversation_id=in.(${ids.join(",")})&select=conversation_id`);
    if (sbOk(theirConvs) && theirConvs.length > 0) {
      for (const row of theirConvs) {
        const convCheck = await sb(`chat_conversations?id=eq.${row.conversation_id}&type=eq.direct&linked_module=is.null&select=id`);
        if (sbOk(convCheck) && convCheck.length > 0) return convCheck[0].id;
      }
    }
  }
  return createConversation(me, "direct", { participants: [{ username: otherUsername, fullName: otherName, role: otherRole }] });
}

// ---------- ساخت مکالمه (مستقیم، گروهی، یا متصل به یک ماژول) ----------

export async function createConversation(me, type, { title, participants, linkedModule, linkedId, linkedLabel } = {}) {
  console.log("[chat] createConversation: شروع", { me, type, title, participants, linkedModule, linkedId, linkedLabel, companyId: getCurrentCompanyId() });
  const payload = {
    company_id: getCurrentCompanyId(),
    type,
    title: title || "",
    linked_module: linkedModule || null,
    linked_id: linkedId || null,
    linked_label: linkedLabel || null,
    created_by: me.username || "",
  };
  const rows = await sb("chat_conversations", { method: "POST", body: JSON.stringify([payload]) });
  console.log("[chat] createConversation: نتیجه‌ی INSERT روی chat_conversations", rows);
  if (!sbOk(rows)) {
    console.error("[chat] createConversation: شکست در ساخت ردیف مکالمه", rows);
    return { __error: true, message: "خطا در ساخت مکالمه: " + (rows?.message || "نامشخص") };
  }
  const conv = rows[0];
  console.log("[chat] createConversation: مکالمه ساخته شد با id =", conv.id);

  const allParticipants = [
    { username: me.username, fullName: me.name, role: me.role },
    ...(participants || []),
  ];
  const uniqueByUsername = Object.values(
    allParticipants.reduce((acc, p) => { if (p.username) acc[p.username] = p; return acc; }, {})
  );
  console.log("[chat] createConversation: در حال درج شرکت‌کنندگان", uniqueByUsername);
  const partResult = await sb("chat_participants", {
    method: "POST",
    body: JSON.stringify(uniqueByUsername.map((p) => ({
      conversation_id: conv.id, username: p.username, full_name: p.fullName || p.name || "", role: p.role || "",
    }))),
  });
  console.log("[chat] createConversation: نتیجه‌ی INSERT روی chat_participants", partResult);
  if (!sbOk(partResult)) {
    // اگر عضوها ثبت نشوند، این مکالمه برای هیچ‌کس (نه حتی سازنده‌اش) قابل‌یافتن
    // نخواهد بود — دقیقاً همان چیزی که باعث می‌شد تاریخچه‌ی چت «گم» به‌نظر برسد.
    // چون خودِ ردیف مکالمه بی‌فایده است، حذفش می‌کنیم تا رکورد یتیم نماند.
    console.error("[chat] createConversation: شکست در درج شرکت‌کنندگان — مکالمه‌ی یتیم در حال حذف", partResult);
    await sb(`chat_conversations?id=eq.${conv.id}`, { method: "DELETE", prefer: "return=minimal" });
    return { __error: true, message: "خطا در افزودن اعضای گفتگو: " + (partResult?.message || "نامشخص") };
  }

  console.log("[chat] createConversation: موفق — بازگشت id =", conv.id);
  return conv.id;
}

// ---------- یافتن (یا ساخت) مکالمه‌ی متصل به یک آنومالی/BowTie ----------

export async function findOrCreateLinkedConversation(me, linkedModule, linkedId, linkedLabel, initialParticipants) {
  const existing = await sb(`chat_conversations?linked_module=eq.${linkedModule}&linked_id=eq.${encodeURIComponent(linkedId)}&select=id&limit=1`);
  if (sbOk(existing) && existing.length > 0) {
    // مطمئن شو کاربر جاری هم عضو است (ممکن است بعداً به بحث اضافه شده باشد)
    const already = await sb(`chat_participants?conversation_id=eq.${existing[0].id}&username=eq.${encodeURIComponent(me.username)}&select=id`);
    if (!sbOk(already) || already.length === 0) {
      const addResult = await sb("chat_participants", {
        method: "POST",
        body: JSON.stringify([{ conversation_id: existing[0].id, username: me.username, full_name: me.name, role: me.role }]),
      });
      if (!sbOk(addResult)) return { __error: true, message: "خطا در پیوستن به گفتگو: " + (addResult?.message || "نامشخص") };
    }
    return existing[0].id;
  }
  return createConversation(me, "group", {
    title: linkedLabel,
    linkedModule, linkedId, linkedLabel,
    participants: initialParticipants || [],
  });
}

// ---------- پیام‌ها ----------

export async function loadMessages(conversationId) {
  const rows = await sb(`chat_messages?conversation_id=eq.${conversationId}&select=*&order=created_at.asc`);
  console.log("[chat] loadMessages: مکالمه", conversationId, "→", sbOk(rows) ? `${rows.length} پیام` : "خطا", rows);
  return sbOk(rows) ? rows.map(msgFromRow) : [];
}

export async function sendMessage(conversationId, me, body, attachment) {
  console.log("[chat] sendMessage: شروع", { conversationId, sender: me.username, bodyLength: (body || "").length, hasAttachment: !!attachment });
  let attachmentUrl = "", attachmentName = "", attachmentType = "";
  if (attachment) {
    try {
      const ext = (attachment.mimeType || "").includes("pdf") ? "pdf" : (attachment.mimeType || "").split("/")[1] || "jpg";
      const path = `${conversationId}/${uid("msg")}.${ext}`;
      attachmentUrl = await uploadBase64ToStorage("chat-attachments", path, attachment.data, attachment.mimeType);
      attachmentName = attachment.name || "";
      attachmentType = attachment.mimeType || "";
      console.log("[chat] sendMessage: آپلود پیوست موفق", attachmentUrl);
    } catch (e) {
      console.error("[chat] sendMessage: شکست در آپلود پیوست", e);
      return { __error: true, message: "خطا در آپلود پیوست: " + (e?.message || "") };
    }
  }
  const payload = {
    conversation_id: conversationId,
    sender_username: me.username || "",
    sender_name: me.name || "",
    sender_role: me.role || "",
    body: body || "",
    attachment_url: attachmentUrl || null,
    attachment_name: attachmentName || null,
    attachment_type: attachmentType || null,
  };
  const rows = await sb("chat_messages", { method: "POST", body: JSON.stringify([payload]) });
  console.log("[chat] sendMessage: نتیجه‌ی INSERT روی chat_messages", rows);
  if (!sbOk(rows)) {
    console.error("[chat] sendMessage: شکست در ثبت پیام", rows);
    return { __error: true, message: "خطا در ارسال پیام: " + (rows?.message || "نامشخص") };
  }
  const touchResult = await sb(`chat_conversations?id=eq.${conversationId}`, { method: "PATCH", body: JSON.stringify({ updated_at: new Date().toISOString() }) });
  console.log("[chat] sendMessage: به‌روزرسانی updated_at مکالمه", touchResult);
  console.log("[chat] sendMessage: موفق", rows[0]);
  return msgFromRow(rows[0]);
}

export async function loadParticipants(conversationId) {
  const rows = await sb(`chat_participants?conversation_id=eq.${conversationId}&select=*`);
  console.log("[chat] loadParticipants: مکالمه", conversationId, "→", sbOk(rows) ? `${rows.length} عضو` : "خطا", rows);
  return sbOk(rows) ? rows.map(participantFromRow) : [];
}

export async function addParticipant(conversationId, person) {
  const result = await sb("chat_participants", {
    method: "POST",
    body: JSON.stringify([{ conversation_id: conversationId, username: person.username, full_name: person.fullName || person.name || "", role: person.role || "" }]),
  });
  if (!sbOk(result)) return { __error: true, message: "خطا در افزودن عضو: " + (result?.message || "نامشخص") };
  return { ok: true };
}

// ---------- خروج از گفتگو (پیمانکار/کارفرما/ادمین — هرکسی می‌تواند خودش را از یک مکالمه خارج کند) ----------

// یک پیام سیستمی («X گفتگو را ترک کرد») برای بقیه‌ی اعضا ثبت می‌شود، سپس
// عضویت خودِ کاربر حذف می‌شود — یعنی از این به بعد آن مکالمه دیگر توی
// لیست او ظاهر نمی‌شود، ولی برای بقیه‌ی اعضا (با تاریخچه‌ی کامل) باقی می‌ماند.
export async function leaveConversation(conversationId, me) {
  const sysPayload = {
    conversation_id: conversationId,
    sender_username: me.username || "",
    sender_name: me.name || "",
    sender_role: me.role || "",
    body: `${me.name || me.username} گفتگو را ترک کرد`,
    is_system: true,
  };
  await sb("chat_messages", { method: "POST", body: JSON.stringify([sysPayload]), prefer: "return=minimal" });

  const result = await sb(`chat_participants?conversation_id=eq.${conversationId}&username=eq.${encodeURIComponent(me.username)}`, { method: "DELETE" });
  if (!sbOk(result)) return { __error: true, message: "خطا در خروج از گفتگو: " + (result?.message || "نامشخص") };
  return { ok: true };
}

// خودترمیم‌شونده: اگر به هر دلیلی (مثلاً شکست گذشته‌ی درج اعضا هنگام ساخت
// مکالمه) ردیف عضویت این کاربر برای این مکالمه وجود نداشته باشد، PATCH چیزی
// را تغییر نمی‌دهد و «دیده‌شدن» برای همیشه ثبت نمی‌شود — دقیقاً همان چیزی که
// باعث می‌شد تیک دوم برای بعضی کاربران (مثلاً پیمانکار) هیچ‌وقت ظاهر نشود.
// این نسخه ابتدا وجود عضویت را چک می‌کند؛ اگر نبود، همان لحظه می‌سازدش.
export async function markConversationRead(conversationId, username) {
  console.log("[chat] markConversationRead: شروع", { conversationId, username });
  const existing = await sb(`chat_participants?conversation_id=eq.${conversationId}&username=eq.${encodeURIComponent(username)}&select=id`);
  console.log("[chat] markConversationRead: عضویت موجود؟", existing);
  if (sbOk(existing) && existing.length > 0) {
    const patchResult = await sb(`chat_participants?id=eq.${existing[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({ last_read_at: new Date().toISOString() }),
    });
    console.log("[chat] markConversationRead: نتیجه‌ی PATCH last_read_at", patchResult);
    return;
  }
  if (sbOk(existing) && existing.length === 0) {
    // عضویت گم‌شده بود — همین الان ترمیمش کن (نیاز به نام/نقش کامل نیست؛
    // پیام‌های موجود همچنان بر اساس sender_username نمایش داده می‌شوند)
    console.warn("[chat] markConversationRead: عضویتی پیدا نشد — در حال ترمیم خودکار");
    const repairResult = await sb("chat_participants", {
      method: "POST",
      body: JSON.stringify([{ conversation_id: conversationId, username, last_read_at: new Date().toISOString() }]),
    });
    console.log("[chat] markConversationRead: نتیجه‌ی ترمیم خودکار", repairResult);
  }
}

// ---------- آمار خلاصه برای زنگوله‌ی اعلان ----------

export async function loadUnreadTotal(username) {
  const convs = await loadMyConversations(username);
  const total = convs.reduce((sum, c) => sum + c.unreadCount, 0);
  console.log("[chat] loadUnreadTotal:", username, "→", total);
  return total;
}
