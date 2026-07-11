import React, { useState, useEffect } from "react";
import { AlertTriangle, Plus, X, ChevronRight, LogOut, Search, Filter, CheckCircle2, Clock, Camera, ImagePlus, Trash2 } from "lucide-react";

/**
 * اپلیکیشن کارفرما / پیمانکار / ادمین + ماژول ثبت و پیگیری آنومالی HSE
 * داده‌ها روی دیتابیس واقعی Supabase (Postgres) ذخیره می‌شوند تا مستقل از artifact و پایدار بمانند.
 */

// ---------- نوع نقش‌ها ----------
// Role: "ADMIN" | "EMPLOYER" | "CONTRACTOR"

const SEED_USERS = [
  { id: "admin-1", username: "admin", password: "Admin@123", role: "ADMIN" },
  { id: "emp-1", username: "karfarma", password: "1234", role: "EMPLOYER" },
];

const RISK_LEVELS = [
  { value: "High", label: "بالا (High)", color: "#dc2626", bg: "#fee2e2" },
  { value: "Med", label: "متوسط (Med)", color: "#d97706", bg: "#fef3c7" },
  { value: "Low", label: "پایین (Low)", color: "#16a34a", bg: "#dcfce7" },
];

const ANOMALY_CATEGORIES = [
  "ماشین آلات", "Hygiene", "Environment", "Lifting", "PPE", "Work at Height",
  "جوشکاری و برشکاری", "Scaffolding", "Excavation", "House Keeping", "Fire",
  "Lighting", "Electricity", "Meeting", "Access Way", "Permit",
];

const ANOMALY_FORMATS = [
  "بازرسی", "مدیریت تغییر", "عوامل زیان‌آور محیط کار", "ممیزی", "معاینات ادواری", "گزارش روزانه", "سایر",
];

const APP_NAME = "Integrated HSE Management System";

// ترتیب ماژول‌های سامانه IHMS طبق نقشه‌ی راه پروژه.
// فقط "مدیریت عدم انطباق‌ها (Anomaly Report)" و "ایجاد حساب کاربری" فعلاً پیاده‌سازی شده‌اند؛
// بقیه به‌عنوان جای‌نگه‌دار (Placeholder) نمایش داده می‌شوند تا در فازهای بعدی توسعه یابند.
const HSE_MODULES = [
  { key: "profile", label: "پروفایل من" },
  {
    key: "manageUsers",
    label: "ایجاد حساب کاربری برای پیمانکاران",
    employerOnly: true,
    sub: [
      { key: "manageUsersAccounts", label: "ثبت/ویرایش حساب کاربری پیمانکار" },
      { key: "manageContractorInfo", label: "اطلاعات و قرارداد پیمانکاران" },
    ],
  },
  {
    key: "anomalyReport",
    label: "مدیریت عدم انطباق‌ها (Anomaly Report)",
    icon: true,
    sub: [
      { key: "anomalyForm", label: "ثبت آنومالی", employerOnly: true },
      { key: "anomalyList", label: "لیست آنومالی‌ها" },
    ],
  },
  { key: "incident", label: "مدیریت حوادث (Incident Management)" },
  { key: "nearMiss", label: "مدیریت شبه‌حوادث (Near Miss)" },
  { key: "capa", label: "مدیریت اقدامات اصلاحی و پیشگیرانه (CAPA)" },
  { key: "riskAssessment", label: "مدیریت ارزیابی ریسک (Risk Assessment)" },
  { key: "hazards", label: "مدیریت عوامل زیان‌آور محیط کار" },
  { key: "occupationalHealth", label: "مدیریت معاینات طب کار" },
  { key: "training", label: "مدیریت آموزش‌های HSE" },
  { key: "permit", label: "مدیریت مجوزهای کار (Permit to Work)" },
  { key: "ppe", label: "مدیریت تجهیزات حفاظت فردی (PPE)" },
  { key: "audit", label: "مدیریت ممیزی‌ها (Audit Management)" },
  { key: "kpi", label: "مدیریت شاخص‌های عملکرد HSE (KPI Dashboard)" },
  { key: "documents", label: "مدیریت مستندات HSE" },
  { key: "managerDashboard", label: "داشبورد مدیریتی و گزارش‌های تحلیلی" },
];

// ---------- لایه ذخیره‌سازی (Supabase REST API) ----------
// نکته امنیتی: فقط از کلید publishable/anon استفاده می‌شود، هرگز کلید secret را
// داخل کد سمت مرورگر قرار ندهید چون هرکسی که اپ را باز کند می‌تواند آن را ببیند.
const SUPABASE_URL = "https://oyiyxhwvtqpqxolmmcui.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hHpuzRu-1030cKEfCyidpQ_mfhbH050";

async function sb(path, options = {}) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: options.prefer || "return=representation",
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Supabase error", res.status, text);
      return { __error: true, status: res.status, message: text || `HTTP ${res.status}` };
    }
    if (res.status === 204) return [];
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  } catch (e) {
    console.error("Supabase fetch failed", e);
    return { __error: true, status: 0, message: String((e && e.message) || e) };
  }
}

function sbOk(rows) {
  return Array.isArray(rows);
}
function sbErrMsg(rows) {
  if (rows && rows.__error) return rows.message;
  return "خطای نامشخص";
}

