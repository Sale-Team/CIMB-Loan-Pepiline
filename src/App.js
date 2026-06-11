// CIMB LOAN PIPELINE APP — PERFORMANCE IMPROVED
// Changes made vs original:
//  1. Firestore pagination — deals load 20 at a time, "Load More" button
//  2. Server-side filtering — status/branch/date filters run as Firestore queries
//  3. Debounced search — 350ms debounce, stops firing on every keystroke
//  4. Lazy tab data — activity logs & follow-ups only fetched when tab is opened
//  5. useMemo / useCallback — all expensive calculations properly memoised
//  6. Brute-force lockout persisted in sessionStorage — survives page refresh
//  7. Session expiry persisted in sessionStorage — survives page refresh
//  8. All unsubscribe listeners cleaned up correctly

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  LayoutDashboard, Users, DollarSign, Target, Bell,
  Search, X, Plus, CheckCircle, Briefcase,
  Upload, Sparkles, Mail, Copy, Loader2, Star, LogOut, Shield,
  Eye, EyeOff, UserPlus, Trash2, Edit2, FileDown, Clock,
  Activity, ChevronDown, ChevronUp,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection, onSnapshot, addDoc, updateDoc,
  doc, deleteDoc, getDocs, query, where, orderBy,
  limit, startAfter, getCountFromServer,
} from "firebase/firestore";

// ─── constants ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

const CIMB_LOGO_SRC = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCADhAOEDASIAAhEBAxEB/8QAHQABAAICAwEBAAAAAAAAAAAAAAcIBQYCAwQBCf/EAE8QAAEDAwEEBAMVBAkEAwAAAAEAAgMEBREGBxIhMQgTQVEUImEVFhgyNjdCVmJlcXR1gZGUlbGy0uJSk7PRIyQ4U1RVcqHTM0N2wYLC4f/EABwBAQACAwEBAQAAAAAAAAAAAAADBAEFBgcCCP/EAD8RAAEDAgMDBwgIBwEBAAAAAAEAAhEDBAUSITFBUQYTFGFxkbEVIjJSVIGh0QcWFzM1csHwIzRTYpKy4fFj/9oADAMBAAIRAxEAPwDRERFxq/UqIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIi3bYlpe16w14yyXjr/BTSSzHqZNx280txxxy4lTx6H7QHvv8AXP0qI+i167cXydUfexW0W7w+hTqUpc2TK8l5bYzf2eJCnb1XNblBgHfJUT+h+0B77/XP0p6H7QHvv9c/SpYRX+iUPVC5D6y4t7Q7vUT+h+0B77/XP0p6H7QHvv8AXP0qWETolD1Qn1lxb2h3eon9D9oD33+ufpT0P2gPff65+lSwidEoeqE+suLe0O71E/oftAe+/wBc/SnoftAe+/1z9KlhE6JQ9UJ9ZcW9od3qJ/Q/aA99/rn6VDvSB0PY9DXi0Utj8K6urp5ZJevl3zlrmgY4DHMq3SrZ0wvVJpz4nP8AjYqd9b0mUC5rQDp4rp+R+N4hd4tTpV6znNIdoTp6JUGIiLQr2JERERERERERERERERERERERERERERERERSl0WvXbi+Tqj72K2iqX0WvXbi+Tqj72K2i6HC/ufevE/pB/FR+QeJUKbbNoe0LQV/jbS0djnstYM0lRLSSlwcPTRvIlA3hzHAZHwHGgeiG19/gtOfVJv8AmVkNb6aturtNVdiujMw1DfFkAG9C8eskb7oHj/seBKpVrHTty0pqSrsV1YG1FM7g9oIbKw+lkbn2JH0HI5gqtfGvRdma45St5yPp4RilvzNag3nWbdPSHH9D371Ivohtff4LTn1Sb/mT0Q2vv8Fpz6pN/wAyiNFQ6XX9Yrs/qzhPs7e5S56IbX3+C059Um/5l2U/SI1w2eN1RbtPywhwMjGU8rHObniA4ykAkduDjuKh9E6XX9YrB5MYQdOjt7lfLSl+tup9P0l8tM3W0tUzebng5h5OY4djgcgjvCyiqFsG2iv0TqA0NxmPmDcJAKnJ4U8nITDycg7yAH2ODbxjmvY17HBzXDIIOQR3rf2lyK7J3javGeUmA1MHuzT2sdq09XDtG/v3r6q2dML1Sac+Jz/jYrJqtnTC9UmnPic/42KPEf5c+7xV7kL+NUux3+pUGIiLm17siIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIpS6LXrtxfJ1R97FbRVL6LXrtxfJ1R97FbRdDhf3PvXif0g/io/IPEoo726bPI9c6cE1ExjL5QBz6OQ8OtHsoXHud2HscB2ZzIiK9UptqNLXbCuRsb2tY3DbiiYc39x2HYV+fUjJI5HxSxvikY4tex7S1zHA4IIPEEHgQvimjpf2XT2nq+h1W2thpau6SGGeiAy6ctbnr2gDsG61x5cWduc19889o/vpP3Tv5LmK1s+k8tiV+gMLx21v7VlwHBs7QTsO8f9WaRYXzz2j++k/dO/knnntH99J+6d/JRc2/gr/Trb+oO8LNKxHRj2jdbHFoW9T/ANJG0+ZUzz6Zg4mAnvaOLfcgj2IzV3zz2j++k/dO/kucOq7bBNHPBVzwzRPD45GMcHMcDkOB7CCAQVPbvqUHhwC1WNW1hi1o63q1BxBkaHcfnxC/R1Vs6YXqk058Tn/GxS7sQ1fXa42c2+/3ChlpZ5N6MvczdbU7vDrmDmGu48DjiDjIwTEXTC9UmnPic/42LcX7g62LhvjxXl/I2g63x9tJ0S3ONDI0ad6gxERc6vcERERERERERERERERERERERERERERERERFKXRa9duL5OqPvYraKpfRa9duL5OqPvYraLocL+5968T+kH8VH5B4lFidYaitOk9NVuob5UimoKKPfkfzJ7A1o7XEkADtJCyriGtLnEAAZJPYqIdKva47X+pvMKy1GdM2uU9S5p4VkwBBmPuRktb5Mn2WBcrVRTbO9cxheHuvq2QeiNp6vmo/2sa7u+0XWdVqO6ncD/6Olpg7LaaAE7sY7+ZJPaSTw5LUkRaskkyV6XTptpMDGCAEREWF9opS6OOyuo2maxDatksenreRJcZ25G/+zC0/tO7+xuTzwDpWgtKXfWurKHTdkh6yrq5N3ePpImeykeexrRxP0DJIC/RzZpoy0aB0dR6assZ6mAb0srh49RKfTyO8pP0AADgArFClnMnYtDjmKdEp83TPnu+A4/JZ+ipaaio4KOjgjp6aCNsUMUbQ1kbGjDWgDgAAAMKuPTC9UmnPic/42KyarZ0wvVJpz4nP+NikxH+XPu8VrOQxnG6fY7/UqDERFza92REREREREREREREREREREREREREREREREUpdFr124vk6o+9itoql9Fr124vk6o+9itouhwv7n3rxP6QfxUfkHiVWHpl7XhbaKXZxp2qb4ZVR4vEzHcYYnDhAPdPB8bubgcd7hUDI7wv1Tfbre97nvoaVznHLnGFpJPfyXzzMtv8Al9J+5b/JT1LcvdJK1OH47TsqIpspdpnae5flbkd4TI7wv1S8zLb/AJfSfuW/yTzMtv8Al9J+5b/JR9DPFXvrWP6Xx/4vytyO8LnBHJPNHBAx0ssjgxjGDec5xOAABxJJ7F+p/mZbf8vpP3Lf5L6y3W9j2vZQ0rXNOWuELQQe/ks9DPFY+tf/AMvj/wAUU9GHZNFs40n4ddIWnUt0ja6tcSHeDs5tgaeXDm4jm7tIa1TAiK21oaIC5W4uH3FQ1ahklFWzpheqTTnxOf8AGxWTVbOmF6pNOfE5/wAbFTxH+XPu8V1PIX8apdjv9SoMREXNr3ZERERERERERERERERERERERERERERERERFKXRa9duL5OqPvYraKpfRa9duL5OqPvYraLocL+5968T+kH8VH5B4lFidYaitOk9NVuob5UimoKKPfkfzJ7A1o7XEkADtJCyriGtLnEAAZJPYqIdKva47X+pvMKy1GdM2uU9S5p4VkwBBmPuRktb5Mn2WBcrVRTbO9cxheHuvq2QeiNp6vmo/2sa7u+0XWdVqO6ncD/6Olpg7LaaAE7sY7+ZJPaSTw5LUkRaskkyV6XTptpMDGCAEREWF9opS6OOyuo2maxDatksenreRJcZ25G/+zC0/tO7+xuTzwDpWgtKXfWurKHTdkh6yrq5N3ePpImeykeexrRxP0DJIC/RzZpoy0aB0dR6assZ6mAb0srh49RKfTyO8pP0AADgArFClnMnYtDjmKdEp83TPnu+A4/JZ+ipaaio4KOjgjp6aCNsUMUbQ1kbGjDWgDgAAAMKuPTC9UmnPic/42KyarZ0wvVJpz4nP+NikxH+XPu8VrOQxnG6fY7/UqDERFza92REREREREREREREREREREREREREREREREUpdFr124vk6o+9itoql9Fr124vk6o+9itouhwv7n3rxP6QfxUfkHiVWHpl7XhbaKXZxp2qb4ZVR4vEzHcYYnDhAPdPB8bubgcd7hUDI7wv1Tfbre97nvoaVznHLnGFpJPfyXzzMtv8Al9J+5b/JT1LcvdJK1OH47TsqIpspdpnae5flbkd4TI7wv1S8zLb/AJfSfuW/yTzMtv8Al9J+5b/JR9DPFXvrWP6Xx/4vytyO8LnBHJPNHBAx0ssjgxjGDec5xOAABxJJ7F+p/mZbf8vpP3Lf5L6y3W9j2vZQ0rXNOWuELQQe/ks9DPFY+tf/AMvj/wAUU9GHZNFs40n4ddIWnUt0ja6tcSHeDs5tgaeXDm4jm7tIa1TAiK21oaIC5W4uH3FQ1ahklFWzpheqTTnxOf8AGxWTVbOmF6pNOfE5/wAbFTxH+XPu8V1PIX8apdjv9SoMREXNr3ZERERERERERERERERERERERERERERERERFKXRa9duL5OqPvYraKpfRa9duL5OqPvYraLocL+5968T+kH8VH5B4lFidYaitOk9NVuob5UimoKKPfkfzJ7A1o7XEkADtJCyriGtLnEAAZJPYqIdKva47X+pvMKy1GdM2uU9S5p4VkwBBmPuRktb5Mn2WBcrVRTbO9cxheHuvq2QeiNp6vmo/2sa7u+0XWdVqO6ncD/6Olpg7LaaAE7sY7+ZJPaSTw5LUkRaskkyV6XTptpMDGCAEREWF9opS6OOyuo2maxDatksenreRJcZ25G/+zC0/tO7+xuTzwDpWgtKXfWurKHTdkh6yrq5N3ePpImeykeexrRxP0DJIC/RzZpoy0aB0dR6assZ6mAb0srh49RKfTyO8pP0AADgArFClnMnYtDjmKdEp83TPnu+A4/JZ+ipaaio4KOjgjp6aCNsUMUbQ1kbGjDWgDgAAAMKuPTC9UmnPic/42KyarZ0wvVJpz4nP+NikxH+XPu8VrOQxnG6fY7/UqDERFza92RERERERERERERERERERERERERERERERERL/2Q==";

const exportToExcel = (data, filename, headers) => {
  const dq = '"';
  const rows = [headers.map(h => dq + h.label + dq).join(",")];
  data.forEach(row => {
    rows.push(headers.map(h => {
      const v = String(row[h.key] !== null && row[h.key] !== undefined ? row[h.key] : "");
      return dq + v.replace(/"/g, '""') + dq;
    }).join(","));
  });
  const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename + "_" + new Date().toISOString().split("T")[0] + ".csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

const CUSTOMER_HEADERS = [
  { label: "No.", key: "no" }, { label: "Customer Name", key: "client" },
  { label: "Business/Workplace", key: "businessName" }, { label: "Phone", key: "phone" },
  { label: "Branch", key: "branch" }, { label: "Loan Type", key: "loanType" },
  { label: "Request Amount ($)", key: "amount" }, { label: "Approved Amount ($)", key: "approvedAmount" },
  { label: "Rate (%)", key: "rate" }, { label: "Tenor (months)", key: "tenor" },
  { label: "Income Type", key: "incomeType" }, { label: "Income Amount ($)", key: "incomeAmount" },
  { label: "Income Status", key: "incomeStatus" }, { label: "Customer Priority", key: "customerStatus" },
  { label: "Loan Status", key: "status" }, { label: "RM Name", key: "rmName" }, { label: "Date", key: "date" },
];
const USER_HEADERS = [
  { label: "No.", key: "no" }, { label: "Full Name", key: "name" },
  { label: "Username", key: "username" }, { label: "Role", key: "role" }, { label: "Branch", key: "branch" },
];
const ACTIVITY_HEADERS = [
  { label: "No.", key: "no" }, { label: "Username", key: "username" }, { label: "Full Name", key: "name" },
  { label: "Role", key: "role" }, { label: "Branch", key: "branch" }, { label: "IP Address", key: "ip" },
  { label: "Device", key: "device" }, { label: "Browser", key: "browser" }, { label: "OS", key: "os" },
  { label: "Login Time", key: "loginTimeStr" }, { label: "Logout Time", key: "logoutTimeStr" },
  { label: "Duration", key: "duration" }, { label: "Status", key: "status" },
];

const LOAN_TYPES = ["Personal Loan", "Business Loan", "SME Loan", "Corporate Loan", "Mortgage", "Auto Loan"];
const INCOME_STATUSES = ["Verified", "Pending", "Unverified"];
const INCOME_TYPES = ["Salary", "Business", "Rental", "Other"];
const BRANCHES = ["NRD", "BSL", "TLK", "PDT", "NRM", "BTK", "MTT", "BTB", "KPC", "SRP", "271MM", "SSM", "598M", "VSR", "CMT"];

const DEFAULT_ADMINS = [
  { username: "admin", password: "admin123", role: "admin", name: "System Admin", branch: "NRD", createdAt: Date.now(), passwordHashed: false },
  { username: "Ck-Team", password: "123!!@@", role: "admin", name: "Ck-Team", branch: "NRD", createdAt: Date.now(), passwordHashed: false },
];

const hashPassword = async (pw) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw + "CMB_SALT_2024_#$@!"));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
};

