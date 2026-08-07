import React, { useState, useEffect } from "react";
import { MessageCircle, Plus, Users, Paperclip, Trash2 } from "lucide-react";
import { styles, THEME } from "../shared.js";
import { toJalaliDateTime } from "../personnel/jalaliDate.jsx";
import { loadMyConversations, loadChatDirectory, findOrCreateDirectConversation, createConversation, deleteConversationForMe } from "./chatApi.js";
import ChatThread from "./ChatThread.jsx";

const ROLE_LABEL = { ADMIN: "ادمین", EMPLOYER: "کارفرما", CONTRACTOR: "پیمانکار" };

export default function ChatDashboard({ onBack, currentUser }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openConvId, setOpenConvId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [directory, setDirectory] = useState([]);
  const [newMode, setNewMode] = useState("direct"); // 'direct' | 'group'
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    console.log("[chat-ui] ChatDashboard.load: شروع برای", currentUser.username);
    setLoading(true);
    const list = await loadMyConversations(currentUser.username);
    console.log("[chat-ui] ChatDashboard.load: تعداد مکالمات دریافتی =", list.length, list);
    setConversations(list);
    setLoading(false);
  };
  const silentRefresh = async () => {
    setConversations(await loadMyConversations(currentUser.username));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(silentRefresh, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = currentUser?.role === "ADMIN";

  const openNew = async () => {
    setShowNew(true);
    setNewMode("direct");
    setGroupTitle("");
    setSelectedPeople([]);
    setDirectory((await loadChatDirectory(currentUser.role, currentUser.jobPositionId)).filter((p) => p.username !== currentUser.username));
  };

  const startDirect = async (person) => {
    console.log("[chat-ui] startDirect: شروع گفتگو با", person);
    setCreating(true);
    const convId = await findOrCreateDirectConversation(currentUser, person.username, person.name, person.role);
    console.log("[chat-ui] startDirect: نتیجه", convId);
    setCreating(false);
    if (convId?.__error) { console.error("[chat-ui] startDirect: خطا", convId.message); alert(convId.message); return; }
    setShowNew(false);
    setOpenConvId(convId);
    await load();
  };

  const togglePerson = (person) => {
    setSelectedPeople((prev) => (prev.some((p) => p.username === person.username) ? prev.filter((p) => p.username !== person.username) : [...prev, person]));
  };

  const startGroup = async () => {
    if (!isAdmin) { alert("فقط ادمین می‌تواند گروه جدید بسازد"); return; }
    if (!groupTitle.trim() || selectedPeople.length === 0) return;
    console.log("[chat-ui] startGroup: شروع", { title: groupTitle.trim(), people: selectedPeople });
    setCreating(true);
    const convId = await createConversation(currentUser, "group", { title: groupTitle.trim(), participants: selectedPeople });
    console.log("[chat-ui] startGroup: نتیجه", convId);
    setCreating(false);
    if (convId?.__error) { console.error("[chat-ui] startGroup: خطا", convId.message); alert(convId.message); return; }
    setShowNew(false);
    setOpenConvId(convId);
    await load();
  };

  // حذف گفتگو فقط از پنل خودِ کاربر — بی‌صدا، بدون تاثیر روی طرف مقابل یا پیام‌ها
  const handleDeleteConversation = async (e, conversationId) => {
    e.stopPropagation();
    if (!confirm("آیا از حذف این گفتگو مطمئن هستید؟")) return;
    const result = await deleteConversationForMe(conversationId, currentUser.username);
    if (result?.__error) { alert(result.message); return; }
    await load();
  };

  if (openConvId) {
    return (
      <ChatThread
        conversationId={openConvId}
        currentUser={currentUser}
        onBack={() => { setOpenConvId(null); load(); }}
      />
    );
  }

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: THEME.text3 }}>در حال بارگذاری...</div>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MessageCircle size={20} color={THEME.teal} />
          <h2 style={{ margin: 0, fontSize: 19, color: THEME.navy, fontWeight: 700 }}>چت</h2>
        </div>
        <button type="button" style={{ ...styles.smallButton, display: "flex", alignItems: "center", gap: 6 }} onClick={openNew}>
          <Plus size={14} /> گفتگوی جدید
        </button>
      </div>

      {showNew && (
        <div style={{ ...styles.card, width: "auto", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button type="button" style={{ ...styles.smallButton, background: newMode === "direct" ? THEME.teal : THEME.text3 }} onClick={() => setNewMode("direct")}>گفتگوی مستقیم</button>
            {isAdmin && (
              <button type="button" style={{ ...styles.smallButton, background: newMode === "group" ? THEME.teal : THEME.text3 }} onClick={() => setNewMode("group")}>گروه جدید</button>
            )}
          </div>

          {newMode === "direct" && (
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {directory.map((p) => (
                <div key={p.username} onClick={() => startDirect(p)} style={{ padding: "8px 6px", borderBottom: `1px solid ${THEME.border}`, cursor: "pointer", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13 }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: THEME.text3 }}>{ROLE_LABEL[p.role] || p.role}</span>
                </div>
              ))}
              {directory.length === 0 && <p style={{ fontSize: 12, color: THEME.text3 }}>همکاری برای گفتگو یافت نشد</p>}
            </div>
          )}

          {newMode === "group" && isAdmin && (
            <>
              <input style={styles.input} placeholder="نام گروه" value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} dir="rtl" />
              <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 8 }}>
                {directory.map((p) => {
                  const selected = selectedPeople.some((s) => s.username === p.username);
                  return (
                    <div key={p.username} onClick={() => togglePerson(p)} style={{ padding: "8px 6px", borderBottom: `1px solid ${THEME.border}`, cursor: "pointer", display: "flex", justifyContent: "space-between", background: selected ? THEME.tealSoft : "transparent" }}>
                      <span style={{ fontSize: 13 }}>{p.name}</span>
                      <span style={{ fontSize: 11, color: THEME.text3 }}>{ROLE_LABEL[p.role] || p.role}</span>
                    </div>
                  );
                })}
              </div>
              <button type="button" style={{ ...styles.button, marginTop: 10 }} onClick={startGroup} disabled={creating || !groupTitle.trim() || selectedPeople.length === 0}>
                {creating ? "در حال ساخت..." : `ساخت گروه (${selectedPeople.length} عضو)`}
              </button>
            </>
          )}

          <div style={styles.backLink} onClick={() => setShowNew(false)}>انصراف</div>
        </div>
      )}

      {conversations.length === 0 && !showNew && (
        <p style={{ color: THEME.text3, textAlign: "center", padding: "30px 0" }}>هنوز گفتگویی نداری — «گفتگوی جدید» را بزن.</p>
      )}

      {conversations.map((c) => {
        const otherPerson = c.type === "direct" ? c.participants.find((p) => p.username !== currentUser.username) : null;
        const displayTitle = c.type === "direct" ? (otherPerson?.fullName || otherPerson?.username || "کاربر") : (c.title || c.linkedLabel || "گروه");
        return (
          <div key={c.id} onClick={() => setOpenConvId(c.id)} style={{ ...styles.card, width: "auto", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: c.type === "group" ? THEME.navyMid : THEME.teal, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {c.type === "group" ? <Users size={16} color="#fff" /> : <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{displayTitle.charAt(0)}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: THEME.navy }}>{displayTitle}</span>
                {c.lastMessage && <span style={{ fontSize: 10, color: THEME.text3 }}>{toJalaliDateTime(c.lastMessage.createdAt)}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                {c.lastMessage?.attachmentUrl && <Paperclip size={11} color={THEME.text3} />}
                <span style={{ fontSize: 11.5, color: THEME.text3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.lastMessage ? (c.lastMessage.body || "پیوست") : "هنوز پیامی نیست"}
                </span>
              </div>
            </div>
            {c.unreadCount > 0 && (
              <span style={{ background: THEME.danger, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                {c.unreadCount}
              </span>
            )}
            <button
              type="button"
              title="حذف گفتگو"
              onClick={(e) => handleDeleteConversation(e, c.id)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", flexShrink: 0 }}
            >
              <Trash2 size={14} color={THEME.text3} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
