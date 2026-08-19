import React, { useState } from "react";
import { Lock, ShieldAlert } from "lucide-react";
import { THEME } from "../shared.js";
import { superAdminLogin } from "./superAdminApi.js";

export default function SuperAdminLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password) return;
    setLoading(true);
    setError("");
    const result = await superAdminLogin(username, password);
    setLoading(false);
    if (result?.__error) { setError(result.message); return; }
    onLogin(result);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: THEME.navyDeep, fontFamily: THEME.font, padding: 20 }}>
      <div style={{ background: THEME.surface, borderRadius: 16, padding: 32, width: "100%", maxWidth: 380, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: THEME.navyDeep, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <ShieldAlert size={26} color="#fff" />
        </div>
        <h2 style={{ fontSize: 17, color: THEME.navy, fontWeight: 700, margin: "0 0 4px" }}>Super Admin</h2>
        <p style={{ fontSize: 12, color: THEME.text3, margin: "0 0 24px" }}>پنل مالک سامانه — دسترسی محدود</p>

        <div style={{ textAlign: "right", marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 6 }}>نام کاربری</label>
          <input
            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1.5px solid ${THEME.border}`, fontSize: 14, fontFamily: THEME.font, boxSizing: "border-box" }}
            value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr"
          />
        </div>
        <div style={{ textAlign: "right", marginBottom: 18 }}>
          <label style={{ fontSize: 12, color: THEME.text2, fontWeight: 600, display: "block", marginBottom: 6 }}>رمز عبور</label>
          <input
            type="password" style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1.5px solid ${THEME.border}`, fontSize: 14, fontFamily: THEME.font, boxSizing: "border-box" }}
            value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>

        {error && <p style={{ color: THEME.danger, fontSize: 12.5, marginBottom: 12 }}>{error}</p>}

        <button
          type="button" onClick={handleSubmit} disabled={loading}
          style={{ width: "100%", padding: "12px 0", borderRadius: 9, border: "none", background: THEME.navyDeep, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: THEME.font }}
        >
          <Lock size={14} /> {loading ? "در حال بررسی..." : "ورود"}
        </button>
      </div>
    </div>
  );
}