// ─── IMPROVED: Brute-force lockout now persists in sessionStorage ─────────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

const getAttemptRecord = (u) => {
  try { return JSON.parse(sessionStorage.getItem("la_" + u) || "null"); } catch { return null; }
};
const setAttemptRecord = (u, rec) => {
  sessionStorage.setItem("la_" + u, JSON.stringify(rec));
};
const checkLoginAttempts = (u) => {
  const rec = getAttemptRecord(u);
  if (!rec) return { allowed: true };
  if (rec.lockedUntil && Date.now() < rec.lockedUntil)
    return { allowed: false, message: "Account locked. Try again in " + Math.ceil((rec.lockedUntil - Date.now()) / 60000) + " min." };
  return { allowed: true };
};
const recordFailedAttempt = (u) => {
  const rec = getAttemptRecord(u) || { count: 0 };
  rec.count = (rec.count || 0) + 1;
  if (rec.count >= MAX_ATTEMPTS) { rec.lockedUntil = Date.now() + LOCKOUT_MS; rec.count = 0; }
  setAttemptRecord(u, rec);
};
const clearLoginAttempts = (u) => sessionStorage.removeItem("la_" + u);

// ─── Firebase init ─────────────────────────────────────────────────────────────
const fbApp = initializeApp({
  apiKey: "AIzaSyCbzJneJiTUB9F1uYpKKo6slLv1TiMHSqQ",
  authDomain: "sale-performance-3765a.firebaseapp.com",
  projectId: "sale-performance-3765a",
  storageBucket: "sale-performance-3765a.firebasestorage.app",
  messagingSenderId: "51620902864",
  appId: "1:51620902864:web:8eaf76c66f36a9bee0abd5",
});
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
const appId = "sale-performance-3765a";

// ─── Custom debounce hook ──────────────────────────────────────────────────────
// IMPROVEMENT #3 — debounced search stops Firestore queries on every keystroke
function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── LOGIN PAGE ────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const chk = checkLoginAttempts(username.trim());
      if (!chk.allowed) { setError(chk.message); setLoading(false); return; }
      try { await signInAnonymously(auth); } catch { }
      const ref = collection(db, "artifacts", appId, "public", "data", "appUsers");
      const snap = await getDocs(ref);
      let users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (!users.length) {
        for (const a of DEFAULT_ADMINS) {
          const hp = await hashPassword(a.password);
          const r = await addDoc(ref, { ...a, password: hp, passwordHashed: true });
          users.push({ ...a, password: hp, passwordHashed: true, id: r.id });
        }
      }
      if (!users.find(u => u.username === "Ck-Team")) {
        const hp = await hashPassword(DEFAULT_ADMINS[1].password);
        const r = await addDoc(ref, { ...DEFAULT_ADMINS[1], password: hp, passwordHashed: true });
        users.push({ ...DEFAULT_ADMINS[1], password: hp, passwordHashed: true, id: r.id });
      }
      const rec = users.find(u => u.username === username.trim());
      if (rec && !rec.passwordHashed) {
        const hp = await hashPassword(rec.password);
        await updateDoc(doc(db, "artifacts", appId, "public", "data", "appUsers", rec.id), { password: hp, passwordHashed: true });
        rec.password = hp; rec.passwordHashed = true;
      }
      const hp = await hashPassword(password);
      const found = users.find(u => u.username === username.trim() && u.password === hp);
      if (found) {
        clearLoginAttempts(username.trim());
        // IMPROVEMENT #7 — session expiry stored in sessionStorage
        const expiry = Date.now() + SESSION_TIMEOUT_MS;
        sessionStorage.setItem("sessionExpiry", String(expiry));
        onLogin({ ...found, sessionExpiry: expiry });
      } else {
        recordFailedAttempt(username.trim());
        const r2 = getAttemptRecord(username.trim());
        const rem = r2 ? MAX_ATTEMPTS - (r2.count || 0) : MAX_ATTEMPTS;
        setError("Invalid username or password. " + (rem > 0 ? rem + " attempt(s) remaining." : ""));
      }
    } catch (err) {
      console.error(err);
      setError("Connection error. Please check your internet and try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "linear-gradient(135deg,#1A0000 0%,#C8102E 100%)", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 40, width: "100%", maxWidth: 400, boxShadow: "0 25px 60px rgba(0,0,0,.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <img src={CIMB_LOGO_SRC} alt="CIMB" style={{ height: 48, borderRadius: 8 }} />
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", margin: 0 }}>CIMB Bank</p>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Loan Pipeline System</p>
          </div>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 20px" }}>Sign In</h1>
        <form onSubmit={doLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 10, fontSize: 13 }}>
              {error}
            </div>
          )}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Username</label>
            <input type="text" required value={username} onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Password</label>
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{ width: "100%", padding: "11px 40px 11px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              <button type="button" onClick={() => setShowPw(!showPw)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            style={{ padding: 13, border: "none", borderRadius: 11, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", background: loading ? "#e2e8f0" : "linear-gradient(135deg,#C8102E,#e8203e)", color: loading ? "#94a3b8" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p style={{ textAlign: "center", fontSize: 11, color: "#cbd5e1", marginTop: 16 }}>
          © {new Date().getFullYear()} CIMB Bank PLC. All rights reserved.
        </p>
      </div>
    </div>
  );
}

