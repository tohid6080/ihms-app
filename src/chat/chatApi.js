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

export async function loadChatDirectory() {
  const companyId = getCurrentCompanyId();
  const filter = companyId ? `&company_id=eq.${companyId}` : "";
  const [employers, contractors] = await Promise.all([
    sb(`employer_accounts?select=username,name,role${filter}`),
    sb(`contractors?select=username,name${filter}`),
  ]);
  const people = [];
  if (sbOk(employers)) employers.forEach((e) => { if (e.username) people.push({ username: e.username, name: e.name, role: e.role === "admin" ? "ADMIN" : "EMPLOYER" }); });
  if (sbOk(contractors)) contractors.forEach((c) => { if (c.username) people.push({ username: c.username, name: c.name, role: "CONTRACTOR" }); });
  return people;
}

// ---------- مکالمات کاربر جاری ----------

export async function loadMyConversations(username) {
  const partRows = await sb(`chat_participants?username=eq.${encodeURIComponent(username)}&select=*`);
  if (!sbOk(partRows) || partRows.length === 0) return [];
  const convIds = partRows.map((p) => p.conversation_id);
  const myParticipant = {};
  partRows.forEach((p) => { myParticipant[p.conversation_id] = participantFromRow(p); });

  const convRows = await sb(`chat_conversations?id=in.(${convIds.join(",")})&select=*&order=updated_at.desc`);
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

  return conversations.map((c) => ({
    ...c,
    participants: participantsByConv[c.id] || [],
    lastMessage: lastMessageByConv[c.id] || null,
    unreadCount: unreadCountByConv[c.id] || 0,
  })).sort((a, b) => {
    const at = a.lastMessage?.createdAt || a.createdAt;
    const bt = b.lastMessage?.createdAt || b.createdAt;
    return bt.localeCompare(at);
  });
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
  if (!sbOk(rows)) return { __error: true, message: "خطا در ساخت مکالمه: " + (rows?.message || "نامشخص") };
  const conv = rows[0];

  const allParticipants = [
    { username: me.username, fullName: me.name, role: me.role },
    ...(participants || []),
  ];
  const uniqueByUsername = Object.values(
    allParticipants.reduce((acc, p) => { if (p.username) acc[p.username] = p; return acc; }, {})
  );
  await sb("chat_participants", {
    method: "POST",
    body: JSON.stringify(uniqueByUsername.map((p) => ({
      conversation_id: conv.id, username: p.username, full_name: p.fullName || p.name || "", role: p.role || "",
    }))),
    prefer: "return=minimal",
  });

  return conv.id;
}

// ---------- یافتن (یا ساخت) مکالمه‌ی متصل به یک آنومالی/BowTie ----------

export async function findOrCreateLinkedConversation(me, linkedModule, linkedId, linkedLabel, initialParticipants) {
  const existing = await sb(`chat_conversations?linked_module=eq.${linkedModule}&linked_id=eq.${encodeURIComponent(linkedId)}&select=id&limit=1`);
  if (sbOk(existing) && existing.length > 0) {
    // مطمئن شو کاربر جاری هم عضو است (ممکن است بعداً به بحث اضافه شده باشد)
    const already = await sb(`chat_participants?conversation_id=eq.${existing[0].id}&username=eq.${encodeURIComponent(me.username)}&select=id`);
    if (!sbOk(already) || already.length === 0) {
      await sb("chat_participants", {
        method: "POST",
        body: JSON.stringify([{ conversation_id: existing[0].id, username: me.username, full_name: me.name, role: me.role }]),
        prefer: "return=minimal",
      });
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
  return sbOk(rows) ? rows.map(msgFromRow) : [];
}

export async function sendMessage(conversationId, me, body, attachment) {
  let attachmentUrl = "", attachmentName = "", attachmentType = "";
  if (attachment) {
    try {
      const ext = (attachment.mimeType || "").includes("pdf") ? "pdf" : (attachment.mimeType || "").split("/")[1] || "jpg";
      const path = `${conversationId}/${uid("msg")}.${ext}`;
      attachmentUrl = await uploadBase64ToStorage("chat-attachments", path, attachment.data, attachment.mimeType);
      attachmentName = attachment.name || "";
      attachmentType = attachment.mimeType || "";
    } catch (e) {
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
  if (!sbOk(rows)) return { __error: true, message: "خطا در ارسال پیام: " + (rows?.message || "نامشخص") };
  await sb(`chat_conversations?id=eq.${conversationId}`, { method: "PATCH", body: JSON.stringify({ updated_at: new Date().toISOString() }), prefer: "return=minimal" });
  return msgFromRow(rows[0]);
}

export async function loadParticipants(conversationId) {
  const rows = await sb(`chat_participants?conversation_id=eq.${conversationId}&select=*`);
  return sbOk(rows) ? rows.map(participantFromRow) : [];
}

export async function addParticipant(conversationId, person) {
  await sb("chat_participants", {
    method: "POST",
    body: JSON.stringify([{ conversation_id: conversationId, username: person.username, full_name: person.fullName || person.name || "", role: person.role || "" }]),
    prefer: "return=minimal",
  });
}

// ---------- علامت‌گذاری خوانده‌شدن ----------

export async function markConversationRead(conversationId, username) {
  await sb(`chat_participants?conversation_id=eq.${conversationId}&username=eq.${encodeURIComponent(username)}`, {
    method: "PATCH",
    body: JSON.stringify({ last_read_at: new Date().toISOString() }),
    prefer: "return=minimal",
  });
}

// ---------- آمار خلاصه برای زنگوله‌ی اعلان ----------

export async function loadUnreadTotal(username) {
  const convs = await loadMyConversations(username);
  return convs.reduce((sum, c) => sum + c.unreadCount, 0);
}