// حساب‌های ادمین و کارفرما ثابت هستند و مستقل از دیتابیس بررسی می‌شوند
// تا در صورت هر مشکلی در اتصال، ورود این دو نقش همیشه کار کند.
// دیتابیس فقط حساب‌های پیمانکار (که توسط ادمین/کارفرما ساخته می‌شوند) را نگه می‌دارد.
async function loadContractorUsers() {
  const rows = await sb("contractor_accounts?select=*&order=username.asc");
  return sbOk(rows) ? rows : [];
}
async function insertContractorUser(user) {
  const rows = await sb("contractor_accounts", { method: "POST", body: JSON.stringify([{ username: user.username, password: user.password, role: "CONTRACTOR" }]) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return rows[0];
}
async function updateContractorUserDB(id, patch) {
  await sb(`contractor_accounts?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch), prefer: "return=minimal" });
}
async function deleteContractorUserDB(id) {
  await sb(`contractor_accounts?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
}

async function loadContractorRecords() {
  const rows = await sb("contractors?select=*&order=name.asc");
  return (sbOk(rows) ? rows : []).map((r) => ({ id: r.id, name: r.name, startDate: r.start_date || "", contractDetails: r.contract_details || "" }));
}
async function insertContractorRecord(rec) {
  const rows = await sb("contractors", { method: "POST", body: JSON.stringify([{ name: rec.name, start_date: rec.startDate, contract_details: rec.contractDetails }]) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  const r = rows[0];
  return { id: r.id, name: r.name, startDate: r.start_date || "", contractDetails: r.contract_details || "" };
}
async function deleteContractorRecordDB(id) {
  await sb(`contractors?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
}

function anomalyFromRow(r) {
  return {
    id: r.id,
    trackingNumber: r.tracking_number || "",
    project: r.project || "",
    contractor: r.contractor || "",
    subContractor: r.sub_contractor || "",
    area: r.area || "",
    date: r.date || "",
    time: r.time || "",
    riskLevel: r.risk_level || "Med",
    category: r.category || "",
    format: r.format || "",
    description: r.description || "",
    correctiveAction: r.corrective_action || "",
    obstacles: r.obstacles || "",
    follower: r.follower || "",
    sender: r.sender || "",
    status: r.status || "open",
    closeDate: r.close_date || "",
    effectiveness: r.effectiveness || "",
    photoCount: r.photo_count || 0,
    contractorAction: r.contractor_action || "",
    reviewNote: r.review_note || "",
    createdAt: r.created_at,
  };
}

async function loadAnomalies() {
  const rows = await sb("anomalies?select=*&order=created_at.desc");
  return (sbOk(rows) ? rows : []).map(anomalyFromRow);
}

async function insertAnomaly(record) {
  const body = [{
    id: record.id,
    tracking_number: record.trackingNumber,
    project: record.project,
    contractor: record.contractor,
    sub_contractor: record.subContractor,
    area: record.area,
    date: record.date || null,
    time: record.time,
    risk_level: record.riskLevel,
    category: record.category,
    format: record.format,
    description: record.description,
    corrective_action: record.correctiveAction,
    obstacles: record.obstacles,
    follower: record.follower,
    sender: record.sender,
    status: record.status,
    close_date: record.closeDate || null,
    effectiveness: record.effectiveness,
    photo_count: record.photoCount,
  }];
  const rows = await sb("anomalies", { method: "POST", body: JSON.stringify(body) });
  if (!sbOk(rows)) return { __error: true, message: sbErrMsg(rows) };
  return rows[0];
}

async function updateAnomalyDB(id, patch) {
  const dbPatch = {};
  if ("correctiveAction" in patch) dbPatch.corrective_action = patch.correctiveAction;
  if ("obstacles" in patch) dbPatch.obstacles = patch.obstacles;
  if ("follower" in patch) dbPatch.follower = patch.follower;
  if ("status" in patch) dbPatch.status = patch.status;
  if ("closeDate" in patch) dbPatch.close_date = patch.closeDate || null;
  if ("effectiveness" in patch) dbPatch.effectiveness = patch.effectiveness;
  if ("photoCount" in patch) dbPatch.photo_count = patch.photoCount;
  if ("contractorAction" in patch) dbPatch.contractor_action = patch.contractorAction;
  if ("reviewNote" in patch) dbPatch.review_note = patch.reviewNote;
  await sb(`anomalies?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(dbPatch), prefer: "return=minimal" });
}

async function deleteAnomalyDB(id) {
  await sb(`anomalies?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
}

async function loadAnomalyPhotos(anomalyId) {
  const rows = await sb(`anomaly_photos?anomaly_id=eq.${anomalyId}&select=id,photo,stage&order=created_at.asc`);
  return sbOk(rows) ? rows : [];
}
async function insertAnomalyPhotos(anomalyId, photosArray, stage = "report") {
  if (!photosArray.length) return;
  const body = photosArray.map((p) => ({ anomaly_id: anomalyId, photo: p, stage }));
  await sb("anomaly_photos", { method: "POST", body: JSON.stringify(body), prefer: "return=minimal" });
}
async function deleteAnomalyPhotoDB(photoId) {
  await sb(`anomaly_photos?id=eq.${photoId}`, { method: "DELETE", prefer: "return=minimal" });
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// عکس گرفته‌شده با دوربین/گالری را کوچک می‌کند تا حجم ذخیره‌سازی معقول بماند
function resizeImageFile(file, maxDim = 1280, quality = 0.72) {
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
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---------- صفحه ورود ----------
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);

    // ابتدا حساب‌های ثابت ادمین/کارفرما بررسی می‌شوند (بدون نیاز به storage)
    const seedMatch = SEED_USERS.find((u) => u.username === username.trim() && u.password === password);
    if (seedMatch) {
      setLoading(false);
      setError("");
      onLogin(seedMatch);
      return;
    }

    // سپس حساب‌های پیمانکار که در storage ذخیره شده‌اند بررسی می‌شوند
    const contractorUsers = await loadContractorUsers();
    const found = contractorUsers.find((u) => u.username === username.trim() && u.password === password);
    setLoading(false);
    if (found) {
      setError("");
      onLogin(found);
    } else {
      setError("نام کاربری یا رمز عبور اشتباه است");
    }
  };

  return (
    <div style={styles.centerScreen}>
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <div style={styles.brandBadge}>
            <AlertTriangle size={22} color="#fff" />
          </div>
        </div>
        <h2 style={{ textAlign: "center", marginBottom: 2, fontSize: 19, direction: "ltr" }}>{APP_NAME}</h2>
        <p style={{ textAlign: "center", color: "#888", fontSize: 13, marginTop: 0, marginBottom: 20 }}>
          ورود به سامانه
        </p>

        <label style={styles.label}>نام کاربری</label>
        <input style={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} dir="rtl" />

        <label style={styles.label}>رمز عبور</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          dir="rtl"
        />

        {error && <p style={styles.error}>{error}</p>}

        <button type="button" style={styles.button} onClick={handleSubmit} disabled={loading}>
          {loading ? "در حال بررسی..." : "ورود"}
        </button>

        <p style={styles.hint}>Designed by: Tohid Mirasadi</p>
      </div>
    </div>
  );
}

// ---------- پروفایل کاربر ----------
function ProfileView({ onBack, currentUser, roleLabel }) {
  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}
      <div style={{ ...styles.card, width: "auto" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div style={styles.brandBadge}>
            <AlertTriangle size={22} color="#fff" />
          </div>
        </div>
        <h3 style={{ textAlign: "center", marginBottom: 4 }}>{currentUser?.username}</h3>
        <p style={{ textAlign: "center", color: "#888", fontSize: 13, marginTop: 0 }}>{roleLabel}</p>
        <p style={{ textAlign: "center", color: "#aaa", fontSize: 11, marginTop: 20, direction: "ltr" }}>{APP_NAME}</p>
      </div>
    </div>
  );
}

// ---------- مدیریت حساب‌های کاربری پیمانکار ----------
function ContractorAccountManager({ onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");

  useEffect(() => {
    (async () => {
      setUsers(await loadContractorUsers());
      setLoading(false);
    })();
  }, []);

  const contractors = users;

  const handleAddContractor = async () => {
    const uname = newUsername.trim();
    if (!uname || !newPassword) { setFormError("نام کاربری و رمز عبور را وارد کنید"); return; }
    if (SEED_USERS.some((u) => u.username === uname) || users.some((u) => u.username === uname)) { setFormError("این نام کاربری قبلاً استفاده شده است"); return; }

    const inserted = await insertContractorUser({ username: uname, password: newPassword });
    if (!inserted || inserted.__error) { setFormError(`خطا در ذخیره‌سازی: ${inserted?.message || "نامشخص"}`); return; }
    setUsers([...users, inserted]);
    setNewUsername(""); setNewPassword(""); setFormError(""); setShowForm(false);
  };

  const startEdit = (user) => {
    setEditingId(user.id); setEditUsername(user.username); setEditPassword(user.password);
  };
  const cancelEdit = () => { setEditingId(null); setEditUsername(""); setEditPassword(""); };

  const saveEdit = async (id) => {
    const uname = editUsername.trim();
    if (!uname || !editPassword) { alert("نام کاربری و رمز عبور نمی‌توانند خالی باشند"); return; }
    if (SEED_USERS.some((u) => u.username === uname) || users.some((u) => u.username === uname && u.id !== id)) { alert("این نام کاربری قبلاً برای کاربر دیگری استفاده شده است"); return; }
    await updateContractorUserDB(id, { username: uname, password: editPassword });
    setUsers(users.map((u) => (u.id === id ? { ...u, username: uname, password: editPassword } : u)));
    cancelEdit();
  };

  const handleDelete = async (id, username) => {
    if (confirm(`آیا از حذف حساب کاربری «${username}» مطمئن هستید؟`)) {
      await deleteContractorUserDB(id);
      setUsers(users.filter((u) => u.id !== id));
    }
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "#888" }}>در حال بارگذاری...</div>;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}

      <div style={{ ...styles.menuCard, background: "#2563eb", color: "#fff", textAlign: "center" }} onClick={() => setShowForm((v) => !v)}>
        {showForm ? "بستن فرم" : "+ ایجاد حساب کاربری پیمانکار"}
      </div>

      {showForm && (
        <div style={styles.card}>
          <label style={styles.label}>نام کاربری پیمانکار</label>
          <input style={styles.input} value={newUsername} onChange={(e) => setNewUsername(e.target.value)} dir="rtl" />
          <label style={styles.label}>رمز عبور</label>
          <input style={styles.input} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} dir="rtl" />
          {formError && <p style={styles.error}>{formError}</p>}
          <button type="button" style={styles.button} onClick={handleAddContractor}>ایجاد حساب</button>
        </div>
      )}

      <h3 style={{ marginTop: 24 }}>لیست پیمانکاران ({contractors.length})</h3>
      {contractors.length === 0 && <p style={{ color: "#888" }}>هنوز هیچ پیمانکاری اضافه نشده است.</p>}

      {contractors.map((user) =>
        editingId === user.id ? (
          <div key={user.id} style={styles.card}>
            <label style={styles.label}>نام کاربری</label>
            <input style={styles.input} value={editUsername} onChange={(e) => setEditUsername(e.target.value)} dir="rtl" />
            <label style={styles.label}>رمز عبور</label>
            <input style={styles.input} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} dir="rtl" />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="button" style={styles.button} onClick={() => saveEdit(user.id)}>ذخیره</button>
              <button type="button" style={{ ...styles.button, background: "#999" }} onClick={cancelEdit}>انصراف</button>
            </div>
          </div>
        ) : (
          <div key={user.id} style={styles.userRow}>
            <span>{user.username}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" style={styles.smallButton} onClick={() => startEdit(user)}>تغییر</button>
              <button type="button" style={{ ...styles.smallButton, background: "#dc2626" }} onClick={() => handleDelete(user.id, user.username)}>حذف</button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ---------- اطلاعات پروژه‌ای پیمانکاران (نام، تاریخ شروع، قرارداد) ----------
function ContractorInfoManager({ onBack }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [contractDetails, setContractDetails] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    (async () => {
      setRecords(await loadContractorRecords());
      setLoading(false);
    })();
  }, []);

  const handleAdd = async () => {
    if (!name.trim() || !startDate || !contractDetails.trim()) { setFormError("لطفاً همه فیلدها را پر کنید"); return; }
    const inserted = await insertContractorRecord({ name: name.trim(), startDate, contractDetails: contractDetails.trim() });
    if (!inserted || inserted.__error) { setFormError(`خطا در ذخیره‌سازی: ${inserted?.message || "نامشخص"}`); return; }
    setRecords([...records, inserted]);
    setName(""); setStartDate(""); setContractDetails(""); setFormError(""); setShowForm(false);
  };

  const handleDelete = async (id, recordName) => {
    if (confirm(`آیا از حذف اطلاعات «${recordName}» مطمئن هستید؟`)) {
      await deleteContractorRecordDB(id);
      setRecords(records.filter((r) => r.id !== id));
    }
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "#888" }}>در حال بارگذاری...</div>;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}

      <div style={{ ...styles.menuCard, background: "#2563eb", color: "#fff", textAlign: "center" }} onClick={() => setShowForm((v) => !v)}>
        {showForm ? "بستن فرم" : "+ افزودن پیمانکار جدید"}
      </div>

      {showForm && (
        <div style={styles.card}>
          <label style={styles.label}>نام پیمانکار</label>
          <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} dir="rtl" />
          <label style={styles.label}>تاریخ شروع به کار</label>
          <input style={styles.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <label style={styles.label}>مشخصات قرارداد</label>
          <textarea style={{ ...styles.input, minHeight: 90, resize: "vertical", fontFamily: "inherit" }} value={contractDetails} onChange={(e) => setContractDetails(e.target.value)} dir="rtl" />
          {formError && <p style={styles.error}>{formError}</p>}
          <button type="button" style={styles.button} onClick={handleAdd}>افزودن</button>
        </div>
      )}

      <h3 style={{ marginTop: 24 }}>پیمانکاران ثبت‌شده ({records.length})</h3>
      {records.length === 0 && <p style={{ color: "#888" }}>هنوز هیچ پیمانکاری ثبت نشده است.</p>}

      {records.map((r) => (
        <div key={r.id} style={{ ...styles.card, width: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: "bold", fontSize: 16 }}>{r.name}</div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>تاریخ شروع: {r.startDate}</div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>قرارداد: {r.contractDetails}</div>
            </div>
            <button type="button" style={{ ...styles.smallButton, background: "#dc2626" }} onClick={() => handleDelete(r.id, r.name)}>حذف</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- ثبت آنومالی جدید (بر اساس «فرم آنومالی») ----------
function AnomalyForm({ onBack, currentUser, onSaved }) {
  const [contractorNames, setContractorNames] = useState([]);
  const [project, setProject] = useState("");
  const [contractor, setContractor] = useState("");
  const [subContractor, setSubContractor] = useState("");
  const [area, setArea] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowHM());
  const [riskLevel, setRiskLevel] = useState("Med");
  const [category, setCategory] = useState(ANOMALY_CATEGORIES[0]);
  const [format, setFormat] = useState(ANOMALY_FORMATS[0]);
  const [description, setDescription] = useState("");
  const [follower, setFollower] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);

  const handlePickFiles = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 8 - photos.length);
    if (files.length === 0) return;
    setPhotoBusy(true);
    try {
      const results = await Promise.all(files.map((f) => resizeImageFile(f)));
      setPhotos((prev) => [...prev, ...results]);
    } catch {
      setError("خطا در بارگذاری یکی از عکس‌ها");
    }
    setPhotoBusy(false);
  };

  const removePhoto = (idx) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  useEffect(() => {
    (async () => {
      const records = await loadContractorRecords();
      setContractorNames(records.map((r) => r.name));
    })();
  }, []);

  const handleSubmit = async () => {
    if (!area.trim() || !description.trim()) {
      setError("موقعیت/ناحیه و شرح آنومالی الزامی است");
      return;
    }
    setSaving(true);
    const existing = await loadAnomalies();
    const record = {
      id: uid("anomaly"),
      trackingNumber: trackingNumber.trim() || `A-${String(existing.length + 1).padStart(4, "0")}`,
      project: project.trim(),
      contractor: contractor.trim(),
      subContractor: subContractor.trim(),
      area: area.trim(),
      date,
      time,
      riskLevel,
      category,
      format,
      description: description.trim(),
      correctiveAction: "",
      obstacles: "",
      follower: follower.trim(),
      sender: currentUser?.username || "",
      status: "open",
      closeDate: "",
      effectiveness: "",
      photoCount: photos.length,
    };
    const result = await insertAnomaly(record);
    if (!result || result.__error) {
      setSaving(false);
      setError(`خطا در ذخیره‌سازی: ${result?.message || "نامشخص"}`);
      return;
    }
    if (photos.length > 0) {
      await insertAnomalyPhotos(record.id, photos, "report");
    }
    setSaving(false);
    onSaved ? onSaved() : onBack && onBack();
  };

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}

      <div style={{ ...styles.card, width: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <AlertTriangle size={20} color="#dc2626" />
          <h3 style={{ margin: 0 }}>گزارش شرایط ناایمن / اعمال ناایمن (آنومالی)</h3>
        </div>
        <p style={{ color: "#888", fontSize: 13, marginTop: 4 }}>این قسمت توسط کارفرما تکمیل می‌شود</p>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>پروژه</label>
            <input style={styles.input} value={project} onChange={(e) => setProject(e.target.value)} dir="rtl" />
          </div>
          <div>
            <label style={styles.label}>شماره پیگیری</label>
            <input style={styles.input} placeholder="خودکار در صورت خالی بودن" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} dir="rtl" />
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>پیمانکار</label>
            <input style={styles.input} list="contractor-names" value={contractor} onChange={(e) => setContractor(e.target.value)} dir="rtl" />
            <datalist id="contractor-names">
              {contractorNames.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>
          <div>
            <label style={styles.label}>پیمانکار فرعی</label>
            <input style={styles.input} value={subContractor} onChange={(e) => setSubContractor(e.target.value)} dir="rtl" />
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>موقعیت / ناحیه</label>
            <input style={styles.input} value={area} onChange={(e) => setArea(e.target.value)} dir="rtl" placeholder="مثال: UNIT 74 (RHU)" />
          </div>
          <div>
            <label style={styles.label}>تاریخ</label>
            <input style={styles.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>ساعت</label>
            <input style={styles.input} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div>
            <label style={styles.label}>سطح ریسک</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {RISK_LEVELS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRiskLevel(r.value)}
                  style={{
                    flex: 1, padding: "8px 6px", borderRadius: 8, border: riskLevel === r.value ? `2px solid ${r.color}` : "1px solid #ccc",
                    background: riskLevel === r.value ? r.bg : "#fff", color: r.color, fontSize: 13, cursor: "pointer", fontWeight: riskLevel === r.value ? "bold" : "normal",
                  }}
                >
                  {r.value}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>دسته‌بندی</label>
            <select style={styles.input} value={category} onChange={(e) => setCategory(e.target.value)} dir="rtl">
              {ANOMALY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={styles.label}>فرمت</label>
            <select style={styles.input} value={format} onChange={(e) => setFormat(e.target.value)} dir="rtl">
              {ANOMALY_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        <label style={styles.label}>شرح آنومالی</label>
        <textarea style={{ ...styles.input, minHeight: 100, resize: "vertical", fontFamily: "inherit" }} value={description} onChange={(e) => setDescription(e.target.value)} dir="rtl" />

        <label style={styles.label}>شخص پیگیری‌کننده (اختیاری)</label>
        <input style={styles.input} value={follower} onChange={(e) => setFollower(e.target.value)} dir="rtl" />

        <label style={styles.label}>عکس‌های پیوست ({photos.length}/8)</label>
        <div style={{ display: "flex", gap: 8 }}>
          <label
            style={{
              ...styles.smallButton, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", position: "relative", overflow: "hidden",
              opacity: photoBusy || photos.length >= 8 ? 0.5 : 1, pointerEvents: photoBusy || photos.length >= 8 ? "none" : "auto",
            }}
          >
            <Camera size={16} /> گرفتن عکس
            <input
              type="file"
              accept="image/*"
              capture="environment"
              style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }}
              onChange={(e) => { handlePickFiles(e.target.files); e.target.value = ""; }}
            />
          </label>
          <label
            style={{
              ...styles.smallButton, flex: 1, background: "#475569", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", position: "relative", overflow: "hidden",
              opacity: photoBusy || photos.length >= 8 ? 0.5 : 1, pointerEvents: photoBusy || photos.length >= 8 ? "none" : "auto",
            }}
          >
            <ImagePlus size={16} /> افزودن از گالری
            <input
              type="file"
              accept="image/*"
              multiple
              style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }}
              onChange={(e) => { handlePickFiles(e.target.files); e.target.value = ""; }}
            />
          </label>
        </div>
        {photoBusy && <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>در حال پردازش عکس...</p>}


        {photos.length > 0 && (
          <div style={styles.photoGrid}>
            {photos.map((src, idx) => (
              <div key={idx} style={styles.photoThumbWrap}>
                <img src={src} alt={`پیوست ${idx + 1}`} style={styles.photoThumb} />
                <button type="button" style={styles.photoRemoveBtn} onClick={() => removePhoto(idx)}>
                  <X size={12} color="#fff" />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p style={styles.error}>{error}</p>}

        <button type="button" style={styles.button} onClick={handleSubmit} disabled={saving}>
          {saving ? "در حال ثبت..." : "ثبت آنومالی"}
        </button>
      </div>
    </div>
  );
}

// ---------- لیست و پیگیری آنومالی‌ها ----------
function AnomalyList({ onBack, role }) {
  const isReviewer = role === "EMPLOYER" || role === "ADMIN";
  const isContractor = role === "CONTRACTOR";

  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [draft, setDraft] = useState({});
  const [photosMap, setPhotosMap] = useState({});
  const [photosLoading, setPhotosLoading] = useState(false);
  const [viewerSrc, setViewerSrc] = useState(null);
  const [showManualEdit, setShowManualEdit] = useState(false);
  const [actionText, setActionText] = useState("");
  const [actionPhotos, setActionPhotos] = useState([]);
  const [actionPhotoBusy, setActionPhotoBusy] = useState(false);
  const [actionSaving, setActionSaving] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  const load = async () => {
    setAnomalies(await loadAnomalies());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = anomalies.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (riskFilter !== "all" && a.riskLevel !== riskFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${a.trackingNumber} ${a.contractor} ${a.area} ${a.description} ${a.category}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    total: anomalies.length,
    open: anomalies.filter((a) => a.status === "open").length,
    review: anomalies.filter((a) => a.status === "pending_review").length,
    closed: anomalies.filter((a) => a.status === "Closed").length,
    high: anomalies.filter((a) => a.riskLevel === "High" && a.status !== "Closed").length,
  };

  const resetActionState = () => {
    setShowManualEdit(false);
    setActionText("");
    setActionPhotos([]);
    setShowRejectBox(false);
    setRejectNote("");
  };

  const startExpand = async (a) => {
    if (expandedId === a.id) { setExpandedId(null); resetActionState(); return; }
    setExpandedId(a.id);
    resetActionState();
    setDraft({
      correctiveAction: a.correctiveAction || "",
      obstacles: a.obstacles || "",
      follower: a.follower || "",
      status: a.status || "open",
      closeDate: a.closeDate || "",
      effectiveness: a.effectiveness || "",
    });
    if (a.photoCount > 0 && !photosMap[a.id]) {
      setPhotosLoading(true);
      const photos = await loadAnomalyPhotos(a.id);
      setPhotosMap((prev) => ({ ...prev, [a.id]: photos }));
      setPhotosLoading(false);
    }
  };

  const removeExistingPhoto = async (anomalyId, photoId) => {
    const current = photosMap[anomalyId] || [];
    const updated = current.filter((p) => p.id !== photoId);
    setPhotosMap((prev) => ({ ...prev, [anomalyId]: updated }));
    await deleteAnomalyPhotoDB(photoId);
    await updateAnomalyDB(anomalyId, { photoCount: updated.length });
    setAnomalies(anomalies.map((a) => (a.id === anomalyId ? { ...a, photoCount: updated.length } : a)));
  };

  const saveDraft = async (id) => {
    const patch = {
      ...draft,
      closeDate: draft.status === "Closed" ? (draft.closeDate || todayISO()) : "",
    };
    await updateAnomalyDB(id, patch);
    setAnomalies(anomalies.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setExpandedId(null);
  };

  const handleDelete = async (id, trackingNumber) => {
    if (confirm(`آیا از حذف آنومالی «${trackingNumber}» مطمئن هستید؟`)) {
      await deleteAnomalyDB(id);
      setAnomalies(anomalies.filter((a) => a.id !== id));
    }
  };

  const handleActionPickFiles = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 8 - actionPhotos.length);
    if (files.length === 0) return;
    setActionPhotoBusy(true);
    try {
      const results = await Promise.all(files.map((f) => resizeImageFile(f)));
      setActionPhotos((prev) => [...prev, ...results]);
    } catch {
      // نادیده گرفته می‌شود؛ کاربر می‌تواند دوباره تلاش کند
    }
    setActionPhotoBusy(false);
  };
  const removeActionPhoto = (idx) => setActionPhotos((prev) => prev.filter((_, i) => i !== idx));

  const submitForReview = async (a) => {
    if (!actionText.trim()) return;
    setActionSaving(true);
    if (actionPhotos.length > 0) {
      await insertAnomalyPhotos(a.id, actionPhotos, "fix");
    }
    const newPhotoCount = a.photoCount + actionPhotos.length;
    const patch = { status: "pending_review", contractorAction: actionText.trim(), photoCount: newPhotoCount };
    await updateAnomalyDB(a.id, patch);
    setAnomalies(anomalies.map((x) => (x.id === a.id ? { ...x, ...patch } : x)));
    setPhotosMap((prev) => ({ ...prev, [a.id]: undefined }));
    setActionSaving(false);
    setExpandedId(null);
    resetActionState();
  };

  const approveAnomaly = async (a) => {
    setReviewSaving(true);
    const patch = { status: "Closed", closeDate: todayISO() };
    await updateAnomalyDB(a.id, patch);
    setAnomalies(anomalies.map((x) => (x.id === a.id ? { ...x, ...patch } : x)));
    setReviewSaving(false);
    setExpandedId(null);
    resetActionState();
  };

  const rejectAnomaly = async (a) => {
    setReviewSaving(true);
    const patch = { status: "open", reviewNote: rejectNote.trim() };
    await updateAnomalyDB(a.id, patch);
    setAnomalies(anomalies.map((x) => (x.id === a.id ? { ...x, ...patch } : x)));
    setReviewSaving(false);
    setExpandedId(null);
    resetActionState();
  };

  const riskMeta = (level) => RISK_LEVELS.find((r) => r.value === level) || RISK_LEVELS[1];
  const statusMeta = (status) => {
    if (status === "Closed") return { label: "بسته", color: "#166534", bg: "#dcfce7", Icon: CheckCircle2 };
    if (status === "pending_review") return { label: "در انتظار تأیید", color: "#1d4ed8", bg: "#dbeafe", Icon: Clock };
    return { label: "باز", color: "#92400e", bg: "#fef3c7", Icon: Clock };
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "#888" }}>در حال بارگذاری...</div>;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      {onBack && <div style={styles.backLink} onClick={onBack}>← بازگشت به منو</div>}

      <div style={styles.statsRow}>
        <div style={styles.statBox}>
          <div style={styles.statNum}>{counts.total}</div>
          <div style={styles.statLabel}>کل موارد</div>
        </div>
        <div style={{ ...styles.statBox, background: "#fef3c7" }}>
          <div style={{ ...styles.statNum, color: "#92400e" }}>{counts.open}</div>
          <div style={styles.statLabel}>باز</div>
        </div>
        <div style={{ ...styles.statBox, background: "#dbeafe" }}>
          <div style={{ ...styles.statNum, color: "#1d4ed8" }}>{counts.review}</div>
          <div style={styles.statLabel}>در انتظار تأیید</div>
        </div>
        <div style={{ ...styles.statBox, background: "#dcfce7" }}>
          <div style={{ ...styles.statNum, color: "#166534" }}>{counts.closed}</div>
          <div style={styles.statLabel}>بسته</div>
        </div>
        <div style={{ ...styles.statBox, background: "#fee2e2" }}>
          <div style={{ ...styles.statNum, color: "#991b1b" }}>{counts.high}</div>
          <div style={styles.statLabel}>ریسک بالای باز</div>
        </div>
      </div>

      <div style={styles.filterBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, background: "#fff", borderRadius: 8, padding: "6px 10px", border: "1px solid #ddd" }}>
          <Search size={16} color="#888" />
          <input
            style={{ border: "none", outline: "none", flex: 1, fontSize: 14 }}
            placeholder="جستجو (شماره، پیمانکار، ناحیه، شرح)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            dir="rtl"
          />
        </div>
        <select style={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} dir="rtl">
          <option value="all">همه وضعیت‌ها</option>
          <option value="open">باز</option>
          <option value="pending_review">در انتظار تأیید</option>
          <option value="Closed">بسته</option>
        </select>
        <select style={styles.filterSelect} value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} dir="rtl">
          <option value="all">همه سطوح ریسک</option>
          {RISK_LEVELS.map((r) => <option key={r.value} value={r.value}>{r.value}</option>)}
        </select>
      </div>

      <h3 style={{ marginTop: 20 }}>موارد ثبت‌شده ({filtered.length})</h3>

      {filtered.length === 0 && <p style={{ color: "#888" }}>موردی یافت نشد.</p>}

      {filtered.map((a) => {
        const rm = riskMeta(a.riskLevel);
        const sm = statusMeta(a.status);
        const isOpenCard = expandedId === a.id;
        const photos = photosMap[a.id] || [];
        const reportPhotos = photos.filter((p) => p.stage !== "fix");
        const fixPhotos = photos.filter((p) => p.stage === "fix");
        return (
          <div key={a.id} style={{ ...styles.card, width: "auto", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }} onClick={() => startExpand(a)}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: "bold" }}>{a.trackingNumber}</span>
                  <span style={{ ...styles.badge, color: rm.color, background: rm.bg }}>{a.riskLevel}</span>
                  <span style={{ ...styles.badge, color: sm.color, background: sm.bg }}>
                    <sm.Icon size={12} style={{ display: "inline", marginLeft: 3 }} />{sm.label}
                  </span>
                  {a.category && <span style={styles.badge}>{a.category}</span>}
                </div>
                <div style={{ fontSize: 14, marginTop: 8 }}>{a.description}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                  {a.area} {a.contractor && `· ${a.contractor}`} {a.date && `· ${a.date}`} {a.sender && `· ثبت توسط ${a.sender}`}
                </div>
              </div>
              <ChevronRight size={18} color="#999" style={{ transform: isOpenCard ? "rotate(-90deg)" : "none", transition: "transform .15s" }} />
            </div>

            {isOpenCard && (
              <div style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 16 }}>
                {a.reviewNote && a.status === "open" && (
                  <div style={{ background: "#fee2e2", color: "#991b1b", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                    <b>بازگشت توسط کارفرما:</b> {a.reviewNote}
                  </div>
                )}

                {a.photoCount > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    {photosLoading && !photosMap[a.id] ? (
                      <p style={{ fontSize: 12, color: "#888" }}>در حال بارگذاری عکس‌ها...</p>
                    ) : (
                      <>
                        {reportPhotos.length > 0 && (
                          <>
                            <label style={styles.label}>عکس‌های گزارش اولیه (کارفرما)</label>
                            <div style={styles.photoGrid}>
                              {reportPhotos.map((p, idx) => (
                                <div key={p.id} style={styles.photoThumbWrap}>
                                  <img src={p.photo} alt={`گزارش ${idx + 1}`} style={styles.photoThumb} onClick={() => setViewerSrc(p.photo)} />
                                  {isReviewer && (
                                    <button type="button" style={styles.photoRemoveBtn} onClick={() => removeExistingPhoto(a.id, p.id)}>
                                      <Trash2 size={12} color="#fff" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        {fixPhotos.length > 0 && (
                          <>
                            <label style={styles.label}>عکس‌های اقدام اصلاحی (پیمانکار)</label>
                            <div style={styles.photoGrid}>
                              {fixPhotos.map((p, idx) => (
                                <div key={p.id} style={styles.photoThumbWrap}>
                                  <img src={p.photo} alt={`اقدام ${idx + 1}`} style={styles.photoThumb} onClick={() => setViewerSrc(p.photo)} />
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ---- پیمانکار: ثبت اقدام اصلاحی ---- */}
                {isContractor && a.status === "open" && (
                  <div>
                    <label style={styles.label}>شرح اقدام اصلاحی انجام‌شده</label>
                    <textarea style={{ ...styles.input, minHeight: 70, fontFamily: "inherit" }} value={actionText} onChange={(e) => setActionText(e.target.value)} dir="rtl" placeholder="توضیح دهید چه اقدامی برای رفع این آنومالی انجام دادید" />

                    <label style={styles.label}>عکس اقدام اصلاحی ({actionPhotos.length}/8)</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <label style={{ ...styles.smallButton, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", position: "relative", overflow: "hidden", opacity: actionPhotoBusy || actionPhotos.length >= 8 ? 0.5 : 1, pointerEvents: actionPhotoBusy || actionPhotos.length >= 8 ? "none" : "auto" }}>
                        <Camera size={16} /> گرفتن عکس
                        <input type="file" accept="image/*" capture="environment" style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }} onChange={(e) => { handleActionPickFiles(e.target.files); e.target.value = ""; }} />
                      </label>
                      <label style={{ ...styles.smallButton, flex: 1, background: "#475569", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", position: "relative", overflow: "hidden", opacity: actionPhotoBusy || actionPhotos.length >= 8 ? 0.5 : 1, pointerEvents: actionPhotoBusy || actionPhotos.length >= 8 ? "none" : "auto" }}>
                        <ImagePlus size={16} /> افزودن از گالری
                        <input type="file" accept="image/*" multiple style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }} onChange={(e) => { handleActionPickFiles(e.target.files); e.target.value = ""; }} />
                      </label>
                    </div>
                    {actionPhotoBusy && <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>در حال پردازش عکس...</p>}
                    {actionPhotos.length > 0 && (
                      <div style={styles.photoGrid}>
                        {actionPhotos.map((src, idx) => (
                          <div key={idx} style={styles.photoThumbWrap}>
                            <img src={src} alt={`اقدام ${idx + 1}`} style={styles.photoThumb} />
                            <button type="button" style={styles.photoRemoveBtn} onClick={() => removeActionPhoto(idx)}>
                              <X size={12} color="#fff" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button type="button" style={styles.button} onClick={() => submitForReview(a)} disabled={actionSaving || !actionText.trim()}>
                      {actionSaving ? "در حال ارسال..." : "ارسال برای تأیید کارفرما"}
                    </button>
                  </div>
                )}
                {isContractor && a.status === "pending_review" && (
                  <div style={{ fontSize: 13, color: "#1d4ed8", background: "#dbeafe", padding: 10, borderRadius: 8 }}>
                    اقدام شما ثبت شد و در انتظار بررسی و تأیید کارفرماست.
                    {a.contractorAction && <div style={{ marginTop: 6, color: "#333" }}><b>شرح اقدام شما:</b> {a.contractorAction}</div>}
                  </div>
                )}
                {isContractor && a.status === "Closed" && (
                  <div style={{ fontSize: 13, color: "#555", lineHeight: 1.9 }}>
                    {a.contractorAction && <div><b>اقدام اصلاحی شما:</b> {a.contractorAction}</div>}
                    <div><b>وضعیت:</b> تأیید و بسته شد توسط کارفرما</div>
                    {a.closeDate && <div><b>تاریخ بسته شدن:</b> {a.closeDate}</div>}
                  </div>
                )}

                {/* ---- کارفرما/ادمین: بررسی و تأیید ---- */}
                {isReviewer && a.status === "pending_review" && (
                  <div>
                    {a.contractorAction && (
                      <div style={{ fontSize: 13, background: "#f8fafc", padding: 10, borderRadius: 8, marginBottom: 12 }}>
                        <b>شرح اقدام پیمانکار:</b> {a.contractorAction}
                      </div>
                    )}
                    {!showRejectBox ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" style={styles.button} onClick={() => approveAnomaly(a)} disabled={reviewSaving}>
                          {reviewSaving ? "در حال ثبت..." : "تأیید و بستن"}
                        </button>
                        <button type="button" style={{ ...styles.smallButton, background: "#dc2626" }} onClick={() => setShowRejectBox(true)}>
                          رد و بازگشت
                        </button>
                      </div>
                    ) : (
                      <>
                        <label style={styles.label}>دلیل بازگشت (برای پیمانکار نمایش داده می‌شود)</label>
                        <textarea style={{ ...styles.input, minHeight: 60, fontFamily: "inherit" }} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} dir="rtl" />
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button type="button" style={{ ...styles.button, background: "#dc2626" }} onClick={() => rejectAnomaly(a)} disabled={reviewSaving}>
                            {reviewSaving ? "در حال ثبت..." : "تأیید بازگشت"}
                          </button>
                          <button type="button" style={{ ...styles.smallButton, background: "#999" }} onClick={() => setShowRejectBox(false)}>انصراف</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {isReviewer && a.status === "Closed" && (
                  <div style={{ fontSize: 13, color: "#555", lineHeight: 1.9 }}>
                    {a.contractorAction && <div><b>اقدام پیمانکار:</b> {a.contractorAction}</div>}
                    {a.closeDate && <div><b>تاریخ بسته شدن:</b> {a.closeDate}</div>}
                    {a.effectiveness && <div><b>اثربخشی:</b> {a.effectiveness}</div>}
                  </div>
                )}
                {isReviewer && a.status === "open" && (
                  <div>
                    <div style={styles.backLink} onClick={() => setShowManualEdit((v) => !v)}>
                      {showManualEdit ? "بستن ویرایش دستی" : "ویرایش دستی (اختیاری)"}
                    </div>
                    {showManualEdit && (
                      <>
                        <label style={styles.label}>اقدام اصلاحی</label>
                        <textarea style={{ ...styles.input, minHeight: 60, fontFamily: "inherit" }} value={draft.correctiveAction} onChange={(e) => setDraft({ ...draft, correctiveAction: e.target.value })} dir="rtl" />

                        <label style={styles.label}>موانع و مشکلات</label>
                        <textarea style={{ ...styles.input, minHeight: 60, fontFamily: "inherit" }} value={draft.obstacles} onChange={(e) => setDraft({ ...draft, obstacles: e.target.value })} dir="rtl" />

                        <div style={styles.formGrid}>
                          <div>
                            <label style={styles.label}>شخص پیگیر</label>
                            <input style={styles.input} value={draft.follower} onChange={(e) => setDraft({ ...draft, follower: e.target.value })} dir="rtl" />
                          </div>
                          <div>
                            <label style={styles.label}>وضعیت</label>
                            <select style={styles.input} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} dir="rtl">
                              <option value="open">باز</option>
                              <option value="pending_review">در انتظار تأیید</option>
                              <option value="Closed">بسته (Closed)</option>
                            </select>
                          </div>
                        </div>

                        {draft.status === "Closed" && (
                          <div style={styles.formGrid}>
                            <div>
                              <label style={styles.label}>تاریخ بسته شدن</label>
                              <input style={styles.input} type="date" value={draft.closeDate} onChange={(e) => setDraft({ ...draft, closeDate: e.target.value })} />
                            </div>
                            <div>
                              <label style={styles.label}>اثربخشی</label>
                              <input style={styles.input} value={draft.effectiveness} onChange={(e) => setDraft({ ...draft, effectiveness: e.target.value })} dir="rtl" />
                            </div>
                          </div>
                        )}

                        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                          <button type="button" style={styles.button} onClick={() => saveDraft(a.id)}>ذخیره تغییرات</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {isReviewer && (
                  <div style={{ marginTop: 16 }}>
                    <button type="button" style={{ ...styles.smallButton, background: "#dc2626" }} onClick={() => handleDelete(a.id, a.trackingNumber)}>حذف آنومالی</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {viewerSrc && (
        <div style={styles.photoViewerOverlay} onClick={() => setViewerSrc(null)}>
          <button type="button" style={styles.photoViewerClose} onClick={() => setViewerSrc(null)}>
            <X size={20} color="#fff" />
          </button>
          <img src={viewerSrc} alt="نمای بزرگ" style={styles.photoViewerImg} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// ---------- پنل ادمین ----------
function AdminDashboard({ onLogout }) {
  return (
    <div style={styles.dashboardWrapper}>
      <div style={styles.topBar}>
        <div>
          <div style={styles.appNameTag}>{APP_NAME}</div>
          <h2 style={{ margin: 0 }}>پنل ادمین</h2>
        </div>
        <button style={styles.logoutButton} onClick={onLogout}><LogOut size={14} style={{ marginLeft: 6 }} />خروج</button>
      </div>
      <ContractorAccountManager />
    </div>
  );
}

// ---------- پنل کارفرما ----------
function EmployerDashboard({ onLogout, currentUser }) {
  const [view, setView] = useState("menu");

  const openModule = (mod) => {
    if (mod.key === "profile") { setView("profile"); return; }
    if (mod.sub) { setView(mod.key); return; }
    alert(`ماژول «${mod.label}» به‌زودی اضافه می‌شود`);
  };

  const anomalyMod = HSE_MODULES.find((m) => m.key === "anomalyReport");
  const usersMod = HSE_MODULES.find((m) => m.key === "manageUsers");

  return (
    <div style={styles.dashboardWrapper}>
      <div style={styles.topBar}>
        <div>
          <div style={styles.appNameTag}>{APP_NAME}</div>
          <h2 style={{ margin: 0 }}>پنل کارفرما</h2>
        </div>
        <button style={styles.logoutButton} onClick={onLogout}><LogOut size={14} style={{ marginLeft: 6 }} />خروج</button>
      </div>

      {view === "menu" && (
        <div style={styles.menuList}>
          {HSE_MODULES.map((mod) => (
            <div
              key={mod.key}
              style={{ ...styles.menuCard, ...(mod.icon ? styles.anomalyMenuCard : {}) }}
              onClick={() => openModule(mod)}
            >
              {mod.icon && <AlertTriangle size={16} style={{ marginLeft: 8, verticalAlign: "middle" }} />}
              {mod.label}
              {mod.sub && <ChevronRight size={16} color="#999" style={{ float: "left", transform: "rotate(180deg)" }} />}
            </div>
          ))}
        </div>
      )}

      {view === "anomalyReport" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>← بازگشت به منو</div>
          <h3 style={{ marginBottom: 12 }}>{anomalyMod.label}</h3>
          <div style={styles.menuList2}>
            {anomalyMod.sub.map((s) => (
              <div key={s.key} style={{ ...styles.menuCard, ...styles.anomalyMenuCard }} onClick={() => setView(s.key)}>
                <AlertTriangle size={16} style={{ marginLeft: 8, verticalAlign: "middle" }} />{s.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "manageUsers" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>← بازگشت به منو</div>
          <h3 style={{ marginBottom: 12 }}>{usersMod.label}</h3>
          <div style={styles.menuList2}>
            {usersMod.sub.map((s) => (
              <div key={s.key} style={styles.menuCard} onClick={() => setView(s.key)}>{s.label}</div>
            ))}
          </div>
        </div>
      )}

      {view === "profile" && <ProfileView onBack={() => setView("menu")} currentUser={currentUser} roleLabel="کارفرما" />}
      {view === "manageUsersAccounts" && <ContractorAccountManager onBack={() => setView("manageUsers")} />}
      {view === "manageContractorInfo" && <ContractorInfoManager onBack={() => setView("manageUsers")} />}
      {view === "anomalyForm" && <AnomalyForm onBack={() => setView("anomalyReport")} currentUser={currentUser} onSaved={() => setView("anomalyList")} />}
      {view === "anomalyList" && <AnomalyList onBack={() => setView("anomalyReport")} role="EMPLOYER" />}
    </div>
  );
}

// ---------- پنل پیمانکار ----------
function ContractorDashboard({ onLogout, currentUser }) {
  const [view, setView] = useState("menu");

  const openModule = (mod) => {
    if (mod.key === "profile") { setView("profile"); return; }
    if (mod.employerOnly) { alert("این بخش فقط برای کارفرما/ادمین در دسترس است"); return; }
    if (mod.sub) { setView(mod.key); return; }
    alert(`ماژول «${mod.label}» به‌زودی اضافه می‌شود`);
  };

  const anomalyMod = HSE_MODULES.find((m) => m.key === "anomalyReport");
  const anomalySub = anomalyMod.sub.filter((s) => !s.employerOnly);

  return (
    <div style={styles.dashboardWrapper}>
      <div style={styles.topBar}>
        <div>
          <div style={styles.appNameTag}>{APP_NAME}</div>
          <h2 style={{ margin: 0 }}>پنل پیمانکار</h2>
        </div>
        <button style={styles.logoutButton} onClick={onLogout}><LogOut size={14} style={{ marginLeft: 6 }} />خروج</button>
      </div>

      {view === "menu" && (
        <div style={styles.menuList}>
          {HSE_MODULES.map((mod) => (
            <div
              key={mod.key}
              style={{ ...styles.menuCard, ...(mod.icon ? styles.anomalyMenuCard : {}), ...(mod.employerOnly ? { opacity: 0.55 } : {}) }}
              onClick={() => openModule(mod)}
            >
              {mod.icon && <AlertTriangle size={16} style={{ marginLeft: 8, verticalAlign: "middle" }} />}
              {mod.label}
              {mod.sub && <ChevronRight size={16} color="#999" style={{ float: "left", transform: "rotate(180deg)" }} />}
            </div>
          ))}
        </div>
      )}

      {view === "anomalyReport" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <div style={styles.backLink} onClick={() => setView("menu")}>← بازگشت به منو</div>
          <h3 style={{ marginBottom: 12 }}>{anomalyMod.label}</h3>
          <div style={styles.menuList2}>
            {anomalySub.map((s) => (
              <div key={s.key} style={{ ...styles.menuCard, ...styles.anomalyMenuCard }} onClick={() => setView(s.key)}>
                <AlertTriangle size={16} style={{ marginLeft: 8, verticalAlign: "middle" }} />{s.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "profile" && <ProfileView onBack={() => setView("menu")} currentUser={currentUser} roleLabel="پیمانکار" />}
      {view === "anomalyList" && <AnomalyList onBack={() => setView("anomalyReport")} role="CONTRACTOR" />}
    </div>
  );
}

// ---------- گرفتن خطاهای زمان اجرا و نمایش پیام به‌جای صفحه سفید ----------
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("App error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "Tahoma, Arial, sans-serif", direction: "rtl", maxWidth: 560, margin: "40px auto" }}>
          <h3 style={{ color: "#dc2626" }}>مشکلی در اجرای اپلیکیشن پیش آمد</h3>
          <p style={{ fontSize: 13, color: "#555" }}>لطفاً متن زیر را برای بررسی ارسال کنید:</p>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#991b1b", background: "#fee2e2", padding: 12, borderRadius: 8 }}>
            {String((this.state.error && this.state.error.message) || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------- کامپوننت اصلی ----------
function AppInner() {
  const [currentUser, setCurrentUser] = useState(null);

  if (!currentUser) return <LoginScreen onLogin={setCurrentUser} />;
  if (currentUser.role === "ADMIN") return <AdminDashboard onLogout={() => setCurrentUser(null)} />;
  if (currentUser.role === "EMPLOYER") return <EmployerDashboard onLogout={() => setCurrentUser(null)} currentUser={currentUser} />;
  return <ContractorDashboard onLogout={() => setCurrentUser(null)} currentUser={currentUser} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

// ---------- استایل‌ها ----------
const styles = {
  centerScreen: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f5f5f7", fontFamily: "Tahoma, Arial, sans-serif" },
  brandBadge: { width: 44, height: 44, borderRadius: 12, background: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" },
  card: { background: "#fff", padding: 32, borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", width: 340, direction: "rtl", marginBottom: 12 },
  label: { display: "block", marginBottom: 6, marginTop: 16, fontSize: 14, color: "#333" },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 15, boxSizing: "border-box" },
  button: { width: "100%", marginTop: 24, padding: "12px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", fontSize: 16, cursor: "pointer" },
  smallButton: { padding: "8px 14px", borderRadius: 6, border: "none", background: "#2563eb", color: "#fff", fontSize: 13, cursor: "pointer" },
  error: { color: "#dc2626", fontSize: 13, marginTop: 12, marginBottom: 0 },
  hint: { fontSize: 12, color: "#888", marginTop: 16, textAlign: "center", direction: "ltr" },
  dashboardWrapper: { direction: "rtl", fontFamily: "Tahoma, Arial, sans-serif", minHeight: "100vh", background: "#f5f5f7" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#2563eb", color: "#fff", padding: "16px 24px" },
  appNameTag: { fontSize: 11, opacity: 0.85, marginBottom: 2, direction: "ltr", textAlign: "right" },
  logoutButton: { display: "flex", alignItems: "center", background: "transparent", border: "1px solid #fff", color: "#fff", padding: "6px 14px", borderRadius: 6, cursor: "pointer" },
  menuList: { padding: 24, display: "flex", flexDirection: "column", gap: 12, maxWidth: 480, margin: "0 auto" },
  menuList2: { display: "flex", flexDirection: "column", gap: 12 },
  menuCard: { background: "#fff", padding: 20, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", cursor: "pointer", fontSize: 16 },
  anomalyMenuCard: { border: "1px solid #fecaca", background: "#fff7f7" },
  userRow: { background: "#fff", padding: "14px 20px", borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 15 },
  backLink: { cursor: "pointer", color: "#2563eb", marginBottom: 16, fontSize: 14 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(72px, 1fr))", gap: 8, marginTop: 8 },
  statBox: { background: "#eef2ff", borderRadius: 10, padding: "12px 6px", textAlign: "center" },
  statNum: { fontSize: 20, fontWeight: "bold", color: "#3730a3" },
  statLabel: { fontSize: 11, color: "#555", marginTop: 2 },
  filterBar: { display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" },
  filterSelect: { padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, background: "#fff" },
  badge: { fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#f1f5f9", color: "#475569" },
  photoGrid: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 },
  photoThumbWrap: { position: "relative", width: 80, height: 80 },
  photoThumb: { width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" },
  photoRemoveBtn: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", background: "#dc2626", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  photoViewerOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  photoViewerImg: { maxWidth: "100%", maxHeight: "90vh", borderRadius: 8 },
  photoViewerClose: { position: "absolute", top: 20, left: 20, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
};
