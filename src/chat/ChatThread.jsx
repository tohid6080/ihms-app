import React, { useState, useEffect, useRef } from "react";
import { Send, Paperclip, Users as UsersIcon, Check, CheckCheck, LogOut } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { toJalaliDateTime } from "../personnel/jalaliDate.jsx";
import { isPdfDataUrl, fileToBase64 } from "../personnel/fileHelpers.js";
import DocumentViewerModal from "../personnel/DocumentViewerModal.jsx";
import { loadMessages, loadParticipants, sendMessage, markConversationRead, leaveConversation } from "./chatApi.js";

const MSG_POLL_MS = 4000;

export default function ChatThread({ conversationId, currentUser, onBack }) {
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [viewerSrc, setViewerSrc] = useState(null);
  const bottomRef = useRef(null);
  const me = { username: currentUser?.username, name: currentUser?.name, role: currentUser?.role };

  const handleLeave = async () => {
    if (!confirm("از این گفتگو خارج می‌شوی؛ دیگر توی لیست چت‌هایت نمایش داده نمی‌شود. ادامه می‌دهی؟")) return;
    setLeaving(true);
    const result = await leaveConversation(conversationId, me);
    setLeaving(false);
    if (result?.__error) { alert(result.message); return; }
    onBack();
  };

  const load = async (scrollToBottom) => {
    console.log("[chat-ui] ChatThread.load: شروع برای مکالمه", conversationId);
    const [msgs, parts] = await Promise.all([loadMessages(conversationId), loadParticipants(conversationId)]);
    console.log("[chat-ui] ChatThread.load: پیام‌ها =", msgs.length, "شرکت‌کنندگان =", parts.length, { msgs, parts });
    setMessages(msgs);
    setParticipants(parts);
    markConversationRead(conversationId, me.username);
    if (scrollToBottom) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  useEffect(() => { load(true); }, [conversationId]);
  useEffect(() => {
    const t = setInterval(() => load(false), MSG_POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const handleSend = async (attachment) => {
    if (!attachment && !text.trim()) return;
    if (sending) return;
    console.log("[chat-ui] handleSend: شروع", { conversationId, hasAttachment: !!attachment, textLength: text.trim().length });
    setSending(true);
    setError("");
    const body = text.trim();
    setText("");
    const result = await sendMessage(conversationId, me, body, attachment);
    console.log("[chat-ui] handleSend: نتیجه", result);
    setSending(false);
    if (result?.__error) { console.error("[chat-ui] handleSend: خطا", result.message); setError(result.message); return; }
    await load(true);
  };

  const handleAttach = async (file) => {
    if (!file) return;
    let base64;
    try {
      base64 = await fileToBase64(file);
    } catch (e) {
      setError(e?.message || "خطا در خواندن فایل");
      return;
    }
    await handleSend({ data: base64, mimeType: file.type, name: file.name });
  };

  const other = participants.find((p) => p.username !== me.username);
  const isGroup = participants.length > 2;
  const title = isGroup ? `گروه (${participants.length} عضو)` : (other?.fullName || "گفتگو");

  // آخرین پیام هرکس دیگری که last_read_at آن بعد از این پیام باشد یعنی خوانده
  const isReadByOthers = (msg) => participants.some((p) => p.username !== me.username && p.lastReadAt && new Date(p.lastReadAt) >= new Date(msg.createdAt));

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24, display: "flex", flexDirection: "column", height: "calc(100vh - 48px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={styles.backLink} onClick={onBack}>← بازگشت</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: "auto" }}>
          {isGroup && <UsersIcon size={15} color={THEME.text3} />}
          <span style={{ fontWeight: 700, color: THEME.navy, fontSize: 14.5 }}>{title}</span>
        </div>
        <button type="button" onClick={handleLeave} disabled={leaving} title="خروج از گفتگو" style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center" }}>
          <LogOut size={16} color={THEME.danger} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", background: THEME.bg, borderRadius: 10, padding: 14, marginBottom: 10 }}>
        {messages.length === 0 && <p style={{ color: THEME.text3, textAlign: "center", padding: 20 }}>هنوز پیامی ارسال نشده — اولین پیام را بفرست</p>}
        {messages.map((m) => {
          if (m.isSystem) {
            return (
              <div key={m.id} style={{ textAlign: "center", margin: "10px 0" }}>
                <span style={{ fontSize: 11, color: THEME.text3, background: "#eef1f5", padding: "4px 10px", borderRadius: 999 }}>{m.body}</span>
              </div>
            );
          }
          const isMine = m.senderUsername === me.username;
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", marginBottom: 10 }}>
              {!isMine && isGroup && <span style={{ fontSize: 10.5, color: THEME.text3, marginBottom: 2 }}>{m.senderName}</span>}
              <div style={{ maxWidth: "75%", background: isMine ? THEME.teal : "#fff", color: isMine ? "#fff" : THEME.text, borderRadius: 12, padding: "8px 12px", border: isMine ? "none" : `1px solid ${THEME.border}` }}>
                {m.attachmentUrl && (
                  isPdfDataUrl(m.attachmentUrl) || (m.attachmentType || "").includes("pdf") ? (
                    <a href={m.attachmentUrl} target="_blank" rel="noreferrer" style={{ color: isMine ? "#fff" : THEME.teal, fontSize: 12.5, textDecoration: "underline" }}>📎 {m.attachmentName || "فایل PDF"}</a>
                  ) : (
                    <img src={m.attachmentUrl} alt={m.attachmentName} onClick={() => setViewerSrc(m.attachmentUrl)} style={{ maxWidth: 200, borderRadius: 8, cursor: "pointer", display: "block", marginBottom: m.body ? 6 : 0 }} />
                  )
                )}
                {m.body && <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{m.body}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                <span style={{ fontSize: 9.5, color: THEME.text3 }}>{toJalaliDateTime(m.createdAt)}</span>
                {isMine && (isReadByOthers(m) ? <CheckCheck size={12} color={THEME.teal} /> : <Check size={12} color={THEME.text3} />)}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p style={{ ...styles.error, marginBottom: 8 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ ...styles.smallButton, background: THEME.navyMid, display: "flex", alignItems: "center", justifyContent: "center", padding: "9px 11px", cursor: "pointer", position: "relative", overflow: "hidden" }}>
          <Paperclip size={15} />
          <input type="file" accept="image/*,application/pdf" style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} onChange={(e) => { handleAttach(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <input
          style={{ ...styles.input, flex: 1 }} placeholder="پیام بنویس..." value={text}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} dir="rtl"
        />
        <button type="button" style={{ ...styles.smallButton, padding: "9px 14px" }} onClick={() => handleSend()} disabled={sending || !text.trim()}>
          <Send size={15} />
        </button>
      </div>

      {viewerSrc && <DocumentViewerModal src={viewerSrc} onClose={() => setViewerSrc(null)} />}
    </div>
  );
}