// ─── Multi-Select ──────────────────────────────────────────────────────────────
function MultiSelect({ label, options, selected, onChange, color = "indigo" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (val) => onChange(selected.includes(val) ? selected.filter(x => x !== val) : [...selected, val]);
  const cm = {
    indigo: { a: "border-indigo-500 bg-indigo-50 text-indigo-700", c: "bg-indigo-600", t: "bg-indigo-100 text-indigo-700" },
    purple: { a: "border-purple-500 bg-purple-50 text-purple-700", c: "bg-purple-600", t: "bg-purple-100 text-purple-700" },
    amber: { a: "border-amber-500 bg-amber-50 text-amber-700", c: "bg-amber-500", t: "bg-amber-100 text-amber-700" },
    emerald: { a: "border-emerald-500 bg-emerald-50 text-emerald-700", c: "bg-emerald-600", t: "bg-emerald-100 text-emerald-700" },
  };
  const c = cm[color] || cm.indigo;
  const display = selected.length === 0 ? "All " + label : selected.map(s => options.find(o => o.value === s)?.label || s).join(", ");
  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={"flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all shadow-sm min-w-[140px] max-w-[240px] " + (selected.length > 0 ? c.a : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>
        <span className="flex-1 text-left truncate">{display}</span>
        <span className="text-slate-400 flex-shrink-0">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-2xl min-w-[200px] max-h-64 overflow-y-auto" style={{ zIndex: 9999 }}>
          <div className="p-1.5">
            <button type="button" onClick={() => { onChange([]); setOpen(false); }}
              className={"w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 " + (selected.length === 0 ? c.t + " font-bold" : "text-slate-500 hover:bg-slate-50")}>
              <span className={"w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center " + (selected.length === 0 ? c.c + " border-transparent" : "border-slate-300")}>
                {selected.length === 0 && <span className="text-white text-xs">✓</span>}
              </span>All {label}
            </button>
            <div className="border-t border-slate-100 my-1"></div>
            {options.map(opt => {
              const checked = selected.includes(opt.value);
              return (
                <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
                  className={"w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 " + (checked ? c.t + " font-semibold" : "text-slate-600 hover:bg-slate-50")}>
                  <span className={"w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center " + (checked ? c.c + " border-transparent" : "border-slate-300 bg-white")}>
                    {checked && <span className="text-white text-xs">✓</span>}
                  </span>{opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [appUsers, setAppUsers] = useState([]);

  // ── IMPROVEMENT #1 — deals now paginated ─────────────────────────────────────
  const [deals, setDeals] = useState([]);
  const [lastDealDoc, setLastDealDoc] = useState(null);
  const [hasMoreDeals, setHasMoreDeals] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalDealCount, setTotalDealCount] = useState(0);

  // ── IMPROVEMENT #4 — activity logs only fetched when activity tab opened ──────
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoaded, setActivityLoaded] = useState(false);

  // ── IMPROVEMENT #4 — follow-ups only fetched when deals tab opened ────────────
  const [followUps, setFollowUps] = useState([]);
  const [followUpsLoaded, setFollowUpsLoaded] = useState(false);

  const [activityFilter, setActivityFilter] = useState({ user: "", date: "" });
  const [isAddDealModalOpen, setIsAddDealModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);

  // ── IMPROVEMENT #3 — raw search state + debounced value ──────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 350);

  const [isPriorityModalOpen, setIsPriorityModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifPermission, setNotifPermission] = useState("default");
  const [statusFilterModal, setStatusFilterModal] = useState(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState({ username: "", password: "", name: "", role: "rm", branch: "NRD", branches: [] });
  const [showNewUserPw, setShowNewUserPw] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [priorityList, setPriorityList] = useState([]);
  const [priorityTabFilter, setPriorityTabFilter] = useState("High");
  const [emailDraft, setEmailDraft] = useState("");
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedDealForEmail, setSelectedDealForEmail] = useState(null);
  const [teamRm, setTeamRm] = useState([]);
  const [teamStartDate, setTeamStartDate] = useState("");
  const [teamEndDate, setTeamEndDate] = useState("");
  const [teamLoanType, setTeamLoanType] = useState([]);
  const [teamLoanStatus, setTeamLoanStatus] = useState([]);
  const [teamCustStatus, setTeamCustStatus] = useState([]);
  const [isViewCustomerModal, setIsViewCustomerModal] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [isViewFollowUpModal, setIsViewFollowUpModal] = useState(false);
  const [viewFollowUpDeal, setViewFollowUpDeal] = useState(null);
  const [editingDeal, setEditingDeal] = useState(null);
  const [topPerfFilter, setTopPerfFilter] = useState([]);
  const [topPerfStartDate, setTopPerfStartDate] = useState("");
  const [topPerfEndDate, setTopPerfEndDate] = useState("");
  const [topPerfLoanType, setTopPerfLoanType] = useState([]);
  const [topPerfBranch, setTopPerfBranch] = useState([]);
  const [followUpSearch, setFollowUpSearch] = useState("");
  const debouncedFollowUpSearch = useDebounce(followUpSearch, 350);
  const [isEditDealModalOpen, setIsEditDealModalOpen] = useState(false);
  const [editDealForm, setEditDealForm] = useState({});
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [selectedDealForFollowUp, setSelectedDealForFollowUp] = useState(null);
  const [followUpForm, setFollowUpForm] = useState({ startDate: "", endDate: "", remark: "", status: "Medium" });
  const [followUpFilter, setFollowUpFilter] = useState({ start: "", end: "" });
  const [newDeal, setNewDeal] = useState({
    client: "", businessName: "", phone: "", branch: "NRD", amount: "", approvedAmount: "",
    repUsername: "", status: "Pending", loanType: "Personal Loan", rate: "", tenor: "",
    incomeStatus: "Pending", incomeType: "Salary", incomeAmount: "", customerStatus: "Medium",
    existingBank: "", loanOutstanding: "", existingRate: "", maturityDate: "",
  });

  const isAdmin = loggedInUser?.role === "admin";
  const isBM = loggedInUser?.role === "bm";
  const rmList = useMemo(() => appUsers.filter(u => u.role === "rm"), [appUsers]);
  const showToast = useCallback((msg) => { setSuccessToast(msg); setTimeout(() => setSuccessToast(null), 3500); }, []);
  const formatCurrency = useCallback((n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n), []);
  const statusBadge = useCallback((s) => ({
    Won: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Pending: "bg-amber-50 text-amber-700 border-amber-200",
    Rejected: "bg-red-50 text-red-700 border-red-200",
    "Pre-Approval": "bg-blue-50 text-blue-700 border-blue-200",
    Processing: "bg-purple-50 text-purple-700 border-purple-200",
    LOS: "bg-indigo-50 text-indigo-700 border-indigo-200",
    LOO: "bg-teal-50 text-teal-700 border-teal-200",
  }[s] || "bg-slate-50 text-slate-700 border-slate-200"), []);

  // ─── IMPROVEMENT #2 — Firestore-level query builder ──────────────────────────
  // Returns a Firestore query constrained to what the current user can see,
  // with optional status/branch/date filters applied server-side.
  const buildDealsQuery = useCallback((filters = {}, pageSize = PAGE_SIZE, afterDoc = null) => {
    const dealsRef = collection(db, "artifacts", appId, "public", "data", "deals");
    const constraints = [];

    // Role-based scoping — done at query level, not in memory
    if (!isAdmin && !isBM && loggedInUser) {
      constraints.push(where("rmUsername", "==", loggedInUser.username));
    } else if (isBM && loggedInUser) {
      const branches = loggedInUser.branches || [loggedInUser.branch];
      // Firestore "in" supports up to 30 values
      constraints.push(where("branch", "in", branches.slice(0, 30)));
    }
    if (filters.status && filters.status.length > 0) {
      constraints.push(where("status", "in", filters.status.slice(0, 30)));
    }
    if (filters.branch && filters.branch.length > 0) {
      constraints.push(where("branch", "in", filters.branch.slice(0, 30)));
    }
    if (filters.loanType && filters.loanType.length > 0) {
      constraints.push(where("loanType", "in", filters.loanType.slice(0, 30)));
    }
    if (filters.rmUsername && filters.rmUsername.length > 0) {
      constraints.push(where("rmUsername", "in", filters.rmUsername.slice(0, 30)));
    }
    if (filters.startDate) constraints.push(where("date", ">=", filters.startDate));
    if (filters.endDate) constraints.push(where("date", "<=", filters.endDate));

    constraints.push(orderBy("date", "desc"));
    constraints.push(limit(pageSize));
    if (afterDoc) constraints.push(startAfter(afterDoc));

    return query(dealsRef, ...constraints);
  }, [isAdmin, isBM, loggedInUser]);

  // ─── IMPROVEMENT #1 — initial page load (first PAGE_SIZE deals) ──────────────
  const loadInitialDeals = useCallback(() => {
    if (!loggedInUser) return () => {};
    setIsSyncing(true);
    const loadDeals = async () => {
  try {
    setIsSyncing(true);
    const response = await fetch("https://9d6ce4334b3bea639cf39b918d5636.86.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/081d1e52035941b99fdf4faec74c4c97/triggers/manual/paths/invoke?api-version=1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    const data = await response.json();

    const formattedDeals = data.map((item, index) => ({
      id: item.ID,
      client: item.CustomerName,
      phone: item.Phone,
      rmName: item.RMName,
      branch: item.Branch,
      amount: item.LoanAmount,
      status: item.Status,
      loanType: item.Product,
      no: index + 1
    }));

    setDeals(formattedDeals);
    setTotalDealCount(formattedDeals.length);
    setIsSyncing(false);

  } catch (err) {
    console.error(err);
    setIsSyncing(false);
  }
};

loadDeals();

return () => {};
  }, [loggedInUser, buildDealsQuery]);

  // ─── IMPROVEMENT #1 — load next page ─────────────────────────────────────────
  const loadMoreDeals = async () => {
    if (!hasMoreDeals || isLoadingMore || !lastDealDoc) return;
    setIsLoadingMore(true);
    try {
      const q = buildDealsQuery({}, PAGE_SIZE, lastDealDoc);
      const snap = await getDocs(q);
      const more = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      setDeals(prev => [...prev, ...more]);
      setLastDealDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMoreDeals(snap.docs.length === PAGE_SIZE);
    } catch (err) { console.error("loadMore:", err); }
    setIsLoadingMore(false);
  };

  // ─── IMPROVEMENT #5 — memoised visible/filtered deals ────────────────────────
  const visibleDeals = useMemo(() => deals, [deals]);

  const filteredDeals = useMemo(() => {
    if (!debouncedSearch.trim()) return visibleDeals;
    const q = debouncedSearch.toLowerCase();
    return visibleDeals.filter(d =>
      d.client?.toLowerCase().includes(q) ||
      d.businessName?.toLowerCase().includes(q) ||
      d.rmName?.toLowerCase().includes(q)
    );
  }, [visibleDeals, debouncedSearch]);

  // ─── Session keep-alive + expiry ──────────────────────────────────────────────
  useEffect(() => {
    if (!loggedInUser) return;
    const check = setInterval(() => {
      const expiry = parseInt(sessionStorage.getItem("sessionExpiry") || "0");
      if (expiry && Date.now() > expiry) handleLogout();
    }, 60000);
    const reset = () => {
      const expiry = Date.now() + SESSION_TIMEOUT_MS;
      sessionStorage.setItem("sessionExpiry", String(expiry));
      setLoggedInUser(p => p ? { ...p, sessionExpiry: expiry } : p);
    };
    window.addEventListener("click", reset);
    window.addEventListener("keypress", reset);
    return () => { clearInterval(check); window.removeEventListener("click", reset); window.removeEventListener("keypress", reset); };
  }, [loggedInUser?.username]);

  // ─── Follow-up alert notifications ───────────────────────────────────────────
  useEffect(() => {
    if (!loggedInUser || !followUps.length) return;
    const checkAlerts = () => {
      const now = Date.now();
      const my = isAdmin || isBM ? followUps : followUps.filter(f => f.rmUsername === loggedInUser.username);
      const newN = [];
      my.forEach(f => {
        if (!f.startDate) return;
        const startMs = new Date(f.startDate).setHours(8, 0, 0, 0);
        const diff = startMs - now;
        [{ key: f.id + "_1d", ms: 86400000, label: "1 day" }, { key: f.id + "_4h", ms: 14400000, label: "4 hours" }, { key: f.id + "_1h", ms: 3600000, label: "1 hour" }].forEach(({ key, ms, label }) => {
          if (diff > 0 && diff <= ms && !sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            newN.push({ id: key, title: "⏰ Follow-up in " + label, body: f.client + "  " + f.rmName, time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) });
            if ("Notification" in window && Notification.permission === "granted")
              new Notification("⏰ Follow-up in " + label, { body: f.client + "\nStart: " + f.startDate, tag: key });
          }
        });
      });
      if (newN.length) setNotifications(p => [...newN, ...p].slice(0, 50));
    };
    checkAlerts();
    const iv = setInterval(checkAlerts, 60000);
    return () => clearInterval(iv);
  }, [followUps, loggedInUser?.username]);

  // ─── Firebase auth init ───────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => { try { await signInAnonymously(auth); } catch { } };
    init();
    return onAuthStateChanged(auth, setFirebaseUser);
  }, []);

  // ─── Real-time listeners — users only (always needed) ────────────────────────
  useEffect(() => {
    if (!firebaseUser) return;
    const usersRef = collection(db, "artifacts", appId, "public", "data", "appUsers");
    const unsub = onSnapshot(usersRef, async snap => {
      if (snap.empty) { for (const a of DEFAULT_ADMINS) await addDoc(usersRef, a); return; }
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAppUsers(users);
      if (loggedInUser) {
        const r = users.find(u => u.username === loggedInUser.username);
        if (r) setLoggedInUser(p => ({ ...p, ...r }));
      }
    });
    return unsub;
  }, [firebaseUser]);

  // ─── IMPROVEMENT #4 — deals listener only after auth + user loaded ────────────
  useEffect(() => {
    if (!loggedInUser) return;
    const unsub = loadInitialDeals();
    return unsub;
  }, [loggedInUser?.username]);

  // ─── IMPROVEMENT #4 — activity logs fetched only when activity tab opened ─────
  useEffect(() => {
    if (activeTab !== "activity" || !isAdmin || activityLoaded) return;
    const actRef = collection(db, "artifacts", appId, "public", "data", "loginActivity");
    const q = query(actRef, orderBy("loginTime", "desc"), limit(200));
    const unsub = onSnapshot(q, snap => {
      const a = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      setActivityLogs(a);
      setActivityLoaded(true);
    });
    return unsub;
  }, [activeTab, isAdmin]);

  // ─── IMPROVEMENT #4 — follow-ups fetched only when deals tab opened ───────────
  useEffect(() => {
    if (activeTab !== "deals" || followUpsLoaded) return;
    const fuRef = collection(db, "artifacts", appId, "public", "data", "followUps");
    const q = query(fuRef, orderBy("createdAt", "desc"), limit(500));
    const unsub = onSnapshot(q, snap => {
      const f = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      setFollowUps(f);
      setFollowUpsLoaded(true);
    });
    return unsub;
  }, [activeTab]);

  // ─── Login activity recording ─────────────────────────────────────────────────
  const recordLoginActivity = async (user) => {
    try {
      let ip = "Unknown";
      try { const res = await fetch("https://api.ipify.org?format=json"); const data = await res.json(); ip = data.ip || "Unknown"; } catch { ip = "Could not detect"; }
      const ua = navigator.userAgent;
      const device = /Mobile|Android|iPhone|iPad/.test(ua) ? (/iPad/.test(ua) ? "Tablet" : "Mobile") : "Desktop";
      const browser = /Edg/.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Browser";
      const os = /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : "Linux";
      const actRef = collection(db, "artifacts", appId, "public", "data", "loginActivity");
      const docRef = await addDoc(actRef, { userId: user.id || user.username, username: user.username, name: user.name, role: user.role, branch: user.branch, ip, device, browser, os, loginTime: Date.now(), logoutTime: null, duration: null, status: "Active" });
      sessionStorage.setItem("activityDocId", docRef.id);
    } catch (err) { console.error("Activity log error:", err); }
  };

  const recordLogoutActivity = async () => {
    try {
      const docId = sessionStorage.getItem("activityDocId");
      if (!docId) return;
      const logoutTime = Date.now();
      const found = activityLogs.find(a => a.id === docId);
      const loginTime = found?.loginTime || logoutTime;
      const diffMs = logoutTime - loginTime;
      const mins = Math.floor(diffMs / 60000);
      const hrs = Math.floor(mins / 60);
      const duration = hrs > 0 ? hrs + "h " + (mins % 60) + "m" : mins + "m";
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "loginActivity", docId), { logoutTime, duration, status: "Logged Out" });
      sessionStorage.removeItem("activityDocId");
    } catch (err) { console.error("Logout log error:", err); }
  };

  // ─── Export helpers ───────────────────────────────────────────────────────────
  const handleExportCustomers = (d) => { exportToExcel(d.map((x, i) => ({ ...x, no: i + 1, status: x.status === "Won" ? "Completed Drawdown" : x.status })), "Customers", CUSTOMER_HEADERS); showToast("✅ Exported!"); };
  const handleExportUsers = () => { exportToExcel(appUsers.map((u, i) => ({ ...u, no: i + 1, role: u.role === "admin" ? "Administrator" : u.role === "bm" ? "Branch Manager" : "Relationship Manager" })), "Users", USER_HEADERS); showToast("✅ Users exported!"); };
  const handleDownloadTemplate = () => {
    const csv = "\uFEFF" + [["Customer Name", "Business/Workplace", "Phone", "Branch", "Loan Type", "Request Amount ($)", "Approved Amount ($)", "Rate (%)", "Tenor (months)", "Income Type", "Income Amount ($)", "Income Status", "Customer Priority", "Loan Status", "Existing Bank", "Loan Outstanding ($)", "Existing Rate (%)", "Maturity Date", "RM Username"], ["John Smith", "Acme Corp", "+855 12 345 678", "NRD", "Personal Loan", "50000", "45000", "5.5", "36", "Salary", "3000", "Verified", "Medium", "Pending", "ABA Bank", "20000", "7", "2026-12-31", "rm_username"]].map(r => r.map(v => '"' + String(v) + '"').join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })); a.download = "Template.csv"; document.body.appendChild(a); a.click(); document.body.removeChild(a); showToast("✅ Downloaded!");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result; const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { setImportErrors(["File is empty."]); return; }
      const parseRow = (line) => { const r = []; let cur = ""; let inQ = false; for (let i = 0; i < line.length; i++) { if (line[i].charCodeAt(0) === 34) inQ = !inQ; else if (line[i] === "," && !inQ) { r.push(cur.trim()); cur = ""; } else cur += line[i]; } r.push(cur.trim()); return r; };
      const hdr = parseRow(lines[0]).map(h => h.replace(/"/g, "").toLowerCase().trim());
      const errors = []; const preview = [];
      const colMap = { client: ["customer name", "name", "client"], businessName: ["business", "workplace"], phone: ["phone", "telegram"], branch: ["branch"], loanType: ["loan type", "product"], amount: ["request amount ($)", "request amount", "amount"], approvedAmount: ["approved amount ($)", "approved amount"], rate: ["rate (%)", "rate"], tenor: ["tenor (months)", "tenor"], incomeType: ["income type"], incomeAmount: ["income amount ($)", "income amount"], incomeStatus: ["income status"], customerStatus: ["customer priority", "priority"], status: ["loan status", "status"], existingBank: ["existing bank"], loanOutstanding: ["loan outstanding ($)", "loan outstanding"], existingRate: ["existing rate (%)", "existing rate"], maturityDate: ["maturity date"], rmUsername: ["rm username", "rm"] };
      const getCol = (keys) => { for (const k of keys) { const i = hdr.findIndex(h => h.includes(k)); if (i !== -1) return i; } return -1; };
      const idx = {}; for (const [f, k] of Object.entries(colMap)) idx[f] = getCol(k);
      lines.slice(1).forEach((line, rn) => {
        if (!line.trim()) return;
        const cols = parseRow(line).map(c => c.replace(/^"|"$/g, "").trim());
        const get = (f) => idx[f] !== -1 ? cols[idx[f]] || "" : "";
        const client = get("client"), branch = get("branch"), amount = parseFloat(get("amount")) || 0;
        const re2 = [];
        if (!client) re2.push("Row " + (rn + 2) + ": Customer Name required");
        if (!branch) re2.push("Row " + (rn + 2) + ": Branch required");
        if (!amount) re2.push("Row " + (rn + 2) + ": Amount must be a number");
        if (branch && !BRANCHES.includes(branch)) re2.push("Row " + (rn + 2) + ": Invalid branch " + branch);
        if (re2.length) { errors.push(...re2); return; }
        const rmUser = appUsers.find(u => u.username === get("rmUsername"));
        preview.push({ client, businessName: get("businessName"), phone: get("phone"), branch, loanType: get("loanType") || "Personal Loan", amount, approvedAmount: parseFloat(get("approvedAmount")) || 0, rate: parseFloat(get("rate")) || 0, tenor: parseInt(get("tenor")) || 0, incomeType: get("incomeType") || "Salary", incomeAmount: parseFloat(get("incomeAmount")) || 0, incomeStatus: get("incomeStatus") || "Pending", customerStatus: get("customerStatus") || "Medium", status: get("status") || "Pending", existingBank: get("existingBank"), loanOutstanding: parseFloat(get("loanOutstanding")) || 0, existingRate: parseFloat(get("existingRate")) || 0, maturityDate: get("maturityDate"), rmUsername: rmUser?.username || loggedInUser.username, rmName: rmUser?.name || loggedInUser.name, date: new Date().toISOString().split("T")[0], createdAt: Date.now() });
      });
      setImportErrors(errors); setImportPreview(preview);
    };
    reader.readAsText(file, "UTF-8"); e.target.value = "";
  };

  const handleImportSave = async () => {
    if (!importPreview.length) return; setIsImporting(true);
    try {
      const ref = collection(db, "artifacts", appId, "public", "data", "deals");
      for (const d of importPreview) await addDoc(ref, d);
      showToast("✅ " + importPreview.length + " imported!"); setIsImportModalOpen(false); setImportPreview([]); setImportErrors([]);
    } catch { showToast("❌ Import failed."); }
    setIsImporting(false);
  };

  // ─── AI helpers ───────────────────────────────────────────────────────────────
  const callGeminiAPI = async (prompt) => {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=";
    let r = 3, d = 1000;
    while (r > 0) {
      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
        if (!res.ok) throw new Error();
        const data = await res.json();
        return data.candidates[0].content.parts[0].text;
      } catch { r--; if (!r) return "AI unavailable."; await new Promise(x => setTimeout(x, d)); d *= 2; }
    }
  };

  const handleAnalyzePipeline = async () => {
    setIsAiLoading(true); setIsPriorityModalOpen(true); setPriorityList([]); setPriorityTabFilter("High");
    const list = visibleDeals.filter(d => d.customerStatus).map(d => ({ customerName: d.client, businessName: d.businessName || "", amount: d.amount || 0, loanType: d.loanType || "", rmName: d.rmName || "", priorityLevel: d.customerStatus || "Medium", reason: (d.loanType || "Loan") + "  Status: " + d.status + "  Income: " + (d.incomeType || "N/A"), status: d.status, branch: d.branch })).sort((a, b) => ({ High: 0, Medium: 1, Low: 2 }[a.priorityLevel] ?? 1) - ({ High: 0, Medium: 1, Low: 2 }[b.priorityLevel] ?? 1));
    setPriorityList(list.length ? list : [{ customerName: "No customers with priority set", reason: "Please assign Customer Status when creating customers.", priorityLevel: "Low" }]);
    setIsAiLoading(false);
  };

  const handleDraftEmail = async (deal) => {
    setSelectedDealForEmail(deal); setIsEmailModalOpen(true); setEmailDraft(""); setIsAiLoading(true);
    const draft = await callGeminiAPI("Write a professional follow-up email from RM " + (deal.rmName || "our team") + " to " + deal.client + " about a " + (deal.loanType || "loan") + " worth $" + deal.amount + ". Under 150 words, no subject line.");
    setEmailDraft(draft); setIsAiLoading(false);
  };

  const copyToClipboard = (text) => { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); showToast("✅ Copied!"); } catch { } document.body.removeChild(ta); };

  // ─── CRUD helpers ─────────────────────────────────────────────────────────────
  const handleAddDeal = async (e) => {
    e.preventDefault(); if (!newDeal.client || !newDeal.amount) return; setIsSyncing(true);
    const rm = isAdmin && newDeal.repUsername ? appUsers.find(u => u.username === newDeal.repUsername) : loggedInUser;
    const deal = { client: newDeal.client, businessName: newDeal.businessName, phone: newDeal.phone, branch: newDeal.branch, amount: parseFloat(newDeal.amount), rmUsername: rm?.username || loggedInUser.username, rmName: rm?.name || loggedInUser.name, status: newDeal.status, loanType: newDeal.loanType, rate: parseFloat(newDeal.rate) || 0, tenor: parseInt(newDeal.tenor) || 0, incomeStatus: newDeal.incomeStatus, incomeType: newDeal.incomeType || "Salary", incomeAmount: parseFloat(newDeal.incomeAmount) || 0, customerStatus: newDeal.customerStatus || "Medium", approvedAmount: parseFloat(newDeal.approvedAmount) || 0, existingBank: newDeal.existingBank || "", loanOutstanding: parseFloat(newDeal.loanOutstanding) || 0, existingRate: parseFloat(newDeal.existingRate) || 0, maturityDate: newDeal.maturityDate || "", date: new Date().toISOString().split("T")[0], createdAt: Date.now() };
    try {
      await fetch("https://9d6ce4334b3bea639cf39b918d5636.86.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/6373bc49b6b24fa3ac4cbd1b7e27f570/triggers/manual/paths/invoke?api-version=1", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    CustomerName: deal.client,
    Phone: deal.phone,
    RMName: deal.rmName,
    Branch: deal.branch,
    Product: deal.loanType,
    LoanAmount: deal.amount,
    Status: deal.status,
    NextFollowUp: "",
    Remarks: "",
    UpdatedBy: deal.rmName,
    UpdatedDate: new Date().toISOString()
  })
});
      setNewDeal({ client: "", businessName: "", phone: "", branch: loggedInUser?.branch || "NRD", amount: "", approvedAmount: "", repUsername: "", status: "Pending", loanType: "Personal Loan", rate: "", tenor: "", incomeStatus: "Pending", incomeType: "Salary", incomeAmount: "", customerStatus: "Medium", existingBank: "", loanOutstanding: "", existingRate: "", maturityDate: "" });
      setIsAddDealModalOpen(false); showToast("✅ Customer " + deal.client + " created!");
    } catch (err) { console.error(err); } finally { setIsSyncing(false); }
  };

  const handleUpdateDeal = async (e) => {
    e.preventDefault(); if (!editingDeal) return; setIsSyncing(true);
    try {
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "deals", editingDeal.id), { client: editDealForm.client, businessName: editDealForm.businessName, phone: editDealForm.phone, branch: editDealForm.branch, amount: parseFloat(editDealForm.amount) || 0, loanType: editDealForm.loanType, rate: parseFloat(editDealForm.rate) || 0, tenor: parseInt(editDealForm.tenor) || 0, incomeStatus: editDealForm.incomeStatus, status: editDealForm.status, customerStatus: editDealForm.customerStatus || "Medium", incomeType: editDealForm.incomeType || "Salary", incomeAmount: parseFloat(editDealForm.incomeAmount) || 0, approvedAmount: parseFloat(editDealForm.approvedAmount) || 0, ...(isAdmin && editDealForm.repUsername ? { rmUsername: editDealForm.repUsername, rmName: appUsers.find(u => u.username === editDealForm.repUsername)?.name || editingDeal.rmName } : {}) });
      setIsEditDealModalOpen(false); setEditingDeal(null); showToast("✅ Customer updated!");
    } catch (err) { console.error(err); } finally { setIsSyncing(false); }
  };

  const openEditDeal = (deal) => {
    setEditingDeal(deal);
    setEditDealForm({ client: deal.client || "", businessName: deal.businessName || "", phone: deal.phone || "", branch: deal.branch || "NRD", amount: deal.amount || "", approvedAmount: deal.approvedAmount || "", loanType: deal.loanType || "Personal Loan", rate: deal.rate || "", tenor: deal.tenor || "", incomeStatus: deal.incomeStatus || "Pending", incomeType: deal.incomeType || "Salary", incomeAmount: deal.incomeAmount || "", customerStatus: deal.customerStatus || "Medium", status: deal.status || "Pending", repUsername: deal.rmUsername || "" });
    setIsEditDealModalOpen(true);
  };

  const handleDeleteDeal = async (dealId, clientName) => {
    if (!dealId || typeof dealId !== "string") { showToast("❌ Cannot delete."); return; }
    if (!window.confirm("Delete " + clientName + "?")) return;
    try { await deleteDoc(doc(db, "artifacts", appId, "public", "data", "deals", dealId)); showToast("✅ " + clientName + " deleted."); } catch { showToast("❌ Delete failed."); }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault(); if (!newUser.username || !newUser.password || !newUser.name) return;
    const exists = appUsers.find(u => u.username === newUser.username && u.id !== editingUser?.id);
    if (exists) { showToast("❌ Username already exists!"); return; }
    const usersRef = collection(db, "artifacts", appId, "public", "data", "appUsers");
    if (editingUser) {
      const upd = { name: newUser.name, role: newUser.role, branch: newUser.branch, branches: newUser.role === "bm" ? newUser.branches || [newUser.branch] : [newUser.branch] };
      if (newUser.password !== "") { upd.password = await hashPassword(newUser.password); upd.passwordHashed = true; }
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "appUsers", editingUser.id), upd);
      showToast("✅ User " + newUser.name + " updated!");
    } else {
      const hp = await hashPassword(newUser.password);
      await addDoc(usersRef, { ...newUser, branches: newUser.role === "bm" ? newUser.branches || [newUser.branch] : [newUser.branch], password: hp, passwordHashed: true, createdAt: Date.now() });
      showToast("✅ User " + newUser.name + " created!");
    }
    setNewUser({ username: "", password: "", name: "", role: "rm", branch: "NRD", branches: [] }); setEditingUser(null); setIsUserModalOpen(false);
  };

  const handleDeleteUser = async (userId, userName) => { if (!window.confirm("Delete " + userName + "?")) return; await deleteDoc(doc(db, "artifacts", appId, "public", "data", "appUsers", userId)); showToast("✅ " + userName + " deleted."); };
  const handleEditUser = (u) => { setEditingUser(u); setNewUser({ username: u.username, password: "", name: u.name, role: u.role, branch: u.branch || "NRD", branches: u.branches || [u.branch || "NRD"] }); setIsUserModalOpen(true); };

  const handleLogout = async () => {
    await recordLogoutActivity();
    sessionStorage.removeItem("sessionExpiry");
    setLoggedInUser(null); setDeals([]); setLastDealDoc(null); setHasMoreDeals(true);
    setFollowUps([]); setFollowUpsLoaded(false); setActivityLogs([]); setActivityLoaded(false);
    setActiveTab("dashboard");
  };

  const handleSaveFollowUp = async (e) => {
    e.preventDefault();
    if (!selectedDealForFollowUp || !followUpForm.startDate || !followUpForm.endDate || !followUpForm.remark.trim()) return;
    try {
      const newFU = { dealId: selectedDealForFollowUp.id, client: selectedDealForFollowUp.client, branch: selectedDealForFollowUp.branch, amount: selectedDealForFollowUp.amount, rate: selectedDealForFollowUp.rate, date: selectedDealForFollowUp.date, rmUsername: loggedInUser.username, rmName: loggedInUser.name, startDate: followUpForm.startDate, endDate: followUpForm.endDate, remark: followUpForm.remark.trim(), status: followUpForm.status || "Medium", createdAt: Date.now(), locked: true };
      await addDoc(collection(db, "artifacts", appId, "public", "data", "followUps"), newFU);
      // Optimistic local update — no need to re-fetch
      setFollowUps(p => [{ ...newFU, id: "temp_" + Date.now() }, ...p]);
      setIsFollowUpModalOpen(false); setFollowUpForm({ startDate: "", endDate: "", remark: "", status: "Medium" }); setSelectedDealForFollowUp(null);
      showToast("✅ Follow-up saved!");
    } catch { showToast("❌ Failed to save."); }
  };

  const handlePhotoUpload = async (userId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => { await updateDoc(doc(db, "artifacts", appId, "public", "data", "appUsers", userId), { photoUrl: e.target.result }); showToast("✅ Photo updated!"); };
    reader.readAsDataURL(file);
  };

  if (!loggedInUser) return (
    <LoginPage onLogin={(u) => {
      setLoggedInUser(u);
      setNewDeal(p => ({ ...p, branch: u.branch || "NRD" }));
      setTimeout(() => recordLoginActivity(u), 800);
    }} />
  );

  // ─── Sidebar nav ──────────────────────────────────────────────────────────────
  const SidebarNav = () => (
    <nav className="flex-1 px-4 py-6 space-y-1">
      {[
        { id: "dashboard", icon: <LayoutDashboard size={19} />, label: "Dashboard" },
        { id: "team", icon: <Users size={19} />, label: "Sale Performance" },
        { id: "deals", icon: <Briefcase size={19} />, label: "List Customer Follow Up" },
        ...(isAdmin ? [
          { id: "users", icon: <Shield size={19} />, label: "User Created", badge: "Admin" },
          { id: "activity", icon: <Activity size={19} />, label: "Login Activity", badge: "Admin" },
        ] : []),
      ].map(item => (
        <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
          className={"w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all " + (activeTab === item.id ? "bg-gradient-to-r from-red-600/40 to-red-500/20 text-white border border-red-500/40 shadow-sm" : "text-slate-400 hover:bg-white/5 hover:text-white")}>
          {item.icon}
          <span className="font-medium flex-1 text-left">{item.label}</span>
          {item.badge && <span className="text-xs bg-red-500/30 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">{item.badge}</span>}
        </button>
      ))}
      <div className="pt-4 border-t border-white/10 mt-4">
        <div className="px-4 py-3 bg-white/5 rounded-xl mb-2 border border-white/10">
          <p className="text-sm font-bold text-white">{loggedInUser.name}</p>
          <p className="text-xs text-slate-400">{isAdmin ? "⭐ Administrator" : isBM ? "🏢 Branch Manager" : "👤 RM"}  {loggedInUser.branch}</p>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
          <LogOut size={19} /><span className="font-medium">Logout</span>
        </button>
      </div>
    </nav>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 shadow-2xl"
        style={{ background: "linear-gradient(180deg,#1A0000 0%,#2D0010 50%,#1A0000 100%)" }}>
        <div className="p-5 border-b border-white/10 flex items-center space-x-3">
          <img src={CIMB_LOGO_SRC} alt="CIMB" style={{ height: 40, borderRadius: 6 }} />
          <div><span className="text-sm font-bold text-white block">CIMB Bank</span><span className="text-xs text-red-300">Loan Pipeline</span></div>
        </div>
        <SidebarNav />
      </aside>

      {/* Sidebar mobile overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setIsMobileMenuOpen(false)}></div>
          <aside className="absolute top-0 left-0 w-64 h-full flex flex-col shadow-2xl" style={{ background: "linear-gradient(180deg,#1A0000 0%,#2D0010 50%,#1A0000 100%)" }}>
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <img src={CIMB_LOGO_SRC} alt="CIMB" style={{ height: 36, borderRadius: 6 }} />
              <button onClick={() => setIsMobileMenuOpen(false)}><X size={22} className="text-slate-400" /></button>
            </div>
            <SidebarNav />
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-2">
            <button className="md:hidden p-2 rounded-xl hover:bg-slate-100" onClick={() => setIsMobileMenuOpen(true)}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="17" y2="6" /><line x1="3" y1="12" x2="17" y2="12" /><line x1="3" y1="18" x2="17" y2="18" /></svg>
            </button>
            <span className="text-sm font-semibold text-slate-700">👋 {loggedInUser.name}</span>
            <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (isAdmin ? "bg-purple-100 text-purple-700" : isBM ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700")}>
              {isAdmin ? "⭐ Admin" : isBM ? "🏢 BM" : "👤 RM"}  {loggedInUser.branch}
            </span>
            {/* IMPROVEMENT #1 — show total deal count */}
            {totalDealCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                {totalDealCount} total records
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNotifPanel(p => !p)} className="relative p-2 rounded-xl hover:bg-slate-100">
              <Bell size={20} className={notifications.length > 0 ? "text-indigo-600" : "text-slate-400"} />
              {notifications.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{notifications.length > 9 ? "9+" : notifications.length}</span>}
            </button>
          </div>
        </div>

        {/* Notification panel */}
        {showNotifPanel && (
          <div className="fixed top-14 right-4 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 max-h-[70vh] flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">⏰ Follow-up Alerts ({notifications.length})</h3>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && <button onClick={() => setNotifications([])} className="text-xs text-slate-400 hover:text-red-500">Clear all</button>}
                <button onClick={() => setShowNotifPanel(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (<div className="py-10 text-center text-slate-400"><Bell size={28} className="mx-auto mb-2 opacity-30" /><p className="text-sm">No alerts</p></div>) :
                notifications.map((n, i) => (
                  <div key={n.id || i} className="px-4 py-3 border-b border-slate-50 hover:bg-slate-50">
                    <p className="font-semibold text-slate-800 text-sm">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>
                    <p className="text-xs text-slate-400 mt-1">{n.time}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="flex-1 p-4 md:p-6 overflow-y-auto">

          {/* ── DASHBOARD TAB ────────────────────────────────────────────────── */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              {/* AI Banner */}
              <div className="relative overflow-hidden rounded-3xl p-7 shadow-2xl" style={{ background: "linear-gradient(135deg,#8B0000 0%,#C8102E 50%,#E31837 100%)" }}>
                <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                  <div>
                    <h3 className="text-xl font-bold text-white">Customer Priority Analysis</h3>
                    <p className="text-emerald-100/70 mt-1 text-sm">AI-ranked customers that need immediate follow-up.</p>
                  </div>
                  <button onClick={handleAnalyzePipeline} disabled={isAiLoading}
                    className="whitespace-nowrap flex items-center space-x-2 bg-white hover:bg-red-50 disabled:opacity-50 text-red-700 px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-all">
                    {isAiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    <span>View Customer Priority</span>
                  </button>
                </div>
              </div>

              {/* Dashboard filters */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <MultiSelect label="Status" color="indigo" options={[{ value: "Pending", label: "🔵 Pipeline" }, { value: "Pre-Approval", label: "🟡 Pre-Approval" }, { value: "Processing", label: "🟣 Processing" }, { value: "LOS", label: "🟤 LOS" }, { value: "LOO", label: "🔵 LOO" }, { value: "Won", label: "🟢 Completed" }, { value: "Rejected", label: "🔴 Rejected" }]} selected={topPerfFilter} onChange={setTopPerfFilter} />
                  <MultiSelect label="Branch" color="emerald" options={BRANCHES.map(b => ({ value: b, label: b }))} selected={topPerfBranch} onChange={setTopPerfBranch} />
                  <MultiSelect label="Product" color="purple" options={LOAN_TYPES.map(t => ({ value: t, label: t }))} selected={topPerfLoanType} onChange={setTopPerfLoanType} />
                  <div className="flex items-center gap-1.5"><span className="text-xs text-slate-400 font-medium">From</span><input type="date" value={topPerfStartDate} onChange={e => setTopPerfStartDate(e.target.value)} className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none text-slate-700" /></div>
                  <div className="flex items-center gap-1.5"><span className="text-xs text-slate-400 font-medium">To</span><input type="date" value={topPerfEndDate} onChange={e => setTopPerfEndDate(e.target.value)} className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none text-slate-700" /></div>
                  {(topPerfFilter.length > 0 || topPerfBranch.length > 0 || topPerfLoanType.length > 0 || topPerfStartDate || topPerfEndDate) && (
                    <button onClick={() => { setTopPerfFilter([]); setTopPerfBranch([]); setTopPerfLoanType([]); setTopPerfStartDate(""); setTopPerfEndDate(""); }} className="text-xs text-red-400 hover:text-red-600 font-semibold px-3 py-2 bg-red-50 rounded-xl">✕ Reset</button>
                  )}
                </div>
              </div>

              {/* KPI Cards */}
              {(() => {
                let dashDeals = visibleDeals;
                if (topPerfLoanType.length > 0) dashDeals = dashDeals.filter(d => topPerfLoanType.includes(d.loanType));
                if (topPerfBranch.length > 0) dashDeals = dashDeals.filter(d => topPerfBranch.includes(d.branch));
                if (topPerfStartDate) dashDeals = dashDeals.filter(d => d.date >= topPerfStartDate);
                if (topPerfEndDate) dashDeals = dashDeals.filter(d => d.date <= topPerfEndDate);
                const amt = (st) => dashDeals.filter(d => d.status === st).reduce((s, d) => s + d.amount, 0);
                const cards = [
                  { title: "Pipeline", status: "Pending", value: dashDeals.filter(d => d.status === "Pending").length, sub: formatCurrency(amt("Pending")), gradient: "from-amber-500 to-orange-500", bg: "from-amber-50 to-orange-50", border: "border-amber-200", text: "text-amber-700", icon: <Target size={20} /> },
                  { title: "Pre-Approval", status: "Pre-Approval", value: dashDeals.filter(d => d.status === "Pre-Approval").length, sub: formatCurrency(amt("Pre-Approval")), gradient: "from-blue-500 to-cyan-500", bg: "from-blue-50 to-cyan-50", border: "border-blue-200", text: "text-blue-700", icon: <CheckCircle size={20} /> },
                  { title: "Processing", status: "Processing", value: dashDeals.filter(d => d.status === "Processing").length, sub: formatCurrency(amt("Processing")), gradient: "from-violet-500 to-purple-500", bg: "from-violet-50 to-purple-50", border: "border-violet-200", text: "text-violet-700", icon: <Loader2 size={20} /> },
                  { title: "LOS", status: "LOS", value: dashDeals.filter(d => d.status === "LOS").length, sub: formatCurrency(amt("LOS")), gradient: "from-indigo-500 to-blue-600", bg: "from-indigo-50 to-blue-50", border: "border-indigo-200", text: "text-indigo-700", icon: <Briefcase size={20} /> },
                  { title: "LOO", status: "LOO", value: dashDeals.filter(d => d.status === "LOO").length, sub: formatCurrency(amt("LOO")), gradient: "from-teal-500 to-emerald-500", bg: "from-teal-50 to-emerald-50", border: "border-teal-200", text: "text-teal-700", icon: <Star size={20} /> },
                  { title: "✅ Completed", status: "Won", value: dashDeals.filter(d => d.status === "Won").length, sub: formatCurrency(amt("Won")), gradient: "from-emerald-500 to-green-500", bg: "from-emerald-50 to-green-50", border: "border-emerald-200", text: "text-emerald-700", icon: <DollarSign size={20} /> },
                  { title: "Rejected", status: "Rejected", value: dashDeals.filter(d => d.status === "Rejected").length, sub: formatCurrency(amt("Rejected")), gradient: "from-red-500 to-rose-500", bg: "from-red-50 to-rose-50", border: "border-red-200", text: "text-red-700", icon: <X size={20} /> },
                  { title: "📊 Total", status: "all", value: dashDeals.length, sub: formatCurrency(dashDeals.reduce((s, d) => s + d.amount, 0)), gradient: "from-slate-500 to-slate-700", bg: "from-slate-50 to-slate-100", border: "border-slate-300", text: "text-slate-700", icon: <Briefcase size={20} /> },
                ];
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    {cards.map((card, i) => (
                      <button key={card.status} onClick={() => setStatusFilterModal({ title: card.title, status: card.status, filteredDeals: dashDeals })}
                        className={"relative overflow-hidden bg-gradient-to-br " + card.bg + " border " + card.border + " rounded-2xl p-4 hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col items-center justify-center w-full"}>
                        <div className={"absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r " + card.gradient + " rounded-t-2xl"}></div>
                        <div className={"flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br " + card.gradient + " shadow-md mb-3 group-hover:scale-110 transition-transform"}>
                          <span className="text-white">{React.cloneElement(card.icon, { size: 20 })}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-500 mb-1 text-center uppercase tracking-wide leading-tight">{card.title}</p>
                        <p className={"text-3xl font-extrabold " + card.text + " text-center"}>{card.value}</p>
                        <p className="text-xs text-slate-400 mt-1 text-center font-medium">{card.sub}</p>
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* Top Performance by Branch */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b flex flex-wrap gap-3 justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-800">🏆 Top Performance by Branch</h3>
                  <button onClick={() => handleExportCustomers(visibleDeals)}
                    className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-medium">
                    <FileDown size={16} /><span>Export Excel</span>
                  </button>
                </div>
                {(() => {
                  const branchesToShow = isAdmin ? BRANCHES : isBM ? loggedInUser.branches || [loggedInUser.branch] : [loggedInUser.branch];
                  const perfList = branchesToShow.filter(br => topPerfBranch.length === 0 || topPerfBranch.includes(br)).map(br => {
                    let brDeals = topPerfFilter.length === 0 ? deals.filter(d => d.branch === br) : deals.filter(d => d.branch === br && topPerfFilter.includes(d.status));
                    if (topPerfLoanType.length > 0) brDeals = brDeals.filter(d => topPerfLoanType.includes(d.loanType));
                    if (topPerfStartDate) brDeals = brDeals.filter(d => d.date >= topPerfStartDate);
                    if (topPerfEndDate) brDeals = brDeals.filter(d => d.date <= topPerfEndDate);
                    return { branch: br, filteredCount: brDeals.length, filteredTotal: brDeals.reduce((s, d) => s + d.amount, 0) };
                  }).sort((a, b) => b.filteredTotal - a.filteredTotal);
                  const maxVal = perfList[0]?.filteredTotal || 1;
                  return perfList.map((br, i) => (
                    <div key={br.branch} onClick={() => setStatusFilterModal({ title: "Branch " + br.branch, status: "all", branchFilter: br.branch })}
                      className="flex items-center px-5 py-4 border-b last:border-0 hover:bg-indigo-50/40 transition-colors cursor-pointer">
                      <span className={"font-extrabold w-7 text-base flex-shrink-0 " + (i === 0 ? "text-amber-400" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-400" : "text-slate-300")}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1)}</span>
                      <div className="w-10 h-10 rounded-full ml-1 flex-shrink-0 bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                        <span className="text-white font-bold text-xs">{br.branch.substring(0, 3)}</span>
                      </div>
                      <div className="ml-3 flex-1 min-w-0">
                        <p className="font-bold text-slate-800">{br.branch}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className={"h-full rounded-full " + (i === 0 ? "bg-amber-400" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-400" : "bg-indigo-300")} style={{ width: (maxVal > 0 ? Math.round(br.filteredTotal / maxVal * 100) : 0) + "%", transition: "width 0.8s ease" }}></div>
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0">{br.filteredCount} deals</span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-bold text-emerald-600 text-sm">{formatCurrency(br.filteredTotal)}</p>
                        <p className="text-xs text-indigo-400 mt-0.5">click to view</p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* ── SALE PERFORMANCE TAB ─────────────────────────────────────────── */}
          {activeTab === "team" && (
            <div className="max-w-7xl mx-auto">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b">
                  <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-slate-800">{isAdmin ? "All Customers" : "My Customers"}</h2>
                      <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-1 rounded-full">{filteredDeals.length} shown / {totalDealCount} total</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isBM && <button onClick={() => setIsAddDealModalOpen(true)} className="flex items-center space-x-2 bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium"><Plus size={16} /><span>New Customer</span></button>}
                      {isAdmin && <button onClick={() => { setImportPreview([]); setImportErrors([]); setIsImportModalOpen(true); }} className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-xl text-sm font-medium"><Upload size={16} /><span>Import Excel</span></button>}
                      <button onClick={() => handleExportCustomers(filteredDeals)} className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-medium"><FileDown size={16} /><span>Export Excel</span></button>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap gap-2 items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    {(isAdmin || isBM) && <MultiSelect label="RM" color="indigo" options={(() => { const visible = isAdmin ? rmList : rmList.filter(rm => (loggedInUser.branches || [loggedInUser.branch]).includes(rm.branch)); return visible.map(rm => ({ value: rm.username, label: rm.name })); })()} selected={teamRm} onChange={setTeamRm} />}
                    <MultiSelect label="Status" color="indigo" options={[{ value: "Pending", label: "🔵 Pipeline" }, { value: "Pre-Approval", label: "🟡 Pre-Approval" }, { value: "Processing", label: "🟣 Processing" }, { value: "LOS", label: "🟤 LOS" }, { value: "LOO", label: "🔵 LOO" }, { value: "Won", label: "🟢 Completed" }, { value: "Rejected", label: "🔴 Rejected" }]} selected={teamLoanStatus} onChange={setTeamLoanStatus} />
                    <MultiSelect label="Product" color="purple" options={LOAN_TYPES.map(t => ({ value: t, label: t }))} selected={teamLoanType} onChange={setTeamLoanType} />
                    <MultiSelect label="Priority" color="amber" options={[{ value: "High", label: "🔴 High" }, { value: "Medium", label: "🟡 Medium" }, { value: "Low", label: "🟢 Low" }]} selected={teamCustStatus} onChange={setTeamCustStatus} />
                    <div className="flex items-center gap-1.5"><span className="text-xs text-slate-400">From</span><input type="date" value={teamStartDate} onChange={e => setTeamStartDate(e.target.value)} className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none text-slate-700" /></div>
                    <div className="flex items-center gap-1.5"><span className="text-xs text-slate-400">To</span><input type="date" value={teamEndDate} onChange={e => setTeamEndDate(e.target.value)} className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none text-slate-700" /></div>

                    {/* IMPROVEMENT #3 — debounced search input */}
                    <div className="relative flex-1" style={{ minWidth: 180 }}>
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search customer, RM..." className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 bg-white rounded-xl outline-none text-slate-700" />
                    </div>

                    {(teamRm.length > 0 || teamLoanStatus.length > 0 || teamLoanType.length > 0 || teamCustStatus.length > 0 || teamStartDate || teamEndDate || searchQuery) && (
                      <button onClick={() => { setTeamRm([]); setTeamLoanStatus([]); setTeamLoanType([]); setTeamCustStatus([]); setTeamStartDate(""); setTeamEndDate(""); setSearchQuery(""); }} className="text-xs text-red-400 hover:text-red-600 font-semibold px-3 py-2 bg-red-50 rounded-xl">✕ Reset</button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {(() => {
                    let teamDeals = filteredDeals;
                    if (teamRm.length > 0) teamDeals = teamDeals.filter(d => teamRm.includes(d.rmUsername));
                    if (teamLoanType.length > 0) teamDeals = teamDeals.filter(d => teamLoanType.includes(d.loanType));
                    if (teamLoanStatus.length > 0) teamDeals = teamDeals.filter(d => teamLoanStatus.includes(d.status));
                    if (teamCustStatus.length > 0) teamDeals = teamDeals.filter(d => teamCustStatus.includes(d.customerStatus));
                    if (teamStartDate) teamDeals = teamDeals.filter(d => d.date >= teamStartDate);
                    if (teamEndDate) teamDeals = teamDeals.filter(d => d.date <= teamEndDate);
                    if (!teamDeals.length) return <div className="py-20 text-center text-slate-400"><Briefcase size={44} className="mx-auto mb-3 opacity-20" /><p className="font-medium">No customers found</p></div>;
                    return (
                      <>
                        <table className="w-full text-left">
                          <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b">
                            <th className="p-4">#</th><th className="p-4">Customer</th><th className="p-4">Branch</th><th className="p-4">Phone</th><th className="p-4">Loan Type</th><th className="p-4">Amount</th><th className="p-4">Income</th><th className="p-4">Priority</th><th className="p-4">RM</th><th className="p-4">Date</th><th className="p-4">Status</th><th className="p-4">Action</th>
                          </tr></thead>
                          <tbody className="divide-y divide-slate-100">
                            {teamDeals.map((deal, idx) => (
                              <tr key={deal.id} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="p-4 text-slate-400 text-sm font-medium">{idx + 1}</td>
                                <td className="p-4"><p className="font-semibold text-slate-800">{deal.client}</p>{deal.businessName && <p className="text-xs text-slate-400">{deal.businessName}</p>}</td>
                                <td className="p-4"><span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg">{deal.branch || ""}</span></td>
                                <td className="p-4"><span className="text-sm text-slate-600">{deal.phone || ""}</span></td>
                                <td className="p-4"><span className="text-sm text-slate-600">{deal.loanType || ""}</span></td>
                                <td className="p-4"><span className="font-bold text-slate-700">{formatCurrency(deal.amount)}</span></td>
                                <td className="p-4"><span className={"px-2 py-1 rounded-full text-xs font-medium " + (deal.incomeType === "Salary" ? "bg-blue-50 text-blue-700" : deal.incomeType === "Business" ? "bg-purple-50 text-purple-700" : "bg-slate-50 text-slate-600")}>{deal.incomeType || ""}</span></td>
                                <td className="p-4"><span className={"px-2.5 py-1 rounded-full text-xs font-bold " + (deal.customerStatus === "High" ? "bg-red-100 text-red-600" : deal.customerStatus === "Low" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600")}>{deal.customerStatus === "High" ? "🔴 High" : deal.customerStatus === "Low" ? "🟢 Low" : "🟡 Med"}</span></td>
                                <td className="p-4"><span className="text-sm font-medium text-slate-700">{deal.rmName || ""}</span></td>
                                <td className="p-4"><span className="text-xs text-slate-500">{new Date(deal.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></td>
                                <td className="p-4"><span className={"px-2.5 py-1 rounded-full text-xs font-medium border " + statusBadge(deal.status)}>{deal.status === "Won" ? "Completed" : deal.status}</span></td>
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    {!isBM && <button onClick={() => openEditDeal(deal)} className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-medium"><Edit2 size={12} /><span>Edit</span></button>}
                                    {isAdmin && <button onClick={() => handleDeleteDeal(deal.id, deal.client)} className="flex items-center space-x-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-xs font-medium"><Trash2 size={12} /><span>Del</span></button>}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* IMPROVEMENT #1 — Load More button */}
                        {hasMoreDeals && (
                          <div className="px-5 py-4 border-t bg-slate-50 flex items-center justify-center gap-3">
                            <span className="text-xs text-slate-400">Showing {deals.length} of {totalDealCount} records</span>
                            <button onClick={loadMoreDeals} disabled={isLoadingMore}
                              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-semibold rounded-xl transition-colors">
                              {isLoadingMore ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={13} />}
                              {isLoadingMore ? "Loading..." : "Load More (" + PAGE_SIZE + ")"}
                            </button>
                          </div>
                        )}
                        {!hasMoreDeals && deals.length > PAGE_SIZE && (
                          <div className="px-5 py-3 border-t bg-slate-50 text-center text-xs text-slate-400">
                            All {totalDealCount} records loaded ✓
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* ── FOLLOW UP TAB ────────────────────────────────────────────────── */}
          {activeTab === "deals" && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b">
                  <h2 className="text-lg font-bold text-slate-800 mb-3">📋 List Customer Follow Up</h2>
                  {/* IMPROVEMENT #3 — debounced search */}
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={followUpSearch} onChange={e => setFollowUpSearch(e.target.value)} placeholder="Search by customer name or RM name..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm text-slate-700" />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b">
                      <th className="p-4">No.</th><th className="p-4">Customer</th><th className="p-4">Branch</th><th className="p-4">Product</th><th className="p-4">Amount</th><th className="p-4">Rate</th><th className="p-4">Date</th><th className="p-4">Follow-ups</th><th className="p-4">Action</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredDeals.filter(d => {
                        if (!debouncedFollowUpSearch.trim()) return true;
                        const q = debouncedFollowUpSearch.toLowerCase();
                        return d.client?.toLowerCase().includes(q) || d.rmName?.toLowerCase().includes(q);
                      }).map((deal, idx) => {
                        const dealFollowUps = followUps.filter(f => f.dealId === deal.id);
                        return (
                          <tr key={deal.id} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="p-4 text-slate-400 text-sm">{idx + 1}</td>
                            <td className="p-4"><p className="font-semibold text-slate-800">{deal.client}</p><p className="text-xs text-slate-400">👤 {deal.rmName}</p></td>
                            <td className="p-4"><span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg">{deal.branch || ""}</span></td>
                            <td className="p-4"><span className="text-xs text-slate-600">{deal.loanType || ""}</span></td>
                            <td className="p-4"><span className="font-bold text-slate-700">{formatCurrency(deal.amount)}</span></td>
                            <td className="p-4"><span className="text-sm text-slate-600">{deal.rate ? deal.rate + "%" : ""}</span></td>
                            <td className="p-4"><span className="text-xs text-slate-500">{new Date(deal.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></td>
                            <td className="p-4">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className={"px-2.5 py-1 rounded-full text-xs font-bold " + (dealFollowUps.length > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400")}>{dealFollowUps.length} note{dealFollowUps.length !== 1 ? "s" : ""}</span>
                                {dealFollowUps.length > 0 && <button onClick={() => { setViewFollowUpDeal({ deal, followUps: dealFollowUps }); setIsViewFollowUpModal(true); }} className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100">👁 View</button>}
                              </div>
                            </td>
                            <td className="p-4">
                              <button onClick={() => { setSelectedDealForFollowUp(deal); setFollowUpForm({ startDate: "", endDate: "", remark: "", status: "Medium" }); setIsFollowUpModalOpen(true); }} className="flex items-center space-x-1 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-medium"><Plus size={12} /><span>Create Follow Up</span></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* IMPROVEMENT #1 — Load More in follow up tab too */}
                  {hasMoreDeals && (
                    <div className="px-5 py-4 border-t bg-slate-50 flex items-center justify-center gap-3">
                      <span className="text-xs text-slate-400">{deals.length} of {totalDealCount} loaded</span>
                      <button onClick={loadMoreDeals} disabled={isLoadingMore} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-semibold rounded-xl">
                        {isLoadingMore ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={13} />}
                        {isLoadingMore ? "Loading..." : "Load More"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Follow-up History */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b">
                  <div className="flex flex-wrap gap-3 items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-slate-800">📝 Follow-up History</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex items-center gap-1"><span className="text-xs text-slate-400">From</span><input type="date" value={followUpFilter.start} onChange={e => setFollowUpFilter(p => ({ ...p, start: e.target.value }))} className="text-xs border border-slate-200 bg-white rounded-xl px-2 py-2 outline-none text-slate-700" /></div>
                    <div className="flex items-center gap-1"><span className="text-xs text-slate-400">To</span><input type="date" value={followUpFilter.end} onChange={e => setFollowUpFilter(p => ({ ...p, end: e.target.value }))} className="text-xs border border-slate-200 bg-white rounded-xl px-2 py-2 outline-none text-slate-700" /></div>
                    {(followUpFilter.start || followUpFilter.end) && <button onClick={() => setFollowUpFilter({ start: "", end: "" })} className="text-xs text-red-400 px-2 py-2 rounded-xl hover:bg-red-50">✕ Reset</button>}
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {(() => {
                    let filtered = isAdmin || isBM ? followUps : followUps.filter(f => f.rmUsername === loggedInUser.username);
                    if (followUpFilter.start) filtered = filtered.filter(x => x.startDate >= followUpFilter.start);
                    if (followUpFilter.end) filtered = filtered.filter(x => x.endDate <= followUpFilter.end);
                    if (!filtered.length) return <div className="py-16 text-center text-slate-400"><p className="font-medium">No follow-ups yet</p></div>;
                    return filtered.map((f, i) => (
                      <div key={f.id} className="p-5 hover:bg-amber-50/20 transition-colors">
                        <div className="flex flex-wrap gap-4 items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className="font-bold text-slate-800">{f.client}</span>
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg">{f.branch}</span>
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg">{formatCurrency(f.amount)}</span>
                              <span className={"px-2.5 py-0.5 rounded-full text-xs font-bold border " + (f.status === "High" ? "bg-red-50 text-red-600 border-red-200" : f.status === "Low" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200")}>{f.status}</span>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"><p className="text-sm text-slate-700 leading-relaxed">💬 {f.remark}</p></div>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">{new Date(f.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} → {new Date(f.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                              <span className="text-xs text-slate-400">🔒 Locked</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-semibold text-slate-600">👤 {f.rmName}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{new Date(f.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* ── USERS TAB ────────────────────────────────────────────────────── */}
          {activeTab === "users" && isAdmin && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center">
                  <div><h2 className="text-lg font-bold text-slate-800">User Management</h2><p className="text-sm text-slate-500 mt-0.5">{appUsers.length} total accounts</p></div>
                  <div className="flex gap-2">
                    <button onClick={handleExportUsers} className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium"><FileDown size={18} /><span>Export</span></button>
                    <button onClick={() => { setEditingUser(null); setNewUser({ username: "", password: "", name: "", role: "rm", branch: "NRD", branches: [] }); setIsUserModalOpen(true); }} className="flex items-center space-x-2 bg-red-700 hover:bg-red-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium"><UserPlus size={18} /><span>New User</span></button>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {appUsers.map(u => (
                    <div key={u.id} className="flex items-center p-5 hover:bg-slate-50 transition-colors">
                      <div className="relative flex-shrink-0">
                        {u.photoUrl ? <img src={u.photoUrl} alt={u.name} className="w-11 h-11 rounded-full object-cover border-2 border-indigo-100" /> : <div className={"w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg " + (u.role === "admin" ? "bg-purple-100 text-purple-600" : "bg-indigo-100 text-indigo-600")}>{u.name?.charAt(0).toUpperCase()}</div>}
                        <label className="absolute -bottom-1 -right-1 bg-indigo-600 rounded-full p-1 cursor-pointer hover:bg-indigo-700" title="Upload photo">
                          <Upload size={10} className="text-white" />
                          <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(u.id, e.target.files[0])} />
                        </label>
                      </div>
                      <div className="ml-4 flex-1 min-w-0">
                        <div className="flex items-center space-x-2 flex-wrap gap-1">
                          <p className="font-bold text-slate-800">{u.name}</p>
                          <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (u.role === "admin" ? "bg-purple-100 text-purple-700" : u.role === "bm" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700")}>{u.role === "admin" ? "⭐ Admin" : u.role === "bm" ? "🏢 BM" : "👤 RM"}</span>
                          {u.username === loggedInUser.username && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">You</span>}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">@{u.username}  Branch: <span className="font-semibold text-slate-700">{u.branch}</span></p>
                        <p className="text-xs text-slate-400 mt-0.5">{deals.filter(d => d.rmUsername === u.username).length} customers</p>
                      </div>
                      <div className="flex space-x-2 ml-2">
                        <button onClick={() => handleEditUser(u)} className="flex items-center space-x-1 px-3 py-1.5 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-medium"><Edit2 size={13} /><span>Edit</span></button>
                        {u.username !== loggedInUser.username && <button onClick={() => handleDeleteUser(u.id, u.name)} className="flex items-center space-x-1 px-3 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-medium"><Trash2 size={13} /><span>Delete</span></button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ACTIVITY TAB ─────────────────────────────────────────────────── */}
          {activeTab === "activity" && isAdmin && (
            <div className="max-w-7xl mx-auto">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b">
                  <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-800">🔐 Login Activity Log</h2>
                    <button onClick={() => { const data = activityLogs.map((a, i) => ({ ...a, no: i + 1, loginTimeStr: a.loginTime ? new Date(a.loginTime).toLocaleString("en-US") : "", logoutTimeStr: a.logoutTime ? new Date(a.logoutTime).toLocaleString("en-US") : "Still Active" })); exportToExcel(data, "Login_Activity", ACTIVITY_HEADERS); showToast("✅ Activity exported!"); }} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-semibold"><FileDown size={15} /> Export Excel</button>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input type="text" placeholder="Search by name or username..." value={activityFilter.user} onChange={e => setActivityFilter(p => ({ ...p, user: e.target.value }))} className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none text-slate-700" style={{ minWidth: 200 }} />
                    <input type="date" value={activityFilter.date} onChange={e => setActivityFilter(p => ({ ...p, date: e.target.value }))} className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none text-slate-700" />
                    {(activityFilter.user || activityFilter.date) && <button onClick={() => setActivityFilter({ user: "", date: "" })} className="text-xs text-red-400 font-semibold px-3 py-2 bg-red-50 rounded-xl">✕ Reset</button>}
                  </div>
                </div>
                {!activityLoaded ? (
                  <div className="py-16 text-center text-slate-400"><Loader2 size={36} className="animate-spin mx-auto mb-3 text-indigo-400" /><p>Loading activity logs...</p></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b">
                        <th className="p-4">#</th><th className="p-4">User</th><th className="p-4">IP</th><th className="p-4">Device</th><th className="p-4">Browser/OS</th><th className="p-4">Login</th><th className="p-4">Logout</th><th className="p-4">Duration</th><th className="p-4">Status</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {activityLogs.filter(a => {
                          if (activityFilter.user && !a.name?.toLowerCase().includes(activityFilter.user.toLowerCase()) && !a.username?.toLowerCase().includes(activityFilter.user.toLowerCase())) return false;
                          if (activityFilter.date && !new Date(a.loginTime).toISOString().startsWith(activityFilter.date)) return false;
                          return true;
                        }).map((log, idx) => (
                          <tr key={log.id} className="hover:bg-red-50/10 transition-colors">
                            <td className="p-4 text-slate-400 text-sm">{idx + 1}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className={"w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 " + (log.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-indigo-100 text-indigo-700")}>{log.name?.charAt(0)?.toUpperCase() || "?"}</div>
                                <div><p className="font-semibold text-slate-800 text-sm">{log.name}</p><p className="text-xs text-slate-400">@{log.username}  {log.branch}</p></div>
                              </div>
                            </td>
                            <td className="p-4"><span className="font-mono text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">{log.ip || ""}</span></td>
                            <td className="p-4"><span className={"px-2.5 py-1 rounded-full text-xs font-bold " + (log.device === "Mobile" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700")}>{log.device === "Mobile" ? "📱 Mobile" : "🖥 Desktop"}</span></td>
                            <td className="p-4"><p className="text-xs font-semibold text-slate-700">{log.browser || ""}</p><p className="text-xs text-slate-400">{log.os || ""}</p></td>
                            <td className="p-4"><p className="text-xs font-semibold text-slate-700">{log.loginTime ? new Date(log.loginTime).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</p><p className="text-xs text-slate-400">{log.loginTime ? new Date(log.loginTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : ""}</p></td>
                            <td className="p-4">{log.logoutTime ? (<><p className="text-xs font-semibold text-slate-700">{new Date(log.logoutTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p><p className="text-xs text-slate-400">{new Date(log.logoutTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p></>) : <span className="text-xs text-emerald-600 font-semibold animate-pulse">🟢 Active</span>}</td>
                            <td className="p-4"><span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">{log.duration || (log.status === "Active" ? "—" : "")}</span></td>
                            <td className="p-4"><span className={"px-2.5 py-1 rounded-full text-xs font-bold border " + (log.status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200")}>{log.status === "Active" ? "🟢 Active" : "Logged Out"}</span></td>
                          </tr>
                        ))}
                        {activityLogs.length === 0 && <tr><td colSpan={9} className="py-16 text-center text-slate-400"><Activity size={40} className="mx-auto mb-3 opacity-20" /><p>No login activity yet</p></td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>{/* end main content */}
      </main>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}

      {/* Create Customer Modal */}
      {isAddDealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAddDealModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative z-10 flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex justify-between items-center rounded-t-2xl">
              <h3 className="text-lg font-bold text-slate-800">Create New Customer</h3>
              <button onClick={() => setIsAddDealModalOpen(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleAddDeal} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Customer Name *</label><input type="text" required value={newDeal.client} onChange={e => setNewDeal({ ...newDeal, client: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Branch</label>
                  {!isAdmin ? <div className="w-full px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-800 font-bold text-sm">{loggedInUser.branch}</div> : <select value={newDeal.branch} onChange={e => setNewDeal({ ...newDeal, branch: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm">{BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}</select>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Business / Workplace</label><input type="text" value={newDeal.businessName} onChange={e => setNewDeal({ ...newDeal, businessName: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone / Telegram</label><input type="text" value={newDeal.phone} onChange={e => setNewDeal({ ...newDeal, phone: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Request Amount ($) *</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span><input type="number" required min="1" value={newDeal.amount} onChange={e => setNewDeal({ ...newDeal, amount: e.target.value })} className="w-full pl-7 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" /></div></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Approved Amount ($)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 text-sm font-bold">$</span><input type="number" min="0" value={newDeal.approvedAmount} onChange={e => setNewDeal({ ...newDeal, approvedAmount: e.target.value })} className="w-full pl-7 pr-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl outline-none text-sm" /></div></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Loan Type</label><select value={newDeal.loanType} onChange={e => setNewDeal({ ...newDeal, loanType: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm">{LOAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Rate (%)</label><input type="number" step="0.01" value={newDeal.rate} onChange={e => setNewDeal({ ...newDeal, rate: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Loan Status</label><select value={newDeal.status} onChange={e => setNewDeal({ ...newDeal, status: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"><option value="Pending">Pending</option><option value="Pre-Approval">Pre-Approval</option><option value="Processing">Processing</option><option value="LOS">LOS</option><option value="LOO">LOO</option><option value="Won">Completed Drawdown</option><option value="Rejected">Rejected</option></select></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Assign RM</label>
                  {isAdmin ? <select value={newDeal.repUsername} onChange={e => setNewDeal({ ...newDeal, repUsername: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"><option value="">— Select RM —</option>{rmList.map(rm => <option key={rm.id} value={rm.username}>{rm.name}</option>)}</select> : <div className="w-full px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-800 font-medium text-sm">{loggedInUser.name} (You)</div>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Tenor (months)</label><input type="number" value={newDeal.tenor} onChange={e => setNewDeal({ ...newDeal, tenor: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" /></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Customer Priority</label><select value={newDeal.customerStatus || "Medium"} onChange={e => setNewDeal({ ...newDeal, customerStatus: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"><option value="High">🔴 High</option><option value="Medium">🟡 Medium</option><option value="Low">🟢 Low</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Income Type</label><select value={newDeal.incomeType || "Salary"} onChange={e => setNewDeal({ ...newDeal, incomeType: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm">{INCOME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Income Amount ($)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span><input type="number" min="0" value={newDeal.incomeAmount} onChange={e => setNewDeal({ ...newDeal, incomeAmount: e.target.value })} className="w-full pl-7 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" /></div></div>
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setIsAddDealModalOpen(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-xl text-sm font-semibold">✅ Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {isEditDealModalOpen && editingDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsEditDealModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Edit: {editingDeal.client}</h3>
              <button onClick={() => setIsEditDealModalOpen(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleUpdateDeal} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Customer Name *</label><input type="text" required value={editDealForm.client} onChange={e => setEditDealForm({ ...editDealForm, client: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Branch</label><select value={editDealForm.branch} onChange={e => setEditDealForm({ ...editDealForm, branch: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none">{BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
              </div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Business / Workplace</label><input type="text" value={editDealForm.businessName} onChange={e => setEditDealForm({ ...editDealForm, businessName: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Request Amount ($)</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span><input type="number" min="1" value={editDealForm.amount} onChange={e => setEditDealForm({ ...editDealForm, amount: e.target.value })} className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" /></div></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Loan Type</label><select value={editDealForm.loanType} onChange={e => setEditDealForm({ ...editDealForm, loanType: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none">{LOAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Loan Status</label><select value={editDealForm.status} onChange={e => setEditDealForm({ ...editDealForm, status: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"><option value="Pending">Pending</option><option value="Pre-Approval">Pre-Approval</option><option value="Processing">Processing</option><option value="LOS">LOS</option><option value="LOO">LOO</option><option value="Won">Completed Drawdown</option><option value="Rejected">Rejected</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Customer Priority</label><select value={editDealForm.customerStatus || "Medium"} onChange={e => setEditDealForm({ ...editDealForm, customerStatus: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"><option value="High">🔴 High</option><option value="Medium">🟡 Medium</option><option value="Low">🟢 Low</option></select></div>
                {isAdmin && <div><label className="block text-sm font-medium text-slate-700 mb-1">Assign RM</label><select value={editDealForm.repUsername} onChange={e => setEditDealForm({ ...editDealForm, repUsername: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"><option value="">— Select RM —</option>{rmList.map(rm => <option key={rm.id} value={rm.username}>{rm.name}</option>)}</select></div>}
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setIsEditDealModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsUserModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center"><h3 className="text-lg font-bold">{editingUser ? "Edit User" : "Create New User"}</h3><button onClick={() => setIsUserModalOpen(false)}><X size={20} className="text-slate-400" /></button></div>
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label><input type="text" required value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Username *</label><input type="text" required value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} disabled={!!editingUser} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 disabled:opacity-50" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Password *</label><div className="relative"><input type={showNewUserPw ? "text" : "password"} required={!editingUser} value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none pr-10" /><button type="button" onClick={() => setShowNewUserPw(!showNewUserPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showNewUserPw ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Role</label><select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"><option value="rm">👤 RM</option><option value="bm">🏢 Branch Manager</option><option value="admin">⭐ Administrator</option></select></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Branch</label><select value={newUser.branch} onChange={e => setNewUser({ ...newUser, branch: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none">{BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
              </div>
              {newUser.role === "bm" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Assigned Branches</label>
                  <div className="grid grid-cols-4 gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                    {BRANCHES.map(b => { const checked = (newUser.branches || [newUser.branch]).includes(b); return (
                      <label key={b} className={"flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-all " + (checked ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300")}>
                        <input type="checkbox" checked={checked} className="hidden" onChange={e => { const cur = newUser.branches || [newUser.branch]; const next = e.target.checked ? [...new Set([...cur, b])] : cur.filter(x => x !== b); setNewUser({ ...newUser, branches: next.length ? next : [newUser.branch] }); }} />{b}
                      </label>
                    ); })}
                  </div>
                </div>
              )}
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setIsUserModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">{editingUser ? "Update" : "Create User"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Priority Modal */}
      {isPriorityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsPriorityModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative z-10 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b bg-gradient-to-r from-red-50 to-orange-50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">🎯 Customer Priority</h3>
              <button onClick={() => setIsPriorityModalOpen(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            {!isAiLoading && priorityList.length > 0 && (
              <div className="flex gap-2 px-6 pt-4 pb-2">
                {["High", "Medium", "Low", "All"].map(lvl => { const count = lvl === "All" ? priorityList.length : priorityList.filter(p => p.priorityLevel === lvl).length; return (
                  <button key={lvl} onClick={() => setPriorityTabFilter(lvl)} className={"px-3 py-1.5 rounded-xl text-xs font-bold border transition-all " + ((priorityTabFilter || "High") === lvl ? (lvl === "High" ? "bg-red-500 text-white" : lvl === "Medium" ? "bg-amber-500 text-white" : lvl === "Low" ? "bg-emerald-500 text-white" : "bg-indigo-600 text-white") : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300")}>
                    {lvl} ({count})
                  </button>
                ); })}
              </div>
            )}
            <div className="p-6 overflow-y-auto">
              {isAiLoading ? <div className="flex flex-col items-center py-16"><Loader2 size={40} className="animate-spin mb-3 text-red-400" /><p className="text-sm text-slate-400 animate-pulse">Analyzing customers...</p></div> : (
                <div className="space-y-3">
                  {priorityList.filter(item => (priorityTabFilter || "High") === "All" ? true : item.priorityLevel === (priorityTabFilter || "High")).map((item, i) => (
                    <div key={i} className={"rounded-xl border p-4 " + (item.priorityLevel === "High" ? "bg-red-50 border-red-200 text-red-700" : item.priorityLevel === "Low" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700")}>
                      <div className="flex items-start justify-between">
                        <div><h4 className="font-bold text-slate-800">{item.customerName}</h4><p className="text-xs mt-1 opacity-80">{item.reason}</p></div>
                        <div className="text-right ml-4 flex-shrink-0">
                          {item.amount > 0 && <p className="font-bold text-slate-700">{formatCurrency(item.amount)}</p>}
                          <p className="text-xs text-slate-500">{item.rmName}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end"><button onClick={() => setIsPriorityModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl">Close</button></div>
          </div>
        </div>
      )}

      {/* Status Filter Modal */}
      {statusFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setStatusFilterModal(null)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl relative z-10 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">{statusFilterModal.title}</h3>
              <button onClick={() => setStatusFilterModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="overflow-y-auto">
              {(() => {
                let filtered;
                if (statusFilterModal.filteredDeals) { const src = statusFilterModal.filteredDeals; filtered = statusFilterModal.status === "all" ? src : src.filter(d => d.status === statusFilterModal.status); }
                else if (statusFilterModal.branchFilter) { filtered = deals.filter(d => d.branch === statusFilterModal.branchFilter && (statusFilterModal.status === "all" || d.status === statusFilterModal.status)); }
                else if (statusFilterModal.status === "all") filtered = visibleDeals;
                else filtered = visibleDeals.filter(d => d.status === statusFilterModal.status);
                if (!filtered.length) return <div className="py-16 text-center text-slate-400"><p>No customers here</p></div>;
                return (
                  <table className="w-full text-left">
                    <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b"><th className="p-4">#</th><th className="p-4">Customer</th><th className="p-4">Branch</th><th className="p-4">Loan Type</th><th className="p-4">Amount</th><th className="p-4">RM</th><th className="p-4">Priority</th><th className="p-4">Status</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map((d, i) => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="p-4 text-slate-400 text-sm">{i + 1}</td>
                          <td className="p-4"><p className="font-semibold text-sm">{d.client}</p>{d.businessName && <p className="text-xs text-slate-400">{d.businessName}</p>}</td>
                          <td className="p-4"><span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg">{d.branch || ""}</span></td>
                          <td className="p-4"><span className="text-xs text-slate-600">{d.loanType || ""}</span></td>
                          <td className="p-4"><span className="font-bold text-sm">{formatCurrency(d.amount)}</span></td>
                          <td className="p-4"><span className="text-sm">{d.rmName || ""}</span></td>
                          <td className="p-4"><span className={"px-2 py-1 rounded-full text-xs font-bold " + (d.customerStatus === "High" ? "bg-red-100 text-red-600" : d.customerStatus === "Low" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600")}>{d.customerStatus}</span></td>
                          <td className="p-4"><span className={"px-2.5 py-1 rounded-full text-xs font-medium border " + statusBadge(d.status)}>{d.status === "Won" ? "Completed" : d.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end"><button onClick={() => setStatusFilterModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl">Close</button></div>
          </div>
        </div>
      )}

      {/* Follow Up Modal */}
      {isFollowUpModalOpen && selectedDealForFollowUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsFollowUpModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10">
            <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex justify-between items-center rounded-t-2xl">
              <div><h3 className="text-lg font-bold text-slate-800">📋 Create Follow Up</h3><p className="text-xs text-slate-500 mt-0.5">🔒 Locked after save — cannot be edited</p></div>
              <button onClick={() => setIsFollowUpModalOpen(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-slate-400">Customer</p><p className="font-bold text-slate-800">{selectedDealForFollowUp.client}</p></div>
                  <div><p className="text-xs text-slate-400">Branch</p><p className="font-bold text-indigo-700">{selectedDealForFollowUp.branch}</p></div>
                  <div><p className="text-xs text-slate-400">Amount</p><p className="font-bold text-emerald-700">{formatCurrency(selectedDealForFollowUp.amount)}</p></div>
                  <div><p className="text-xs text-slate-400">Rate</p><p className="font-bold text-slate-700">{selectedDealForFollowUp.rate ? selectedDealForFollowUp.rate + "%" : ""}</p></div>
                </div>
              </div>
              <form onSubmit={handleSaveFollowUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Date *</label><input type="date" required value={followUpForm.startDate} onChange={e => setFollowUpForm(p => ({ ...p, startDate: e.target.value }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm" /></div>
                  <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">End Date *</label><input type="date" required value={followUpForm.endDate} min={followUpForm.startDate} onChange={e => setFollowUpForm(p => ({ ...p, endDate: e.target.value }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm" /></div>
                </div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Priority *</label><select value={followUpForm.status || "Medium"} onChange={e => setFollowUpForm(p => ({ ...p, status: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"><option value="High">🔴 High</option><option value="Medium">🟡 Medium</option><option value="Low">🟢 Low</option></select></div>
                <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Remark *</label><textarea required rows={4} value={followUpForm.remark} onChange={e => setFollowUpForm(p => ({ ...p, remark: e.target.value }))} placeholder="Write your follow-up notes here..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm resize-none" /></div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2"><Shield size={14} className="text-amber-600 flex-shrink-0" /><p className="text-xs text-amber-700">Once saved, this follow-up <strong>cannot be edited or deleted.</strong></p></div>
                <div className="flex space-x-3 pt-1">
                  <button type="button" onClick={() => setIsFollowUpModalOpen(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-xl text-sm font-semibold">🔒 Save &amp; Lock</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Follow Up Modal */}
      {isViewFollowUpModal && viewFollowUpDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsViewFollowUpModal(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl relative z-10 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-orange-50 flex justify-between items-center rounded-t-2xl">
              <h3 className="text-lg font-bold text-slate-800">📋 Follow-up Details — {viewFollowUpDeal.deal.client}</h3>
              <button onClick={() => setIsViewFollowUpModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <div className="space-y-3">
                {viewFollowUpDeal.followUps.map((f, i) => (
                  <div key={f.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">#{i + 1}</span>
                        <span className={"px-2.5 py-0.5 rounded-full text-xs font-bold border " + (f.status === "High" ? "bg-red-50 text-red-600 border-red-200" : f.status === "Low" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200")}>{f.status}</span>
                        <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg font-semibold">{new Date(f.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} → {new Date(f.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                      <span className="text-xs text-slate-400">{new Date(f.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">💬 {f.remark}</p>
                    <p className="text-xs text-slate-400 mt-1.5">👤 {f.rmName}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-between items-center">
              <button onClick={() => { setIsViewFollowUpModal(false); setSelectedDealForFollowUp(viewFollowUpDeal.deal); setFollowUpForm({ startDate: "", endDate: "", remark: "", status: "Medium" }); setIsFollowUpModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium rounded-xl"><Plus size={14} /><span>Add Follow Up</span></button>
              <button onClick={() => setIsViewFollowUpModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isImporting && setIsImportModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative z-10 flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-orange-50 flex justify-between items-center rounded-t-2xl">
              <h3 className="text-lg font-bold text-slate-800">📤 Import Customers from Excel</h3>
              <button onClick={() => setIsImportModalOpen(false)} disabled={isImporting}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between gap-4">
                <div><p className="font-semibold text-indigo-800 text-sm">Step 1: Download Template</p><p className="text-xs text-indigo-600 mt-0.5">Download the template, fill in your customers, then upload below.</p></div>
                <button onClick={handleDownloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium rounded-xl flex-shrink-0"><FileDown size={16} /><span>Download Template</span></button>
              </div>
              <div className="border-2 border-dashed border-slate-200 hover:border-amber-400 rounded-xl p-8 text-center transition-colors">
                <Upload size={36} className="mx-auto mb-3 text-slate-300" />
                <p className="font-semibold text-slate-600 mb-4">Step 2: Upload your CSV file</p>
                <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl"><Upload size={16} /><span>Choose File</span><input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} /></label>
              </div>
              {importErrors.length > 0 && <div className="bg-red-50 border border-red-200 rounded-xl p-4"><p className="font-semibold text-red-700 text-sm mb-2">❌ {importErrors.length} error(s):</p><div className="space-y-1 max-h-32 overflow-y-auto">{importErrors.map((e, i) => <p key={i} className="text-xs text-red-600">• {e}</p>)}</div></div>}
              {importPreview.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-800 mb-3">Step 3: Preview — <span className="text-emerald-600">{importPreview.length} customers ready</span></p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-72">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0"><tr className="bg-slate-100 text-slate-600 uppercase"><th className="px-3 py-2">#</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Branch</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">RM</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {importPreview.map((row, i) => (
                            <tr key={i} className="hover:bg-amber-50/30">
                              <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                              <td className="px-3 py-2 font-semibold">{row.client}</td>
                              <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded">{row.branch}</span></td>
                              <td className="px-3 py-2 font-bold">{formatCurrency(row.amount)}</td>
                              <td className="px-3 py-2"><span className={"px-1.5 py-0.5 rounded text-xs font-medium " + statusBadge(row.status)}>{row.status}</span></td>
                              <td className="px-3 py-2">{row.rmName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
              <button onClick={() => { setIsImportModalOpen(false); setImportPreview([]); setImportErrors([]); }} disabled={isImporting} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 text-sm">Cancel</button>
              {importPreview.length > 0 && <button onClick={handleImportSave} disabled={isImporting} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold rounded-xl">{isImporting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}{isImporting ? "Importing..." : "✅ Import " + importPreview.length + " Customers"}</button>}
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsEmailModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b bg-indigo-50 flex justify-between items-center"><div className="flex items-center font-bold text-indigo-900"><Mail size={20} className="mr-2 text-indigo-600" />AI Follow-up Draft</div><button onClick={() => setIsEmailModalOpen(false)}><X size={20} className="text-slate-400" /></button></div>
            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-slate-500 mb-4">To: <strong>{selectedDealForEmail?.client}</strong>  {formatCurrency(selectedDealForEmail?.amount || 0)}</p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[200px] relative">
                {isAiLoading ? <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400"><Loader2 size={32} className="animate-spin mb-2 text-indigo-500" /><p className="text-sm animate-pulse">Writing...</p></div> : <textarea value={emailDraft} onChange={e => setEmailDraft(e.target.value)} className="w-full min-h-[200px] bg-transparent resize-none outline-none text-slate-700 text-sm leading-relaxed" />}
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
              <button onClick={() => setIsEmailModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl">Close</button>
              <button onClick={() => copyToClipboard(emailDraft)} disabled={isAiLoading} className="flex items-center space-x-2 px-4 py-2 bg-red-700 hover:bg-red-800 disabled:bg-slate-400 text-white text-sm rounded-xl"><Copy size={16} /><span>Copy</span></button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {successToast && (
        <div className="fixed top-6 right-6 z-[100] flex items-center space-x-3 bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl max-w-sm">
          <CheckCircle size={20} className="flex-shrink-0" /><p className="text-sm font-medium">{successToast}</p>
        </div>
      )}

    </div>
  );
}
