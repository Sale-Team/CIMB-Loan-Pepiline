import React, { useState, useMemo } from "react";
import {
  LayoutDashboard, Users, DollarSign, Target, TrendingUp,
  Search, Bell, Menu, X, Plus, CheckCircle, Clock, Briefcase,
  Upload, Sparkles, Mail, Copy, Loader2, Star, LogOut,
  Shield, Eye, EyeOff, UserPlus, Trash2, Edit2, FileDown,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, doc, setDoc, deleteDoc, getDocs } from "firebase/firestore";

// ============================================================
// 🔐 SECURITY UTILITIES
// ============================================================

// SHA-256 password hashing using Web Crypto API
const hashPassword = async (password) => {
  const msgBuffer = new TextEncoder().encode(password + "CMB_SALT_2024_#$@!");
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
};

// Login attempt tracker (in-memory, resets on refresh)
const loginAttempts = {};
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

const checkLoginAttempts = (username) => {
  const rec = loginAttempts[username];
  if (!rec) return { allowed: true };
  if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
    const mins = Math.ceil((rec.lockedUntil - Date.now()) / 60000);
    return { allowed: false, message: `Account locked. Try again in ${mins} minute(s).` };
  }
  return { allowed: true };
};

const recordFailedAttempt = (username) => {
  if (!loginAttempts[username]) loginAttempts[username] = { count: 0 };
  loginAttempts[username].count += 1;
  if (loginAttempts[username].count >= MAX_ATTEMPTS) {
    loginAttempts[username].lockedUntil = Date.now() + LOCKOUT_MS;
    loginAttempts[username].count = 0;
  }
};

const clearLoginAttempts = (username) => { delete loginAttempts[username]; };

// Session timeout — auto logout after 60 min inactivity
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

const myFirebaseConfig = {
  apiKey: "AIzaSyCbzJneJiTUB9F1uYpKKo6slLv1TiMHSqQ",
  authDomain: "sale-performance-3765a.firebaseapp.com",
  projectId: "sale-performance-3765a",
  storageBucket: "sale-performance-3765a.firebasestorage.app",
  messagingSenderId: "51620902864",
  appId: "1:51620902864:web:8eaf76c66f36a9bee0abd5",
  measurementId: "G-MENCYDXYD0",
};
const firebaseConfig = myFirebaseConfig;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = myFirebaseConfig.projectId;

// ============================================================
// 📊 EXCEL EXPORT UTILITIES
// ============================================================
const exportToExcel = (data, filename, headers) => {
  // Build CSV content (opens in Excel)
  const csvRows = [];
  // Add header row
  csvRows.push(headers.map(h => `"${h.label}"`).join(","));
  // Add data rows
  data.forEach(row => {
    const values = headers.map(h => {
      const val = row[h.key] ?? "";
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  });
  const csvContent = "\uFEFF" + csvRows.join("\n"); // BOM for Excel UTF-8
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename + "_" + new Date().toISOString().split("T")[0] + ".csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const CUSTOMER_HEADERS = [
  { label: "No.", key: "no" },
  { label: "Customer Name", key: "client" },
  { label: "Business/Workplace", key: "businessName" },
  { label: "Phone", key: "phone" },
  { label: "Branch", key: "branch" },
  { label: "Loan Type", key: "loanType" },
  { label: "Request Amount ($)", key: "amount" },
  { label: "Approved Amount ($)", key: "approvedAmount" },
  { label: "Rate (%)", key: "rate" },
  { label: "Tenor (months)", key: "tenor" },
  { label: "Income Type", key: "incomeType" },
  { label: "Income Amount ($)", key: "incomeAmount" },
  { label: "Income Status", key: "incomeStatus" },
  { label: "Customer Priority", key: "customerStatus" },
  { label: "Loan Status", key: "status" },
  { label: "RM Name", key: "rmName" },
  { label: "Date", key: "date" },
];

const USER_HEADERS = [
  { label: "No.", key: "no" },
  { label: "Full Name", key: "name" },
  { label: "Username", key: "username" },
  { label: "Role", key: "role" },
  { label: "Branch", key: "branch" },
];

const LOAN_TYPES = ["Personal Loan", "Business Loan", "SME Loan", "Corporate Loan", "Mortgage", "Auto Loan"];
const INCOME_STATUSES = ["Verified", "Pending", "Unverified"];
const INCOME_TYPES = ["Salary", "Business", "Rental", "Other"];
const BRANCHES = ["NRD","BSL","TLK","PDT","NRM","BTK","MTT","BTB","KPC","SRP","271MM","SSM","598M","VSR","CMT"];
const DEFAULT_ADMINS = [
  { username: "admin", password: "admin123", role: "admin", name: "System Admin", branch: "NRD", createdAt: Date.now(), passwordHashed: false },
  { username: "Ck-Team", password: "123!!@@", role: "admin", name: "Ck-Team", branch: "NRD", createdAt: Date.now(), passwordHashed: false },
];

// =============================================
// LOGIN PAGE
// =============================================
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // 🔐 Check lockout
      const attemptCheck = checkLoginAttempts(username.trim());
      if (!attemptCheck.allowed) {
        setError(attemptCheck.message);
        setLoading(false);
        return;
      }

      const usersRef = collection(db, "artifacts", appId, "public", "data", "appUsers");
      const snapshot = await getDocs(usersRef);
      let users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // Seed default admins if empty
      if (users.length === 0) {
        for (const admin of DEFAULT_ADMINS) {
          const hashed = await hashPassword(admin.password);
          const ref = await addDoc(usersRef, { ...admin, password: hashed, passwordHashed: true });
          users.push({ ...admin, password: hashed, passwordHashed: true, id: ref.id });
        }
      }

      // Ensure Ck-Team always exists
      const ckExists = users.find(u => u.username === "Ck-Team");
      if (!ckExists) {
        const hashed = await hashPassword(DEFAULT_ADMINS[1].password);
        const ref = await addDoc(usersRef, { ...DEFAULT_ADMINS[1], password: hashed, passwordHashed: true });
        users.push({ ...DEFAULT_ADMINS[1], password: hashed, passwordHashed: true, id: ref.id });
      }

      // 🔐 Auto-migrate plain text passwords to hashed on first login
      const userRecord = users.find(u => u.username === username.trim());
      if (userRecord && !userRecord.passwordHashed) {
        const hashed = await hashPassword(userRecord.password);
        await updateDoc(doc(db, "artifacts", appId, "public", "data", "appUsers", userRecord.id), {
          password: hashed, passwordHashed: true
        });
        userRecord.password = hashed;
        userRecord.passwordHashed = true;
      }

      // 🔐 Compare hashed password
      const hashedInput = await hashPassword(password);
      const found = users.find(u => u.username === username.trim() && u.password === hashedInput);

      if (found) {
        clearLoginAttempts(username.trim());
        // Set session expiry
        const sessionExpiry = Date.now() + SESSION_TIMEOUT_MS;
        onLogin({ ...found, sessionExpiry });
      } else {
        recordFailedAttempt(username.trim());
        const rec = loginAttempts[username.trim()];
        const remaining = rec ? MAX_ATTEMPTS - (rec.count || 0) : MAX_ATTEMPTS;
        setError(`Invalid username or password. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : ""}`);
      }
    } catch { setError("Connection error. Please try again."); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex" style={{background:"#f5f5f5"}}>

      {/* LEFT PANEL — CIMB Red with car illustration like real website */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 relative overflow-hidden" style={{background:"linear-gradient(160deg, #8B0000 0%, #C8102E 45%, #E31837 100%)"}}>
        {/* Top nav bar like CIMB website */}
        <div className="px-10 pt-8 flex items-center gap-3 relative z-10">
          <svg width="44" height="44" viewBox="0 0 80 80" fill="none">
            <polygon points="40,2 78,40 40,78 2,40" fill="white" fillOpacity="0.95"/>
            <polygon points="40,13 67,40 40,67 13,40" fill="#C8102E"/>
            <text x="40" y="36" textAnchor="middle" fill="white" fontSize="13" fontWeight="900" fontFamily="Arial,sans-serif">CIMB</text>
            <text x="40" y="51" textAnchor="middle" fill="white" fontSize="8" fontWeight="700" fontFamily="Arial,sans-serif">BANK</text>
          </svg>
          <div>
            <p className="text-white font-bold text-lg leading-tight">CIMB Bank</p>
            <p className="text-red-200 text-xs">Cambodia</p>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col justify-center px-10 pb-8 relative z-10">
          <div className="mb-6">
            <p className="text-red-200 text-sm font-semibold uppercase tracking-widest mb-2">Loan Pipeline</p>
            <h2 className="text-white text-4xl font-bold leading-tight">Internal Banking<br/>Management Portal</h2>
            <p className="text-red-200 mt-3 text-sm leading-relaxed">Empowering your team with real-time<br/>loan tracking and performance insights.</p>
          </div>

          {/* Car SVG illustration — clean like CIMB website */}
          <div className="relative mt-4">
            <svg viewBox="0 0 500 220" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-md">
              {/* Road */}
              <rect x="0" y="170" width="500" height="50" fill="rgba(0,0,0,0.2)" rx="4"/>
              <rect x="0" y="170" width="500" height="4" fill="rgba(255,255,255,0.15)"/>
              {/* Road dashes */}
              <rect x="40" y="194" width="40" height="4" fill="rgba(255,255,255,0.3)" rx="2"/>
              <rect x="130" y="194" width="40" height="4" fill="rgba(255,255,255,0.3)" rx="2"/>
              <rect x="220" y="194" width="40" height="4" fill="rgba(255,255,255,0.3)" rx="2"/>
              <rect x="310" y="194" width="40" height="4" fill="rgba(255,255,255,0.3)" rx="2"/>
              <rect x="400" y="194" width="40" height="4" fill="rgba(255,255,255,0.3)" rx="2"/>
              {/* Car body */}
              <rect x="80" y="120" width="340" height="60" fill="white" rx="10"/>
              {/* Car roof */}
              <path d="M150 120 C160 85, 200 70, 250 68 C300 68, 330 82, 345 120 Z" fill="white"/>
              {/* Windshield */}
              <path d="M165 118 C170 92, 205 78, 248 76 C290 76, 318 90, 330 118 Z" fill="rgba(144,198,230,0.6)"/>
              {/* Side windows */}
              <rect x="160" y="95" width="60" height="24" fill="rgba(144,198,230,0.5)" rx="4"/>
              <rect x="228" y="95" width="60" height="24" fill="rgba(144,198,230,0.5)" rx="4"/>
              {/* Door lines */}
              <line x1="225" y1="120" x2="225" y2="178" stroke="rgba(200,16,46,0.3)" strokeWidth="2"/>
              <line x1="295" y1="120" x2="295" y2="178" stroke="rgba(200,16,46,0.3)" strokeWidth="2"/>
              {/* CIMB logo on car */}
              <rect x="200" y="138" width="100" height="22" fill="#C8102E" rx="4"/>
              <text x="250" y="153" textAnchor="middle" fill="white" fontSize="10" fontWeight="900" fontFamily="Arial,sans-serif">CIMB BANK</text>
              {/* Headlights */}
              <ellipse cx="98" cy="152" rx="12" ry="8" fill="rgba(255,220,100,0.9)"/>
              <ellipse cx="98" cy="152" rx="6" ry="4" fill="white"/>
              <ellipse cx="402" cy="152" rx="12" ry="8" fill="rgba(255,100,100,0.8)"/>
              {/* Wheels */}
              <circle cx="155" cy="178" r="22" fill="#222"/>
              <circle cx="155" cy="178" r="13" fill="#555"/>
              <circle cx="155" cy="178" r="5" fill="#C8102E"/>
              <circle cx="345" cy="178" r="22" fill="#222"/>
              <circle cx="345" cy="178" r="13" fill="#555"/>
              <circle cx="345" cy="178" r="5" fill="#C8102E"/>
              {/* Speed lines */}
              <line x1="30" y1="140" x2="75" y2="140" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="5,4"/>
              <line x1="20" y1="152" x2="70" y2="152" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="4,4"/>
              <line x1="30" y1="163" x2="72" y2="163" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4,4"/>
            </svg>
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="px-10 pb-8 relative z-10">
          <p className="text-red-200 text-xs">© {new Date().getFullYear()} CIMB Bank PLC. All rights reserved.</p>
        </div>

        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-10" style={{background:"radial-gradient(circle, #ffffff, transparent)", transform:"translate(30%, -30%)"}}></div>
        <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full opacity-10" style={{background:"radial-gradient(circle, #ffffff, transparent)", transform:"translate(-20%, 20%)"}}></div>
        <div className="absolute top-1/2 right-8 w-32 h-32 rounded-full opacity-5" style={{background:"radial-gradient(circle, #ffffff, transparent)"}}></div>
      </div>

      {/* RIGHT PANEL — Clean white login form */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex flex-col items-center">
          <svg width="60" height="60" viewBox="0 0 80 80" fill="none">
            <polygon points="40,2 78,40 40,78 2,40" fill="#C8102E" fillOpacity="0.95"/>
            <polygon points="40,13 67,40 40,67 13,40" fill="#8B0000"/>
            <text x="40" y="36" textAnchor="middle" fill="white" fontSize="13" fontWeight="900" fontFamily="Arial,sans-serif">CIMB</text>
            <text x="40" y="51" textAnchor="middle" fill="white" fontSize="8" fontWeight="700" fontFamily="Arial,sans-serif">BANK</text>
          </svg>
        </div>

        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-800">Sign In</h1>
            <p className="text-slate-500 text-sm mt-1">Welcome back! Please enter your credentials.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center space-x-2">
                <X size={16} /><span>{error}</span>
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Username</label>
              <input type="text" required value={username} onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none transition text-slate-800"
                onFocus={e => e.target.style.borderColor="#C8102E"} onBlur={e => e.target.style.borderColor=""}
                placeholder="Enter your username" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none pr-12 transition text-slate-800"
                  onFocus={e => e.target.style.borderColor="#C8102E"} onBlur={e => e.target.style.borderColor=""}
                  placeholder="Enter your password" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full text-white py-3.5 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all hover:opacity-90 shadow-lg disabled:opacity-60 mt-2"
              style={{background:"linear-gradient(135deg, #C8102E, #E31837)"}}>
              {loading && <Loader2 size={18} className="animate-spin" />}
              <span>{loading ? "Signing in..." : "Sign In"}</span>
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">Contact your administrator for login credentials.</p>

          {/* CIMB branding bottom */}
          <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-center gap-2">
            <svg width="20" height="20" viewBox="0 0 80 80" fill="none">
              <polygon points="40,2 78,40 40,78 2,40" fill="#C8102E"/>
              <polygon points="40,13 67,40 40,67 13,40" fill="#8B0000"/>
            </svg>
            <span className="text-xs text-slate-400 font-medium">CIMB Bank — Loan Pipeline System</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// MAIN APP
// =============================================
// ── Multi-Select Dropdown Component (must be outside App to avoid re-mount) ──
function MultiSelect({ label, options, selected, onChange, color = "indigo" }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const toggleVal = (val) => onChange(selected.includes(val) ? selected.filter(x => x !== val) : [...selected, val]);
  const colorMap = {
    indigo:  { active: "border-indigo-500 bg-indigo-50 text-indigo-700",   check: "bg-indigo-600",  tag: "bg-indigo-100 text-indigo-700"  },
    purple:  { active: "border-purple-500 bg-purple-50 text-purple-700",   check: "bg-purple-600",  tag: "bg-purple-100 text-purple-700"  },
    amber:   { active: "border-amber-500 bg-amber-50 text-amber-700",      check: "bg-amber-500",   tag: "bg-amber-100 text-amber-700"    },
    emerald: { active: "border-emerald-500 bg-emerald-50 text-emerald-700",check: "bg-emerald-600", tag: "bg-emerald-100 text-emerald-700"},
  };
  const c = colorMap[color] || colorMap.indigo;
  const displayText = selected.length === 0
    ? `All ${label}`
    : selected.map(s => options.find(o => o.value === s)?.label || s).join(", ");
  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all shadow-sm min-w-[140px] max-w-[240px] ${selected.length > 0 ? c.active : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
        <span className="flex-1 text-left truncate">{displayText}</span>
        <span className="text-slate-400 flex-shrink-0">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-2xl min-w-[200px] max-h-64 overflow-y-auto" style={{zIndex:9999}}>
          <div className="p-1.5">
            {/* All option */}
            <button type="button"
              onClick={() => { onChange([]); setOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${selected.length === 0 ? c.tag + " font-bold" : "text-slate-500 hover:bg-slate-50"}`}>
              <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${selected.length === 0 ? c.check + " border-transparent" : "border-slate-300"}`}>
                {selected.length === 0 && <span className="text-white text-xs font-bold">✓</span>}
              </span>
              All {label}
            </button>
            <div className="border-t border-slate-100 my-1"></div>
            {/* Individual options */}
            {options.map(opt => {
              const checked = selected.includes(opt.value);
              return (
                <button key={opt.value} type="button"
                  onClick={() => toggleVal(opt.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${checked ? c.tag + " font-semibold" : "text-slate-600 hover:bg-slate-50"}`}>
                  <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${checked ? c.check + " border-transparent" : "border-slate-300 bg-white"}`}>
                    {checked && <span className="text-white text-xs font-bold">✓</span>}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [appUsers, setAppUsers] = useState([]);
  const [deals, setDeals] = useState([]);
  const [isAddDealModalOpen, setIsAddDealModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPriorityModalOpen, setIsPriorityModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifPermission, setNotifPermission] = useState("default");
  const [statusFilterModal, setStatusFilterModal] = useState(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState({ username: "", password: "", name: "", role: "rm", branch: "NRD" });
  const [showNewUserPw, setShowNewUserPw] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [priorityList, setPriorityList] = useState([]);
  const [priorityTabFilter, setPriorityTabFilter] = useState("High");
  const [emailDraft, setEmailDraft] = useState("");
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedDealForEmail, setSelectedDealForEmail] = useState(null);
  const [selectedTeamRm, setSelectedTeamRm] = useState(null);
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
  const [viewingFollowUps, setViewingFollowUps] = useState([]);
  const [editingDeal, setEditingDeal] = useState(null); // deal being edited
  const [topPerfFilter, setTopPerfFilter] = useState([]);
  const [topPerfStartDate, setTopPerfStartDate] = useState("");
  const [topPerfEndDate, setTopPerfEndDate] = useState("");
  const [topPerfLoanType, setTopPerfLoanType] = useState([]);
  const [topPerfBranch, setTopPerfBranch] = useState([]);
  const [followUpSearch, setFollowUpSearch] = useState("");
  const [isEditDealModalOpen, setIsEditDealModalOpen] = useState(false);
  const [editDealForm, setEditDealForm] = useState({});
  const [followUps, setFollowUps] = useState([]);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [selectedDealForFollowUp, setSelectedDealForFollowUp] = useState(null);
  const [followUpForm, setFollowUpForm] = useState({ startDate: "", endDate: "", remark: "" });
  const [followUpFilter, setFollowUpFilter] = useState({ start: "", end: "" });

  const [newDeal, setNewDeal] = useState({
    client: "", businessName: "", phone: "", branch: loggedInUser?.branch || "NRD",
    amount: "", approvedAmount: "", repUsername: "", status: "Pending",
    loanType: "Personal Loan", rate: "", tenor: "", incomeStatus: "Pending", incomeType: "Salary", incomeAmount: "", customerStatus: "Medium",
    existingBank: "", loanOutstanding: "", existingRate: "", maturityDate: "",
  });

  const isAdmin = loggedInUser?.role === "admin";
  const isBM = loggedInUser?.role === "bm";
  const rmList = appUsers.filter(u => u.role === "rm");

  const showToast = (msg) => { setSuccessToast(msg); setTimeout(() => setSuccessToast(null), 3500); };

  // Multi-select toggle helper
  const toggleArr = (arr, val) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  // Export customers to Excel/CSV
  const handleExportCustomers = (dealsToExport) => {
    const data = dealsToExport.map((d, i) => ({ ...d, no: i + 1, status: d.status === "Won" ? "Completed Drawdown" : d.status }));
    exportToExcel(data, "Chip_Mong_Customers", CUSTOMER_HEADERS);
    showToast("✅ Customers exported to Excel!");
  };

  // Export users to Excel/CSV
  const handleExportUsers = () => {
    const data = appUsers.map((u, i) => ({ ...u, no: i + 1, role: u.role === "admin" ? "Administrator" : u.role === "bm" ? "Branch Manager" : "Relationship Manager" }));
    exportToExcel(data, "Chip_Mong_Users", USER_HEADERS);
    showToast("✅ Users exported to Excel!");
  };

  // Download Excel template
  const handleDownloadTemplate = () => {
    const headers = [["Customer Name","Business/Workplace","Phone","Branch","Loan Type","Request Amount ($)","Approved Amount ($)","Rate (%)","Tenor (months)","Income Type","Income Amount ($)","Income Status","Customer Priority","Loan Status","Existing Bank","Loan Outstanding ($)","Existing Rate (%)","Maturity Date","RM Username"]];
    const example = [["John Smith","Acme Corp","+855 12 345 678","NRD","Personal Loan","50000","45000","5.5","36","Salary","3000","Verified","Medium","Pending","ABA Bank","20000","7","2026-12-31","rm_username"]];
    const csv = "\uFEFF" + [...headers, ...example].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8;"}));
    a.download = "Customer_Import_Template.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast("✅ Template downloaded!");
  };

  // Parse Excel/CSV file
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { setImportErrors(["File is empty or has no data rows."]); return; }

      // Parse CSV properly
      const parseRow = (line) => {
        const result = [];
        let cur = ""; let inQ = false;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') { inQ = !inQ; }
          else if (line[i] === ',' && !inQ) { result.push(cur.trim()); cur = ""; }
          else { cur += line[i]; }
        }
        result.push(cur.trim());
        return result;
      };

      const headerRow = parseRow(lines[0]).map(h => h.replace(/"/g,"").toLowerCase().trim());
      const rows = lines.slice(1);
      const errors = [];
      const preview = [];

      const colMap = {
        client:         ["customer name","name","client"],
        businessName:   ["business","workplace","business/workplace"],
        phone:          ["phone","telegram","phone / telegram"],
        branch:         ["branch"],
        loanType:       ["loan type","product","product type"],
        amount:         ["request amount ($)","request amount","amount"],
        approvedAmount: ["approved amount ($)","approved amount"],
        rate:           ["rate (%)","rate"],
        tenor:          ["tenor (months)","tenor"],
        incomeType:     ["income type"],
        incomeAmount:   ["income amount ($)","income amount"],
        incomeStatus:   ["income status"],
        customerStatus: ["customer priority","priority"],
        status:         ["loan status","status"],
        existingBank:   ["existing bank"],
        loanOutstanding:["loan outstanding ($)","loan outstanding"],
        existingRate:   ["existing rate (%)","existing rate"],
        maturityDate:   ["maturity date"],
        rmUsername:     ["rm username","rm"],
      };

      // Find column indexes
      const getCol = (keys) => { for (const k of keys) { const i = headerRow.findIndex(h => h.includes(k)); if (i !== -1) return i; } return -1; };
      const idx = {};
      for (const [field, keys] of Object.entries(colMap)) idx[field] = getCol(keys);

      rows.forEach((line, rowNum) => {
        if (!line.trim()) return;
        const cols = parseRow(line).map(c => c.replace(/^"|"$/g, "").trim());
        const get = (field) => idx[field] !== -1 ? (cols[idx[field]] || "") : "";

        const client = get("client");
        const branch = get("branch");
        const amount = parseFloat(get("amount")) || 0;
        const rowErrors = [];

        if (!client) rowErrors.push(`Row ${rowNum+2}: Customer Name is required`);
        if (!branch) rowErrors.push(`Row ${rowNum+2}: Branch is required`);
        if (!amount) rowErrors.push(`Row ${rowNum+2}: Amount must be a number`);
        if (branch && !BRANCHES.includes(branch)) rowErrors.push(`Row ${rowNum+2}: Invalid branch "${branch}"`);

        if (rowErrors.length) { errors.push(...rowErrors); return; }

        // Find RM
        const rmUsername = get("rmUsername");
        const rmUser = appUsers.find(u => u.username === rmUsername);

        preview.push({
          client,
          businessName: get("businessName"),
          phone: get("phone"),
          branch,
          loanType: get("loanType") || "Personal Loan",
          amount,
          approvedAmount: parseFloat(get("approvedAmount")) || 0,
          rate: parseFloat(get("rate")) || 0,
          tenor: parseInt(get("tenor")) || 0,
          incomeType: get("incomeType") || "Salary",
          incomeAmount: parseFloat(get("incomeAmount")) || 0,
          incomeStatus: get("incomeStatus") || "Pending",
          customerStatus: get("customerStatus") || "Medium",
          status: get("status") || "Pending",
          existingBank: get("existingBank"),
          loanOutstanding: parseFloat(get("loanOutstanding")) || 0,
          existingRate: parseFloat(get("existingRate")) || 0,
          maturityDate: get("maturityDate"),
          rmUsername: rmUser?.username || loggedInUser.username,
          rmName: rmUser?.name || loggedInUser.name,
          date: new Date().toISOString().split("T")[0],
          createdAt: Date.now(),
        });
      });

      setImportErrors(errors);
      setImportPreview(preview);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  // Save imported customers to Firebase
  const handleImportSave = async () => {
    if (!importPreview.length) return;
    setIsImporting(true);
    try {
      const dealsRef = collection(db, "artifacts", appId, "public", "data", "deals");
      for (const deal of importPreview) {
        await addDoc(dealsRef, deal);
      }
      showToast(`✅ ${importPreview.length} customers imported successfully!`);
      setIsImportModalOpen(false);
      setImportPreview([]);
      setImportErrors([]);
    } catch (err) {
      console.error(err);
      showToast("❌ Import failed. Please try again.");
    }
    setIsImporting(false);
  };

  // 🔐 Session timeout — auto logout after 60 min inactivity
  React.useEffect(() => {
    if (!loggedInUser) return;
    const checkSession = setInterval(() => {
      if (loggedInUser.sessionExpiry && Date.now() > loggedInUser.sessionExpiry) {
        setLoggedInUser(null);
        setActiveTab("dashboard");
        alert("⏱️ Session expired. Please sign in again.");
      }
    }, 60000);
    const resetSession = () => setLoggedInUser(prev => prev ? { ...prev, sessionExpiry: Date.now() + SESSION_TIMEOUT_MS } : prev);
    window.addEventListener("click", resetSession);
    window.addEventListener("keypress", resetSession);
    return () => { clearInterval(checkSession); window.removeEventListener("click", resetSession); window.removeEventListener("keypress", resetSession); };
  }, [loggedInUser?.sessionExpiry]);

  // 🔔 Request browser notification permission on login
  React.useEffect(() => {
    if (!loggedInUser) return;
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission().then(p => setNotifPermission(p));
      }
    }
  }, [loggedInUser?.username]);

  // 🔔 Check follow-up alerts every minute
  React.useEffect(() => {
    if (!loggedInUser || !followUps.length) return;

    const checkAlerts = () => {
      const now = Date.now();
      const myFollowUps = loggedInUser.role === "admin" || loggedInUser.role === "bm"
        ? followUps
        : followUps.filter(f => f.rmUsername === loggedInUser.username);

      const newNotifs = [];

      myFollowUps.forEach(f => {
        if (!f.startDate) return;
        const startMs = new Date(f.startDate).setHours(8, 0, 0, 0); // 8am on start date
        const diff = startMs - now; // ms until start

        const alerts = [
          { key: `${f.id}_1d`, ms: 24*60*60*1000, label: "1 day" },
          { key: `${f.id}_4h`, ms: 4*60*60*1000,  label: "4 hours" },
          { key: `${f.id}_1h`, ms: 1*60*60*1000,   label: "1 hour" },
        ];

        alerts.forEach(({ key, ms, label }) => {
          // Within the alert window (e.g. diff between 0 and ms) and not already notified
          if (diff > 0 && diff <= ms) {
            const alreadyShown = sessionStorage.getItem(key);
            if (!alreadyShown) {
              sessionStorage.setItem(key, "1");
              const notif = {
                id: key,
                title: `⏰ Follow-up in ${label}`,
                body: `${f.client} — ${f.rmName} — Start: ${f.startDate}`,
                priority: f.status || "Medium",
                time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
              };
              newNotifs.push(notif);

              // Browser notification
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification(`⏰ Follow-up in ${label}`, {
                  body: `${f.client} — ${f.rmName}\nStart Date: ${f.startDate}`,
                  icon: "/favicon.ico",
                  tag: key,
                });
              }
            }
          }
        });
      });

      if (newNotifs.length > 0) {
        setNotifications(prev => [...newNotifs, ...prev].slice(0, 50));
      }
    };

    checkAlerts(); // run immediately
    const interval = setInterval(checkAlerts, 60000); // every minute
    return () => clearInterval(interval);
  }, [followUps, loggedInUser?.username]);

  // Firebase auth
  React.useEffect(() => {
    const init = async () => {
      await signInAnonymously(auth);
    };
    init();
    return onAuthStateChanged(auth, setFirebaseUser);
  }, []);

  // Load data
  React.useEffect(() => {
    if (!firebaseUser) return;
    setIsSyncing(true);
    const dealsRef = collection(db, "artifacts", appId, "public", "data", "deals");
    const usersRef = collection(db, "artifacts", appId, "public", "data", "appUsers");

    const unsubDeals = onSnapshot(dealsRef, snap => {
      const d = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      d.sort((a, b) => new Date(b.date) - new Date(a.date));
      setDeals(d);
      setIsSyncing(false);
    });

    const unsubUsers = onSnapshot(usersRef, async snap => {
      if (snap.empty) {
        for (const admin of DEFAULT_ADMINS) { await addDoc(usersRef, admin); }
      }
      else {
        const users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAppUsers(users);
        if (loggedInUser) {
          const refreshed = users.find(u => u.username === loggedInUser.username);
          if (refreshed) setLoggedInUser(prev => ({ ...prev, ...refreshed }));
        }
      }
    });

    const followUpsRef = collection(db, "artifacts", appId, "public", "data", "followUps");
    const unsubFollowUps = onSnapshot(followUpsRef, snap => {
      const f = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      f.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setFollowUps(f);
    });

    return () => { unsubDeals(); unsubUsers(); unsubFollowUps(); };
  }, [firebaseUser]);

  // Visible deals based on role
  const visibleDeals = useMemo(() => {
    if (!loggedInUser) return [];
    // Admin sees ALL
    if (loggedInUser.role === "admin") return deals;
    // BM sees all customers in their assigned branches
    if (loggedInUser.role === "bm") {
      const bmBranches = loggedInUser.branches || [loggedInUser.branch];
      return deals.filter(d => bmBranches.includes(d.branch));
    }
    // RM sees only their own customers
    return deals.filter(d => d.rmUsername === loggedInUser.username);
  }, [deals, loggedInUser]);

  const filteredDeals = useMemo(() => {
    if (!searchQuery.trim()) return visibleDeals;
    const q = searchQuery.toLowerCase();
    return visibleDeals.filter(d =>
      d.client?.toLowerCase().includes(q) ||
      d.businessName?.toLowerCase().includes(q) ||
      d.rmName?.toLowerCase().includes(q)
    );
  }, [visibleDeals, searchQuery]);

  const totalRevenue = useMemo(() => visibleDeals.filter(d => d.status === "Won").reduce((s, d) => s + d.amount, 0), [visibleDeals]);
  const totalPending = useMemo(() => visibleDeals.filter(d => d.status === "Pending").reduce((s, d) => s + d.amount, 0), [visibleDeals]);
  const formatCurrency = n => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  const statusBadge = s => ({
    Won: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Pending: "bg-amber-50 text-amber-700 border-amber-200",
    Rejected: "bg-red-50 text-red-700 border-red-200",
    "Pre-Approval": "bg-blue-50 text-blue-700 border-blue-200",
    Processing: "bg-purple-50 text-purple-700 border-purple-200",
    LOS: "bg-indigo-50 text-indigo-700 border-indigo-200",
    LOO: "bg-teal-50 text-teal-700 border-teal-200",
  }[s] || "bg-slate-50 text-slate-700 border-slate-200");
  const priorityColor = l => l === "High" ? "bg-red-50 text-red-700 border-red-200" : l === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200";
  const priorityDot = l => l === "High" ? "bg-red-500" : l === "Medium" ? "bg-amber-500" : "bg-emerald-500";

  // AI
  const callGeminiAPI = async (prompt) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=`;
    let retries = 3, delay = 1000;
    while (retries > 0) {
      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
        if (!res.ok) throw new Error();
        const data = await res.json();
        return data.candidates[0].content.parts[0].text;
      } catch { retries--; if (!retries) return "AI unavailable."; await new Promise(r => setTimeout(r, delay)); delay *= 2; }
    }
  };

  const handleAnalyzePipeline = async () => {
    setIsAiLoading(true); setIsPriorityModalOpen(true); setPriorityList([]); setPriorityTabFilter("High");
    // Read customerStatus directly from saved deals — no AI call needed
    const list = visibleDeals
      .filter(d => d.customerStatus)
      .map(d => ({
        customerName: d.client,
        businessName: d.businessName || "",
        amount: d.amount || 0,
        loanType: d.loanType || "",
        incomeStatus: d.incomeType || d.incomeStatus || "",
        rmName: d.rmName || "",
        priorityLevel: d.customerStatus || "Medium",
        reason: `${d.loanType || "Loan"} — Status: ${d.status} — Income: ${d.incomeType || "N/A"}`,
        status: d.status,
        branch: d.branch,
      }))
      .sort((a, b) => {
        const order = { High: 0, Medium: 1, Low: 2 };
        return (order[a.priorityLevel] ?? 1) - (order[b.priorityLevel] ?? 1);
      });
    setPriorityList(list.length ? list : [{ customerName: "No customers with priority set", reason: "Please assign Customer Status (High/Medium/Low) when creating customers.", priorityLevel: "Low" }]);
    setIsAiLoading(false);
  };

  const handleDraftEmail = async (deal) => {
    setSelectedDealForEmail(deal); setIsEmailModalOpen(true); setEmailDraft(""); setIsAiLoading(true);
    const draft = await callGeminiAPI(`Write a professional follow-up email from RM ${deal.rmName || "our team"} to "${deal.client}" about a ${deal.loanType || "loan"} worth $${deal.amount}. Under 150 words, no subject line.`);
    setEmailDraft(draft); setIsAiLoading(false);
  };

  const copyToClipboard = text => {
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); showToast("✅ Copied!"); } catch {}
    document.body.removeChild(ta);
  };

  // Add customer
  const handleAddDeal = async (e) => {
    e.preventDefault();
    if (!newDeal.client || !newDeal.amount) return;
    setIsSyncing(true);
    const assignedRm = isAdmin && newDeal.repUsername ? appUsers.find(u => u.username === newDeal.repUsername) : loggedInUser;
    const deal = {
      client: newDeal.client, businessName: newDeal.businessName, phone: newDeal.phone,
      branch: newDeal.branch, amount: parseFloat(newDeal.amount),
      rmUsername: assignedRm?.username || loggedInUser.username,
      rmName: assignedRm?.name || loggedInUser.name,
      status: newDeal.status, loanType: newDeal.loanType,
      rate: parseFloat(newDeal.rate) || 0, tenor: parseInt(newDeal.tenor) || 0,
      incomeStatus: newDeal.incomeStatus,
      incomeType: newDeal.incomeType || "Salary",
      incomeAmount: parseFloat(newDeal.incomeAmount) || 0,
      customerStatus: newDeal.customerStatus || "Medium",
      approvedAmount: parseFloat(newDeal.approvedAmount) || 0,
      existingBank: newDeal.existingBank || "",
      loanOutstanding: parseFloat(newDeal.loanOutstanding) || 0,
      existingRate: parseFloat(newDeal.existingRate) || 0,
      maturityDate: newDeal.maturityDate || "",
      date: new Date().toISOString().split("T")[0], createdAt: Date.now(),
    };
    try {
      await addDoc(collection(db, "artifacts", appId, "public", "data", "deals"), deal);
      setNewDeal({ client: "", businessName: "", phone: "", branch: loggedInUser?.branch || "NRD", amount: "", approvedAmount: "", repUsername: "", status: "Pending", loanType: "Personal Loan", rate: "", tenor: "", incomeStatus: "Pending", incomeType: "Salary", incomeAmount: "", customerStatus: "Medium", existingBank: "", loanOutstanding: "", existingRate: "", maturityDate: "" });
      setIsAddDealModalOpen(false);
      showToast(`✅ Customer "${deal.client}" created! RM: ${deal.rmName}`);
    } catch (err) { console.error(err); }
    finally { setIsSyncing(false); }
  };

  // Update customer
  const handleUpdateDeal = async (e) => {
    e.preventDefault();
    if (!editingDeal) return;
    setIsSyncing(true);
    try {
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "deals", editingDeal.id), {
        client: editDealForm.client,
        businessName: editDealForm.businessName,
        phone: editDealForm.phone,
        branch: editDealForm.branch,
        amount: parseFloat(editDealForm.amount) || 0,
        loanType: editDealForm.loanType,
        rate: parseFloat(editDealForm.rate) || 0,
        tenor: parseInt(editDealForm.tenor) || 0,
        incomeStatus: editDealForm.incomeStatus,
        status: editDealForm.status,
        customerStatus: editDealForm.customerStatus || "Medium",
        incomeType: editDealForm.incomeType || "Salary",
        incomeAmount: parseFloat(editDealForm.incomeAmount) || 0,
        approvedAmount: parseFloat(editDealForm.approvedAmount) || 0,
        ...(isAdmin && editDealForm.repUsername ? {
          rmUsername: editDealForm.repUsername,
          rmName: appUsers.find(u => u.username === editDealForm.repUsername)?.name || editingDeal.rmName,
        } : {}),
      });
      setIsEditDealModalOpen(false);
      setEditingDeal(null);
      showToast(`✅ Customer "${editDealForm.client}" updated!`);
    } catch (err) { console.error(err); }
    finally { setIsSyncing(false); }
  };

  const openEditDeal = (deal) => {
    setEditingDeal(deal);
    setEditDealForm({
      client: deal.client || "",
      businessName: deal.businessName || "",
      phone: deal.phone || "",
      branch: deal.branch || "NRD",
      amount: deal.amount || "",
      approvedAmount: deal.approvedAmount || "",
      loanType: deal.loanType || "Personal Loan",
      rate: deal.rate || "",
      tenor: deal.tenor || "",
      incomeStatus: deal.incomeStatus || "Pending",
      incomeType: deal.incomeType || "Salary",
      incomeAmount: deal.incomeAmount || "",
      customerStatus: deal.customerStatus || "Medium",
      status: deal.status || "Pending",
      repUsername: deal.rmUsername || "",
    });
    setIsEditDealModalOpen(true);
  };

  // Delete customer (admin only)
  const handleDeleteDeal = async (dealId, clientName) => {
    if (!dealId || typeof dealId !== "string") {
      showToast("❌ Cannot delete: missing record ID.");
      return;
    }
    if (!window.confirm(`Delete customer "${clientName}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "artifacts", appId, "public", "data", "deals", dealId));
      showToast(`🗑️ Customer "${clientName}" deleted.`);
    } catch (err) {
      console.error("Delete error:", err);
      showToast("❌ Delete failed. Please try again.");
    }
  };

  // User management
  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.name) return;
    const exists = appUsers.find(u => u.username === newUser.username && u.id !== editingUser?.id);
    if (exists) { showToast("❌ Username already exists!"); return; }
    const usersRef = collection(db, "artifacts", appId, "public", "data", "appUsers");
    if (editingUser) {
      const updateData = {
        name: newUser.name, role: newUser.role, branch: newUser.branch,
        branches: newUser.role === "bm" ? (newUser.branches || [newUser.branch]) : [newUser.branch],
      };
      if (newUser.password !== "••••••") {
        updateData.password = await hashPassword(newUser.password);
        updateData.passwordHashed = true;
      }
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "appUsers", editingUser.id), updateData);
      showToast(`✅ User "${newUser.name}" updated!`);
    } else {
      const hashedPw = await hashPassword(newUser.password);
      const branches = newUser.role === "bm" ? (newUser.branches || [newUser.branch]) : [newUser.branch];
      await addDoc(usersRef, { ...newUser, branches, password: hashedPw, passwordHashed: true, createdAt: Date.now() });
      showToast(`✅ User "${newUser.name}" created! Username: ${newUser.username}`);
    }
    setNewUser({ username: "", password: "", name: "", role: "rm", branch: "NRD", branches: [] });
    setEditingUser(null); setIsUserModalOpen(false);
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Delete "${userName}"?`)) return;
    await deleteDoc(doc(db, "artifacts", appId, "public", "data", "appUsers", userId));
    showToast(`🗑️ "${userName}" deleted.`);
  };

  const handleEditUser = (u) => {
    setEditingUser(u);
    setNewUser({ username: u.username, password: "••••••", name: u.name, role: u.role, branch: u.branch || "NRD", branches: u.branches || [u.branch || "NRD"] });
    setIsUserModalOpen(true);
  };

  const handleLogout = () => { setLoggedInUser(null); setActiveTab("dashboard"); };

  const handleSaveFollowUp = async (e) => {
    e.preventDefault();
    if (!selectedDealForFollowUp || !followUpForm.startDate || !followUpForm.endDate || !followUpForm.remark.trim()) return;
    try {
      await addDoc(collection(db, "artifacts", appId, "public", "data", "followUps"), {
        dealId: selectedDealForFollowUp.id,
        client: selectedDealForFollowUp.client,
        branch: selectedDealForFollowUp.branch,
        amount: selectedDealForFollowUp.amount,
        rate: selectedDealForFollowUp.rate,
        date: selectedDealForFollowUp.date,
        rmUsername: loggedInUser.username,
        rmName: loggedInUser.name,
        startDate: followUpForm.startDate,
        endDate: followUpForm.endDate,
        remark: followUpForm.remark.trim(),
        status: followUpForm.status || "Medium",
        createdAt: Date.now(),
        locked: true,
      });
      setIsFollowUpModalOpen(false);
      setFollowUpForm({ startDate: "", endDate: "", remark: "", status: "Medium" });
      setSelectedDealForFollowUp(null);
      showToast(`✅ Follow-up saved for "${selectedDealForFollowUp.client}"!`);
    } catch (err) { console.error(err); showToast("❌ Failed to save. Try again."); }
  };

  // Upload RM photo — convert to base64 and save to Firestore
  const handlePhotoUpload = async (userId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "appUsers", userId), { photoUrl: base64 });
      showToast("✅ Photo updated successfully!");
    };
    reader.readAsDataURL(file);
  };

  // Show login
  if (!loggedInUser) return <LoginPage onLogin={u => { setLoggedInUser(u); setNewDeal(p => ({ ...p, branch: u.branch || "NRD" })); }} />;

  const SidebarNav = () => (
    <nav className="flex-1 px-4 py-6 space-y-1">
      {[
        { id: "dashboard", icon: <LayoutDashboard size={19} />, label: "Dashboard" },
        { id: "team", icon: <Users size={19} />, label: "Sale Performance" },
        { id: "deals", icon: <Briefcase size={19} />, label: "List Customer Follow Up" },
        ...(isAdmin ? [{ id: "users", icon: <Shield size={19} />, label: "User Created", badge: "Admin" }] : []),
      ].map(item => (
        <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id
            ? "bg-gradient-to-r from-red-600/40 to-red-500/20 text-white border border-red-500/40 shadow-sm"
            : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
          {item.icon}<span className="font-medium flex-1 text-left">{item.label}</span>
          {item.badge && <span className="text-xs bg-red-500/30 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">{item.badge}</span>}
        </button>
      ))}
      <div className="pt-4 border-t border-white/10 mt-4">
        <div className="px-4 py-3 bg-white/5 rounded-xl mb-2 border border-white/10">
          <p className="text-sm font-bold text-white">{loggedInUser.name}</p>
          <p className="text-xs text-slate-400">{isAdmin ? "🔑 Administrator" : isBM ? "🏦 Branch Manager" : "👤 RM"} • {loggedInUser.branch}</p>
        </div>
        <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-red-900/30 border border-red-700/30 flex items-center gap-2">
          <Shield size={13} className="text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-300 font-medium">Secured & Encrypted</span>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
          <LogOut size={19} /><span className="font-medium">Logout</span>
        </button>
      </div>
    </nav>
  );

  const kpiCards = [
    { title: "Pending Pipeline",        status: "Pending",     value: formatCurrency(totalPending), sub: `${visibleDeals.filter(d => d.status === "Pending").length} active`, color: "amber", icon: <Target size={22} /> },
    { title: "Pre-Approval",            status: "Pre-Approval",value: `${visibleDeals.filter(d => d.status === "Pre-Approval").length}`, sub: formatCurrency(visibleDeals.filter(d => d.status === "Pre-Approval").reduce((s, d) => s + d.amount, 0)), color: "blue", icon: <CheckCircle size={22} /> },
    { title: "Processing",              status: "Processing",  value: `${visibleDeals.filter(d => d.status === "Processing").length}`, sub: formatCurrency(visibleDeals.filter(d => d.status === "Processing").reduce((s, d) => s + d.amount, 0)), color: "purple", icon: <Loader2 size={22} /> },
    { title: "LOS",                     status: "LOS",         value: `${visibleDeals.filter(d => d.status === "LOS").length}`, sub: formatCurrency(visibleDeals.filter(d => d.status === "LOS").reduce((s, d) => s + d.amount, 0)), color: "indigo", icon: <Briefcase size={22} /> },
    { title: "LOO",                     status: "LOO",         value: `${visibleDeals.filter(d => d.status === "LOO").length}`, sub: formatCurrency(visibleDeals.filter(d => d.status === "LOO").reduce((s, d) => s + d.amount, 0)), color: "teal", icon: <Star size={22} /> },
    { title: "Loan Completed Drawdown", status: "Won",         value: formatCurrency(totalRevenue), sub: `${visibleDeals.filter(d => d.status === "Won").length} completed`, color: "emerald", icon: <DollarSign size={22} /> },
    { title: "Loan Rejected",           status: "Rejected",    value: `${visibleDeals.filter(d => d.status === "Rejected").length}`, sub: formatCurrency(visibleDeals.filter(d => d.status === "Rejected").reduce((s, d) => s + d.amount, 0)), color: "red", icon: <X size={22} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
      {/* SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 shadow-2xl" style={{background:"linear-gradient(180deg, #1A0000 0%, #2D0010 50%, #1A0000 100%)"}}>
        <div className="p-6 border-b border-white/10 flex items-center space-x-3">
          <svg width="36" height="36" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="40,4 76,40 40,76 4,40" fill="white" fillOpacity="0.9"/>
            <polygon points="40,14 66,40 40,66 14,40" fill="#C8102E"/>
            <text x="40" y="35" textAnchor="middle" fill="white" fontSize="13" fontWeight="900" fontFamily="Arial,sans-serif">CIMB</text>
            <text x="40" y="50" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="600" fontFamily="Arial,sans-serif">BANK</text>
          </svg>
          <div>
            <span className="text-base font-bold text-white leading-tight block">CIMB Bank</span>
            <span className="text-xs text-red-300">Loan Pipeline</span>
          </div>
        </div>
        <SidebarNav />
      </aside>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setIsMobileMenuOpen(false)}></div>
          <aside className="absolute top-0 left-0 w-64 bg-white h-full flex flex-col shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center">
              <span className="text-xl font-bold text-indigo-600">Loan Drawdown</span>
              <button onClick={() => setIsMobileMenuOpen(false)}><X size={24} /></button>
            </div>
            <SidebarNav />
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top notification bar */}
        <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">👋 {loggedInUser.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isAdmin ? "bg-purple-100 text-purple-700" : isBM ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"}`}>
              {isAdmin ? "🔑 Admin" : isBM ? "🏦 BM" : "👤 RM"} • {loggedInUser.branch}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Browser permission request */}
            {notifPermission === "default" && (
              <button onClick={() => Notification.requestPermission().then(p => setNotifPermission(p))}
                className="text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-medium transition-colors">
                🔔 Enable alerts
              </button>
            )}
            {/* Bell icon */}
            <button onClick={() => setShowNotifPanel(p => !p)}
              className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <Bell size={20} className={notifications.length > 0 ? "text-indigo-600" : "text-slate-400"} />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Notification Panel */}
        {showNotifPanel && (
          <div className="fixed top-14 right-4 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 max-h-[70vh] flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">🔔 Follow-up Alerts</h3>
                <p className="text-xs text-slate-400 mt-0.5">{notifications.length} notification{notifications.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button onClick={() => setNotifications([])} className="text-xs text-slate-400 hover:text-red-500 font-medium">Clear all</button>
                )}
                <button onClick={() => setShowNotifPanel(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X size={16} className="text-slate-400" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Bell size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No alerts</p>
                  <p className="text-xs mt-1">Follow-up alerts will appear here</p>
                </div>
              ) : (
                notifications.map((n, i) => (
                  <div key={n.id || i} className="px-5 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${n.priority === "High" ? "bg-red-100" : n.priority === "Low" ? "bg-emerald-100" : "bg-amber-100"}`}>
                        <Bell size={16} className={n.priority === "High" ? "text-red-600" : n.priority === "Low" ? "text-emerald-600" : "text-amber-600"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm">{n.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                        <p className="text-xs text-slate-400 mt-1">{n.time}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${n.priority === "High" ? "bg-red-100 text-red-600" : n.priority === "Low" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                        {n.priority === "High" ? "🔴" : n.priority === "Low" ? "🟢" : "🟡"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="px-5 py-3 border-t bg-slate-50 rounded-b-2xl">
              <p className="text-xs text-slate-400 text-center">
                {notifPermission === "granted" ? "✅ Browser alerts enabled" : notifPermission === "denied" ? "❌ Browser alerts blocked" : "⚠️ Browser alerts not enabled"}
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 p-6 overflow-y-auto">

          {/* DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 max-w-7xl mx-auto">

              {/* Banking Hero Banner */}
              <div className="relative overflow-hidden rounded-3xl p-7 shadow-2xl" style={{background:"linear-gradient(135deg, #8B0000 0%, #C8102E 50%, #E31837 100%)"}}>
                <div className="absolute -top-10 -right-10 w-48 h-48 bg-red-400/10 rounded-full blur-2xl animate-pulse"></div>
                <div className="absolute -bottom-10 -left-5 w-40 h-40 bg-red-300/10 rounded-full blur-2xl animate-pulse" style={{animationDelay:"1s"}}></div>
                <div className="absolute top-5 right-40 w-24 h-24 bg-red-200/10 rounded-full blur-xl animate-pulse" style={{animationDelay:"0.5s"}}></div>
                <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-400/30 flex items-center justify-center">
                        <Sparkles size={16} className="text-emerald-300" />
                      </div>
                      <span className="text-red-200 text-xs font-semibold tracking-widest uppercase">AI Analysis</span>
                    </div>
                    <h3 className="text-xl font-bold text-white">Customer Priority Analysis</h3>
                    <p className="text-emerald-100/70 mt-1 text-sm">Instantly see which pending customers to follow up with first.</p>
                  </div>
                  <button onClick={handleAnalyzePipeline} disabled={isAiLoading}
                    className="whitespace-nowrap flex items-center space-x-2 bg-white hover:bg-red-50 disabled:opacity-50 text-red-700 px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-all hover:scale-105">
                    {isAiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    <span>View Customer Priority ✨</span>
                  </button>
                </div>
              </div>

              {/* ── DASHBOARD FILTER PANEL ── */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <MultiSelect label="Status" color="indigo"
                    options={[{value:"Pending",label:"⏳ Pipeline"},{value:"Pre-Approval",label:"✅ Pre-Approval"},{value:"Processing",label:"🔄 Processing"},{value:"LOS",label:"📁 LOS"},{value:"LOO",label:"⭐ LOO"},{value:"Won",label:"🏦 Completed"},{value:"Rejected",label:"❌ Rejected"}]}
                    selected={topPerfFilter} onChange={setTopPerfFilter} />
                  <MultiSelect label="Branch" color="emerald"
                    options={BRANCHES.map(b => ({value:b, label:b}))}
                    selected={topPerfBranch} onChange={setTopPerfBranch} />
                  <MultiSelect label="Product" color="purple"
                    options={LOAN_TYPES.map(t => ({value:t, label:t}))}
                    selected={topPerfLoanType} onChange={setTopPerfLoanType} />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 font-medium">From</span>
                    <input type="date" value={topPerfStartDate} onChange={e => setTopPerfStartDate(e.target.value)}
                      className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:border-indigo-400 text-slate-700 shadow-sm" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 font-medium">To</span>
                    <input type="date" value={topPerfEndDate} onChange={e => setTopPerfEndDate(e.target.value)}
                      className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:border-indigo-400 text-slate-700 shadow-sm" />
                  </div>
                  {(topPerfFilter.length > 0 || topPerfBranch.length > 0 || topPerfLoanType.length > 0 || topPerfStartDate || topPerfEndDate) && (
                    <button onClick={() => { setTopPerfFilter([]); setTopPerfBranch([]); setTopPerfLoanType([]); setTopPerfStartDate(""); setTopPerfEndDate(""); }}
                      className="text-xs text-red-400 hover:text-red-600 font-semibold px-3 py-2 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">✕ Reset</button>
                  )}
                </div>
              </div>

              {/* KPI Cards - Banking Style */}
              {(() => {
                let dashDeals = visibleDeals;
                if (topPerfLoanType.length > 0) dashDeals = dashDeals.filter(d => topPerfLoanType.includes(d.loanType));
                if (topPerfBranch.length > 0) dashDeals = dashDeals.filter(d => topPerfBranch.includes(d.branch));
                if (topPerfStartDate) dashDeals = dashDeals.filter(d => d.date >= topPerfStartDate);
                if (topPerfEndDate) dashDeals = dashDeals.filter(d => d.date <= topPerfEndDate);
                const amt = (st) => dashDeals.filter(d=>d.status===st).reduce((s,d)=>s+d.amount,0);
                return (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
                {[
                  { title: "Pipeline", status: "Pending", value: dashDeals.filter(d=>d.status==="Pending").length, sub: formatCurrency(amt("Pending")), gradient: "from-amber-500 to-orange-500", bg: "from-amber-50 to-orange-50", border: "border-amber-200", text: "text-amber-700", icon: <Target size={20}/> },
                  { title: "Pre-Approval", status: "Pre-Approval", value: dashDeals.filter(d=>d.status==="Pre-Approval").length, sub: formatCurrency(amt("Pre-Approval")), gradient: "from-blue-500 to-cyan-500", bg: "from-blue-50 to-cyan-50", border: "border-blue-200", text: "text-blue-700", icon: <CheckCircle size={20}/> },
                  { title: "Processing", status: "Processing", value: dashDeals.filter(d=>d.status==="Processing").length, sub: formatCurrency(amt("Processing")), gradient: "from-violet-500 to-purple-500", bg: "from-violet-50 to-purple-50", border: "border-violet-200", text: "text-violet-700", icon: <Loader2 size={20}/> },
                  { title: "LOS", status: "LOS", value: dashDeals.filter(d=>d.status==="LOS").length, sub: formatCurrency(amt("LOS")), gradient: "from-indigo-500 to-blue-600", bg: "from-indigo-50 to-blue-50", border: "border-indigo-200", text: "text-indigo-700", icon: <Briefcase size={20}/> },
                  { title: "LOO", status: "LOO", value: dashDeals.filter(d=>d.status==="LOO").length, sub: formatCurrency(amt("LOO")), gradient: "from-teal-500 to-emerald-500", bg: "from-teal-50 to-emerald-50", border: "border-teal-200", text: "text-teal-700", icon: <Star size={20}/> },
                  { title: "🏦 Completed", status: "Won", value: dashDeals.filter(d=>d.status==="Won").length, sub: formatCurrency(amt("Won")), gradient: "from-emerald-500 to-green-500", bg: "from-emerald-50 to-green-50", border: "border-emerald-200", text: "text-emerald-700", icon: <DollarSign size={20}/> },
                  { title: "Rejected", status: "Rejected", value: dashDeals.filter(d=>d.status==="Rejected").length, sub: formatCurrency(amt("Rejected")), gradient: "from-red-500 to-rose-500", bg: "from-red-50 to-rose-50", border: "border-red-200", text: "text-red-700", icon: <X size={20}/> },
                  { title: "📊 Total", status: "all", value: dashDeals.length, sub: formatCurrency(dashDeals.reduce((s,d)=>s+d.amount,0)), gradient: "from-slate-500 to-slate-700", bg: "from-slate-50 to-slate-100", border: "border-slate-300", text: "text-slate-700", icon: <Briefcase size={20}/> },
                ].map((card, i) => (
                  <button key={card.status}
                    onClick={() => setStatusFilterModal({ title: card.title, status: card.status, filteredDeals: dashDeals })}
                    className={`relative overflow-hidden bg-gradient-to-br ${card.bg} border ${card.border} rounded-2xl p-6 hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col items-center justify-center w-full`}
                    style={{animationDelay: `${i*80}ms`, minHeight: "200px"}}>
                    {/* Gradient accent bar top */}
                    <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${card.gradient} rounded-t-2xl`}></div>
                    {/* Icon — centered */}
                    <div className={`flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${card.gradient} shadow-lg mb-4 group-hover:scale-110 transition-transform`}>
                      <span className="text-white">{React.cloneElement(card.icon, {size: 28})}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-500 mb-1.5 text-center uppercase tracking-wide">{card.title}</p>
                    <p className={`text-4xl font-extrabold ${card.text} text-center`}>{card.value}</p>
                    <p className="text-sm text-slate-400 mt-1.5 text-center w-full font-medium">{card.sub}</p>
                    {/* Hover shine */}
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-all rounded-2xl"></div>
                  </button>
                ))}
              </div>
                ); // close return
              })()} {/* close IIFE */}

              <div className="grid grid-cols-1 gap-6">
                {/* ── Top Performance ── full width */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="p-5 border-b bg-gradient-to-r from-slate-50 to-indigo-50/30">
                    <div className="flex flex-wrap gap-3 justify-between items-center">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center">
                        <span className="w-1 h-5 bg-gradient-to-b from-indigo-500 to-blue-500 rounded-full mr-3 inline-block"></span>
                        🏆 Top Performance by Branch
                      </h3>
                      <button onClick={() => {
                        let d = visibleDeals;
                        if (topPerfFilter.length > 0) d = d.filter(x => topPerfFilter.includes(x.status));
                        if (topPerfLoanType.length > 0) d = d.filter(x => topPerfLoanType.includes(x.loanType));
                        if (topPerfBranch.length > 0) d = d.filter(x => topPerfBranch.includes(x.branch));
                        if (topPerfStartDate) d = d.filter(x => x.date >= topPerfStartDate);
                        if (topPerfEndDate) d = d.filter(x => x.date <= topPerfEndDate);
                        handleExportCustomers(d);
                      }}
                        className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-all hover:shadow-md">
                        <FileDown size={16} /><span>📊 Export Excel</span>
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const branchesToShow = isAdmin ? BRANCHES : isBM ? (loggedInUser.branches || [loggedInUser.branch]) : [loggedInUser.branch];
                    const perfList = branchesToShow
                      .filter(br => topPerfBranch.length === 0 || topPerfBranch.includes(br))
                      .map(br => {
                        let brDeals = topPerfFilter.length === 0
                          ? deals.filter(d => d.branch === br)
                          : deals.filter(d => d.branch === br && topPerfFilter.includes(d.status));
                        if (topPerfLoanType.length > 0) brDeals = brDeals.filter(d => topPerfLoanType.includes(d.loanType));
                        if (topPerfStartDate) brDeals = brDeals.filter(d => d.date >= topPerfStartDate);
                        if (topPerfEndDate) brDeals = brDeals.filter(d => d.date <= topPerfEndDate);
                        const total = brDeals.reduce((s, d) => s + d.amount, 0);
                        return { branch: br, filteredCount: brDeals.length, filteredTotal: total };
                      })
                      .sort((a, b) => b.filteredTotal - a.filteredTotal || b.filteredCount - a.filteredCount);
                    const maxVal = perfList[0]?.filteredTotal || 1;
                    const filterLabel = topPerfFilter.length === 0 ? "All Status" : topPerfFilter.map(s => s === "Won" ? "Completed" : s).join(", ");
                    return perfList.map((br, i) => (
                      <div key={br.branch}
                        onClick={() => setStatusFilterModal({ title: `Branch ${br.branch} — ${filterLabel}`, status: topPerfFilter.length === 0 ? "all" : topPerfFilter[0], branchFilter: br.branch })}
                        className="flex items-center px-5 py-4 border-b border-slate-50 last:border-0 hover:bg-indigo-50/40 transition-colors cursor-pointer">
                        <span className={`font-extrabold w-7 text-base flex-shrink-0 ${i === 0 ? "text-amber-400" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-400" : "text-slate-300"}`}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}`}
                        </span>
                        <div className="w-10 h-10 rounded-full overflow-hidden ml-1 flex-shrink-0 bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                          <span className="text-white font-bold text-xs">{br.branch.substring(0,3)}</span>
                        </div>
                        <div className="ml-3 flex-1 min-w-0">
                          <p className="font-bold text-slate-800">🏦 {br.branch}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${i === 0 ? "bg-amber-400" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-400" : "bg-indigo-300"}`}
                                style={{ width: `${maxVal > 0 ? Math.round((br.filteredTotal/maxVal)*100) : 0}%`, transition:"width 0.8s ease" }}></div>
                            </div>
                            <span className="text-xs text-slate-400 flex-shrink-0">{br.filteredCount} deals</span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-bold text-emerald-600 text-sm">{formatCurrency(br.filteredTotal)}</p>
                          <p className="text-xs text-indigo-400 mt-0.5">click to view →</p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* TEAM — Customer List only */}
          {activeTab === "team" && (
            <div className="max-w-7xl mx-auto">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Header bar */}
                <div className="p-5 border-b bg-gradient-to-r from-slate-50 to-indigo-50/30">
                  <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-slate-800 flex items-center">
                        <span className="w-1 h-5 bg-gradient-to-b from-indigo-500 to-blue-500 rounded-full mr-3 inline-block"></span>
                        {isAdmin ? "All Customers" : "My Customers"}
                      </h2>
                      <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-1 rounded-full">
                        {(() => {
                          let d = visibleDeals;
                          if (teamRm.length > 0) d = d.filter(x => teamRm.includes(x.rmUsername));
                          if (teamLoanType.length > 0) d = d.filter(x => teamLoanType.includes(x.loanType));
                          if (teamLoanStatus.length > 0) d = d.filter(x => teamLoanStatus.includes(x.status));
                          if (teamCustStatus.length > 0) d = d.filter(x => teamCustStatus.includes(x.customerStatus));
                          if (teamStartDate) d = d.filter(x => x.date >= teamStartDate);
                          if (teamEndDate) d = d.filter(x => x.date <= teamEndDate);
                          return d.length;
                        })()} records
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isBM && (
                        <button onClick={() => setIsAddDealModalOpen(true)}
                          className="flex items-center space-x-2 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-all hover:shadow-md">
                          <Plus size={16} /><span>New Customer</span>
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => { setImportPreview([]); setImportErrors([]); setIsImportModalOpen(true); }}
                          className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-all hover:shadow-md">
                          <Upload size={16} /><span>📥 Import Excel</span>
                        </button>
                      )}
                      <button onClick={() => {
                        let d = visibleDeals;
                        if (teamRm.length > 0) d = d.filter(x => teamRm.includes(x.rmUsername));
                        if (teamLoanType.length > 0) d = d.filter(x => teamLoanType.includes(x.loanType));
                        if (teamLoanStatus.length > 0) d = d.filter(x => teamLoanStatus.includes(x.status));
                        if (teamCustStatus.length > 0) d = d.filter(x => teamCustStatus.includes(x.customerStatus));
                        if (teamStartDate) d = d.filter(x => x.date >= teamStartDate);
                        if (teamEndDate) d = d.filter(x => x.date <= teamEndDate);
                        handleExportCustomers(d);
                      }}
                        className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-all hover:shadow-md">
                        <FileDown size={16} /><span>📊 Export Excel</span>
                      </button>

                    </div>
                  </div>
                  {/* Multi-select filter dropdowns */}
                  <div className="flex flex-wrap gap-2 items-center p-4 border-b border-slate-100 bg-slate-50/50">
                    {/* RM filter — Admin sees all, BM sees own branch RMs */}
                    {(isAdmin || isBM) && (
                      <MultiSelect label="RM" color="indigo"
                        options={(() => {
                          const visible = isAdmin
                            ? rmList
                            : rmList.filter(rm => (loggedInUser.branches || [loggedInUser.branch]).includes(rm.branch));
                          return visible.map(rm => ({ value: rm.username, label: rm.name }));
                        })()}
                        selected={teamRm} onChange={setTeamRm} />
                    )}
                    <MultiSelect label="Status" color="indigo"
                      options={[{value:"Pending",label:"⏳ Pipeline"},{value:"Pre-Approval",label:"✅ Pre-Approval"},{value:"Processing",label:"🔄 Processing"},{value:"LOS",label:"📁 LOS"},{value:"LOO",label:"⭐ LOO"},{value:"Won",label:"🏦 Completed"},{value:"Rejected",label:"❌ Rejected"}]}
                      selected={teamLoanStatus} onChange={setTeamLoanStatus} />
                    <MultiSelect label="Product" color="purple"
                      options={LOAN_TYPES.map(t => ({value:t, label:t}))}
                      selected={teamLoanType} onChange={setTeamLoanType} />
                    <MultiSelect label="Priority" color="amber"
                      options={[{value:"High",label:"🔴 High"},{value:"Medium",label:"🟡 Medium"},{value:"Low",label:"🟢 Low"}]}
                      selected={teamCustStatus} onChange={setTeamCustStatus} />
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400 font-medium">From</span>
                      <input type="date" value={teamStartDate} onChange={e => setTeamStartDate(e.target.value)}
                        className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:border-indigo-400 text-slate-700 shadow-sm" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400 font-medium">To</span>
                      <input type="date" value={teamEndDate} onChange={e => setTeamEndDate(e.target.value)}
                        className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:border-indigo-400 text-slate-700 shadow-sm" />
                    </div>
                    {(teamRm.length > 0 || teamLoanStatus.length > 0 || teamLoanType.length > 0 || teamCustStatus.length > 0 || teamStartDate || teamEndDate) && (
                      <button onClick={() => { setTeamRm([]); setTeamLoanStatus([]); setTeamLoanType([]); setTeamCustStatus([]); setTeamStartDate(""); setTeamEndDate(""); }}
                        className="text-xs text-red-400 hover:text-red-600 font-semibold px-3 py-2 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">✕ Reset</button>
                    )}
                  </div>
                </div>

                {/* Customer table */}
                <div className="overflow-x-auto">
                  {(() => {
                    let teamDeals = visibleDeals;
                    if (teamRm.length > 0) teamDeals = teamDeals.filter(d => teamRm.includes(d.rmUsername));
                    if (teamLoanType.length > 0) teamDeals = teamDeals.filter(d => teamLoanType.includes(d.loanType));
                    if (teamLoanStatus.length > 0) teamDeals = teamDeals.filter(d => teamLoanStatus.includes(d.status));
                    if (teamCustStatus.length > 0) teamDeals = teamDeals.filter(d => teamCustStatus.includes(d.customerStatus));
                    if (teamStartDate) teamDeals = teamDeals.filter(d => d.date >= teamStartDate);
                    if (teamEndDate) teamDeals = teamDeals.filter(d => d.date <= teamEndDate);
                    if (!teamDeals.length) return (
                      <div className="py-20 text-center text-slate-400">
                        <Briefcase size={44} className="mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No customers yet</p>
                        <p className="text-xs mt-1">Create a new customer to get started</p>
                      </div>
                    );
                    return (
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                            <th className="p-4">#</th>
                            <th className="p-4">Customer</th><th className="p-4">Branch</th><th className="p-4">Phone</th>
                            <th className="p-4">Loan Type</th><th className="p-4">Amount</th><th className="p-4">Income</th>
                            <th className="p-4">Priority</th><th className="p-4">RM</th><th className="p-4">Date</th><th className="p-4">Status</th><th className="p-4">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {teamDeals.map((deal, idx) => (
                            <tr key={deal.id} className="hover:bg-indigo-50/30 transition-colors">
                              <td className="p-4 text-slate-400 text-sm font-medium">{idx + 1}</td>
                              <td className="p-4"><p className="font-semibold text-slate-800">{deal.client}</p>{deal.businessName && <p className="text-xs text-slate-400">{deal.businessName}</p>}</td>
                              <td className="p-4"><span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg">{deal.branch || "—"}</span></td>
                              <td className="p-4"><span className="text-sm text-slate-600">{deal.phone || "—"}</span></td>
                              <td className="p-4"><span className="text-sm text-slate-600">{deal.loanType || "—"}</span></td>
                              <td className="p-4"><span className="font-bold text-slate-700">{formatCurrency(deal.amount)}</span></td>
                              <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${deal.incomeType === "Salary" ? "bg-blue-50 text-blue-700" : deal.incomeType === "Business" ? "bg-purple-50 text-purple-700" : deal.incomeType === "Rental" ? "bg-teal-50 text-teal-700" : "bg-slate-50 text-slate-600"}`}>{deal.incomeType || "—"}</span></td>
                              <td className="p-4"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${deal.customerStatus === "High" ? "bg-red-100 text-red-600" : deal.customerStatus === "Low" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>{deal.customerStatus === "High" ? "🔴 High" : deal.customerStatus === "Low" ? "🟢 Low" : "🟡 Medium"}</span></td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  {(() => { const rm = appUsers.find(u => u.username === deal.rmUsername); return rm?.photoUrl
                                    ? <img src={rm.photoUrl} alt={rm.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                                    : <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0">{deal.rmName?.charAt(0)}</div>; })()}
                                  <span className="text-sm font-medium text-slate-700">{deal.rmName || "—"}</span>
                                </div>
                              </td>
                              <td className="p-4"><span className="text-xs text-slate-500">{new Date(deal.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></td>
                              <td className="p-4"><span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(deal.status)}`}>{deal.status === "Won" ? "Completed" : deal.status}</span></td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  {!isBM && (
                                    <button onClick={() => openEditDeal(deal)}
                                      className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-medium transition-colors">
                                      <Edit2 size={12} /><span>Edit</span>
                                    </button>
                                  )}
                                  <button onClick={() => { setViewingCustomer(deal); setIsViewCustomerModal(true); }}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-medium transition-colors">
                                    <Eye size={12} /><span>View</span>
                                  </button>
                                  {isAdmin && (
                                    <button onClick={() => handleDeleteDeal(deal.id, deal.client)}
                                      className="flex items-center space-x-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-xs font-medium transition-colors">
                                      <Trash2 size={12} /><span>Del</span>
                                    </button>
                                  )}
                                  {isBM && <span className="text-xs text-slate-400 italic">View only</span>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* CREATE FOLLOW UP TAB */}
          {activeTab === "deals" && (
            <div className="max-w-7xl mx-auto space-y-6">

              {/* Customer List */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b bg-gradient-to-r from-slate-50 to-indigo-50/30">
                  <div className="flex flex-wrap gap-3 items-center justify-between mb-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800 flex items-center">
                        <span className="w-1 h-5 bg-gradient-to-b from-indigo-500 to-blue-500 rounded-full mr-3 inline-block"></span>
                        📋 List Customer Follow Up
                      </h2>
                      <p className="text-xs text-slate-400 mt-1 ml-4">Click ➕ Follow Up on any customer to add a note</p>
                    </div>
                  </div>
                  {/* Search bar */}
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={followUpSearch} onChange={e => setFollowUpSearch(e.target.value)}
                      placeholder="Search by customer name or RM name..."
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 text-sm text-slate-700" />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                        <th className="p-4">No.</th>
                        <th className="p-4">Customer</th>
                        <th className="p-4">Branch</th>
                        <th className="p-4">Product</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">Rate</th>
                        <th className="p-4">Date Created</th>
                        <th className="p-4">Follow-ups</th>
                        <th className="p-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredDeals
                        .filter(d => {
                          if (!followUpSearch.trim()) return true;
                          const q = followUpSearch.toLowerCase();
                          return d.client?.toLowerCase().includes(q) || d.rmName?.toLowerCase().includes(q);
                        })
                        .map((deal, idx) => {
                          const dealFollowUps = followUps.filter(f => f.dealId === deal.id);
                          return (
                            <tr key={deal.id} className="hover:bg-indigo-50/30 transition-colors">
                              <td className="p-4 text-slate-400 text-sm font-medium">{idx + 1}</td>
                              <td className="p-4">
                                <p className="font-semibold text-slate-800">{deal.client}</p>
                                {deal.businessName && <p className="text-xs text-slate-400">{deal.businessName}</p>}
                                <p className="text-xs text-slate-400">👤 {deal.rmName}</p>
                              </td>
                              <td className="p-4"><span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg">{deal.branch || "—"}</span></td>
                              <td className="p-4"><span className="text-xs text-slate-600">{deal.loanType || "—"}</span></td>
                              <td className="p-4"><span className="font-bold text-slate-700">{formatCurrency(deal.amount)}</span></td>
                              <td className="p-4"><span className="text-sm text-slate-600">{deal.rate ? `${deal.rate}%` : "—"}</span></td>
                              <td className="p-4"><span className="text-xs text-slate-500">{new Date(deal.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></td>
                              <td className="p-4">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${dealFollowUps.length > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                                    {dealFollowUps.length} note{dealFollowUps.length !== 1 ? "s" : ""}
                                  </span>
                                  {dealFollowUps.length > 0 && (
                                    <button onClick={() => { setViewFollowUpDeal({ deal, followUps: dealFollowUps }); setIsViewFollowUpModal(true); }}
                                      className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100 transition-colors">
                                      👁 View
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <button onClick={() => { setSelectedDealForFollowUp(deal); setFollowUpForm({ startDate: "", endDate: "", remark: "", status: "Medium" }); setIsFollowUpModalOpen(true); }}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm">
                                  <Plus size={12} /><span>Create Follow Up</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Follow-up History */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b bg-gradient-to-r from-slate-50 to-amber-50/30">
                  <div className="flex flex-wrap gap-3 items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center">
                      <span className="w-1 h-5 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full mr-3 inline-block"></span>
                      📝 Follow-up History
                      <span className="ml-3 text-xs bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-full">
                        {(() => {
                          let f = isAdmin || isBM ? followUps : followUps.filter(f => f.rmUsername === loggedInUser.username);
                          if (followUpFilter.start) f = f.filter(x => x.startDate >= followUpFilter.start);
                          if (followUpFilter.end) f = f.filter(x => x.endDate <= followUpFilter.end);
                          if (followUpFilter.viewDealId) f = f.filter(x => x.dealId === followUpFilter.viewDealId);
                          return f.length;
                        })()} records
                      </span>
                    </h3>
                    {followUpFilter.viewDealId && (
                      <button onClick={() => setFollowUpFilter(p => ({ ...p, viewDealId: null }))}
                        className="text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-medium">✕ Show All</button>
                    )}
                  </div>
                  {/* Date filter — moved here */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-slate-500 font-medium">🔍 Filter:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400 whitespace-nowrap">From</span>
                      <input type="date" value={followUpFilter.start} onChange={e => setFollowUpFilter(p => ({ ...p, start: e.target.value }))}
                        className="text-xs border border-slate-200 bg-white rounded-xl px-2 py-2 outline-none focus:border-indigo-400 text-slate-700 shadow-sm" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400 whitespace-nowrap">To</span>
                      <input type="date" value={followUpFilter.end} onChange={e => setFollowUpFilter(p => ({ ...p, end: e.target.value }))}
                        className="text-xs border border-slate-200 bg-white rounded-xl px-2 py-2 outline-none focus:border-indigo-400 text-slate-700 shadow-sm" />
                    </div>
                    {(followUpFilter.start || followUpFilter.end) && (
                      <button onClick={() => setFollowUpFilter(p => ({ ...p, start: "", end: "" }))}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-2 rounded-xl hover:bg-red-50 transition-colors whitespace-nowrap">✕ Reset</button>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {(() => {
                    let filtered = isAdmin || isBM ? followUps : followUps.filter(f => f.rmUsername === loggedInUser.username);
                    if (followUpFilter.start) filtered = filtered.filter(x => x.startDate >= followUpFilter.start);
                    if (followUpFilter.end) filtered = filtered.filter(x => x.endDate <= followUpFilter.end);
                    if (followUpFilter.viewDealId) filtered = filtered.filter(x => x.dealId === followUpFilter.viewDealId);
                    if (!filtered.length) return (
                      <div className="py-16 text-center text-slate-400">
                        <CheckCircle size={40} className="mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No follow-ups yet</p>
                        <p className="text-xs mt-1">Click a customer above to add your first follow-up</p>
                      </div>
                    );
                    return filtered.map((f, i) => (
                      <div key={f.id} className="p-5 hover:bg-amber-50/20 transition-colors">
                        <div className="flex flex-wrap gap-4 items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className="font-bold text-slate-800">{f.client}</span>
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg">{f.branch}</span>
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg">{formatCurrency(f.amount)}</span>
                              {f.rate && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg">{f.rate}%</span>}
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-lg">Created: {new Date(f.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                              {/* Priority Status */}
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${f.status === "High" ? "bg-red-50 text-red-600 border-red-200" : f.status === "Low" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200"}`}>
                                {f.status === "High" ? "🔴 High" : f.status === "Low" ? "🟢 Low" : "🟡 Medium"}
                              </span>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mt-2">
                              <p className="text-sm text-slate-700 leading-relaxed">💬 {f.remark}</p>
                            </div>
                            <div className="flex items-center gap-4 mt-2 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-400">📅 Follow-up:</span>
                                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">{new Date(f.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                                <span className="text-xs text-slate-400">→</span>
                                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">{new Date(f.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                              </div>
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

{/* USER CREATED TAB */}
          {activeTab === "users" && (
            <div className="max-w-4xl mx-auto space-y-6">

              {/* ADMIN VIEW — full management */}
              {isAdmin && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="p-6 border-b flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">User Created</h2>
                      <p className="text-sm text-slate-500 mt-0.5">{appUsers.length} total accounts</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleExportUsers}
                        className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
                        <FileDown size={18} /><span>👥 Export Users</span>
                      </button>
                      <button onClick={() => { setEditingUser(null); setNewUser({ username: "", password: "", name: "", role: "rm", branch: "NRD", branches: [] }); setIsUserModalOpen(true); }}
                        className="flex items-center space-x-2 bg-red-700 hover:bg-red-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
                        <UserPlus size={18} /><span>Create New User</span>
                      </button>
                    </div>
                  </div>
                  {/* Stats row */}
                  <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
                    <div className="p-4 text-center">
                      <p className="text-2xl font-bold text-slate-800">{appUsers.length}</p>
                      <p className="text-xs text-slate-500 mt-1">Total Users</p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-2xl font-bold text-purple-600">{appUsers.filter(u => u.role === "admin").length}</p>
                      <p className="text-xs text-slate-500 mt-1">Admins</p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-2xl font-bold text-amber-600">{appUsers.filter(u => u.role === "bm").length}</p>
                      <p className="text-xs text-slate-500 mt-1">Branch Managers</p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-2xl font-bold text-indigo-600">{appUsers.filter(u => u.role === "rm").length}</p>
                      <p className="text-xs text-slate-500 mt-1">RMs</p>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {appUsers.map(u => (
                      <div key={u.id} className="flex items-center p-5 hover:bg-slate-50 transition-colors">
                        <div className="relative flex-shrink-0">
                          {u.photoUrl ? (
                            <img src={u.photoUrl} alt={u.name} className="w-11 h-11 rounded-full object-cover border-2 border-indigo-100" />
                          ) : (
                            <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg ${u.role === "admin" ? "bg-purple-100 text-purple-600" : u.role === "bm" ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600"}`}>
                              {u.name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <label className="absolute -bottom-1 -right-1 bg-indigo-600 rounded-full p-1 cursor-pointer hover:bg-indigo-700" title="Upload photo">
                            <Upload size={10} className="text-white" />
                            <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(u.id, e.target.files[0])} />
                          </label>
                        </div>
                        <div className="ml-4 flex-1 min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap gap-1">
                            <p className="font-bold text-slate-800">{u.name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === "admin" ? "bg-purple-100 text-purple-700" : u.role === "bm" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"}`}>
                              {u.role === "admin" ? "🔑 Admin" : u.role === "bm" ? "🏦 BM" : "👤 RM"}
                            </span>
                            {u.username === loggedInUser.username && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">You</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">@{u.username} • Branch: <span className="font-semibold text-slate-700">{u.branch}</span></p>
                          {u.role === "bm" && u.branches && u.branches.length > 1 && (
                            <p className="text-xs text-amber-600 mt-0.5">🏦 Controls: {u.branches.join(", ")}</p>
                          )}
                          <div className="flex items-center space-x-3 mt-1">
                            <span className="text-xs text-slate-400">🔒 Password: <span className="font-mono tracking-widest">••••••</span></span>
                            <span className="text-xs text-slate-400">📁 {deals.filter(d => d.rmUsername === u.username).length} customers</span>
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-2">
                          <button onClick={() => handleEditUser(u)}
                            className="flex items-center space-x-1 px-3 py-1.5 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-medium transition-colors">
                            <Edit2 size={13} /><span>Edit</span>
                          </button>
                          {u.username !== loggedInUser.username && (
                            <button onClick={() => handleDeleteUser(u.id, u.name)}
                              className="flex items-center space-x-1 px-3 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors">
                              <Trash2 size={13} /><span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RM VIEW — read-only profile card + team list */}
              {!isAdmin && (
                <div className="space-y-6">
                  {/* My Profile */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5">
                      <h2 className="text-white font-bold text-lg">My Profile</h2>
                      <p className="text-indigo-200 text-sm mt-0.5">Your account information</p>
                    </div>
                    <div className="p-6">
                      <div className="flex items-start space-x-5">
                        <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-indigo-100">
                          {loggedInUser.photoUrl ? (
                            <img src={loggedInUser.photoUrl} alt={loggedInUser.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-3xl font-bold text-indigo-600">
                              {loggedInUser.name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Full Name</p>
                            <p className="font-bold text-slate-800 text-lg mt-0.5">{loggedInUser.name}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Username</p>
                              <p className="font-semibold text-slate-700 mt-0.5 font-mono">@{loggedInUser.username}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Password</p>
                              <p className="font-semibold text-slate-700 mt-0.5 font-mono tracking-widest">••••••••</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Role</p>
                              <span className="inline-block mt-0.5 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">👤 Relationship Manager</span>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Branch</p>
                              <span className="inline-block mt-0.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-bold">{loggedInUser.branch}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-3 gap-4 text-center">
                        {[
                          { label: "Total Customers", value: visibleDeals.length, color: "text-slate-800" },
                          { label: "Completed", value: visibleDeals.filter(d => d.status === "Won").length, color: "text-emerald-600" },
                          { label: "Pending", value: visibleDeals.filter(d => d.status === "Pending").length, color: "text-amber-600" },
                        ].map(stat => (
                          <div key={stat.label} className="bg-slate-50 rounded-xl p-3">
                            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                            <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center space-x-2">
                        <Shield size={16} className="text-amber-600 flex-shrink-0" />
                        <p className="text-xs text-amber-700">To change your password or role, please contact your Admin.</p>
                      </div>
                    </div>
                  </div>

                  {/* Team Directory (read only) */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b">
                      <h2 className="text-lg font-bold text-slate-800">Team Directory</h2>
                      <p className="text-sm text-slate-500 mt-0.5">All members in your team</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {appUsers.map(u => (
                        <div key={u.id} className="flex items-center p-4 hover:bg-slate-50">
                          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                            {u.photoUrl ? (
                              <img src={u.photoUrl} alt={u.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center font-bold ${u.role === "admin" ? "bg-purple-100 text-purple-600" : "bg-indigo-100 text-indigo-600"}`}>
                                {u.name?.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="flex items-center space-x-2">
                              <p className="font-semibold text-slate-800 text-sm">{u.name}</p>
                              {u.username === loggedInUser.username && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">You</span>}
                            </div>
                            <p className="text-xs text-slate-400">Branch: {u.branch}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.role === "admin" ? "bg-purple-100 text-purple-700" : u.role === "bm" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"}`}>
                            {u.role === "admin" ? "🔑 Admin" : u.role === "bm" ? "🏦 BM" : "👤 RM"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </main>

      {/* FAB mobile */}
      {activeTab === "team" && (
        <button onClick={() => setIsAddDealModalOpen(true)} className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center z-40"><Plus size={24} /></button>
      )}

      {/* TOAST */}
      {successToast && (
        <div className="fixed top-6 right-6 z-[100] flex items-center space-x-3 bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl max-w-sm">
          <CheckCircle size={20} className="flex-shrink-0" /><p className="text-sm font-medium">{successToast}</p>
        </div>
      )}

      {/* CREATE CUSTOMER MODAL */}
      {isAddDealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAddDealModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative z-10 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex justify-between items-center rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Create New Customer</h3>
                <p className="text-xs text-slate-500 mt-0.5">Fill in all customer loan details below</p>
              </div>
              <button onClick={() => setIsAddDealModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"><X size={18} className="text-slate-400" /></button>
            </div>

            <form onSubmit={handleAddDeal} className="p-6 overflow-y-auto space-y-5">

              {/* Row 1: Customer Name + Branch */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Customer Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={newDeal.client} onChange={e => setNewDeal({...newDeal, client: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm" placeholder="John Smith" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Branch</label>
                  {!isAdmin ? (
                    <div className="w-full px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-800 font-bold text-sm flex items-center">
                      🏦 {loggedInUser.branch} <span className="ml-2 text-xs text-indigo-400">(fixed)</span>
                    </div>
                  ) : (
                    <select value={newDeal.branch} onChange={e => setNewDeal({...newDeal, branch: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm">
                      {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {/* Row 2: Business + Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Business / Workplace</label>
                  <input type="text" value={newDeal.businessName} onChange={e => setNewDeal({...newDeal, businessName: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm" placeholder="Acme Corp" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Phone / Telegram</label>
                  <input type="text" value={newDeal.phone} onChange={e => setNewDeal({...newDeal, phone: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm" placeholder="+855 12 345 678" />
                </div>
              </div>

              {/* Row 3: Request Amount + Approved Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Request Amount ($) <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                    <input type="number" required min="1" value={newDeal.amount} onChange={e => setNewDeal({...newDeal, amount: e.target.value})}
                      className="w-full pl-7 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm" placeholder="50,000" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Approved Amount ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 text-sm font-bold">$</span>
                    <input type="number" min="0" value={newDeal.approvedAmount} onChange={e => setNewDeal({...newDeal, approvedAmount: e.target.value})}
                      className="w-full pl-7 pr-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl outline-none focus:border-emerald-500 focus:bg-white transition text-sm" placeholder="45,000" />
                  </div>
                </div>
              </div>

              {/* Row 4: Loan Type + Rate */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Loan Type</label>
                  <select value={newDeal.loanType} onChange={e => setNewDeal({...newDeal, loanType: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm">
                    {LOAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Rate (%)</label>
                  <input type="number" step="0.01" value={newDeal.rate} onChange={e => setNewDeal({...newDeal, rate: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm" placeholder="5.5" />
                </div>
              </div>

              {/* Row 5: Loan Status + Assign RM */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Loan Status</label>
                  <select value={newDeal.status} onChange={e => setNewDeal({...newDeal, status: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm">
                    <option value="Pending">Pending</option>
                    <option value="Pre-Approval">Pre-Approval</option>
                    <option value="Processing">Processing</option>
                    <option value="LOS">LOS</option>
                    <option value="LOO">LOO</option>
                    <option value="Won">Completed Drawdown</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Assign RM</label>
                  {isAdmin ? (
                    <select value={newDeal.repUsername} onChange={e => setNewDeal({...newDeal, repUsername: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm">
                      <option value="">— Select RM —</option>
                      {rmList.map(rm => <option key={rm.id} value={rm.username}>{rm.name}</option>)}
                    </select>
                  ) : (
                    <div className="w-full px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-800 font-medium text-sm">{loggedInUser.name} (You)</div>
                  )}
                </div>
              </div>

              {/* Row 6: Tenor + Customer Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Tenor (months)</label>
                  <input type="number" value={newDeal.tenor} onChange={e => setNewDeal({...newDeal, tenor: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm" placeholder="36" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Customer Status</label>
                  <select value={newDeal.customerStatus || "Medium"} onChange={e => setNewDeal({...newDeal, customerStatus: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm">
                    <option value="High">🔴 High</option>
                    <option value="Medium">🟡 Medium</option>
                    <option value="Low">🟢 Low</option>
                  </select>
                </div>
              </div>

              {/* Row 7: Income Type + Income Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Income Type</label>
                  <select value={newDeal.incomeType || "Salary"} onChange={e => setNewDeal({...newDeal, incomeType: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm">
                    {INCOME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Income Amount ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                    <input type="number" min="0" value={newDeal.incomeAmount} onChange={e => setNewDeal({...newDeal, incomeAmount: e.target.value})}
                      className="w-full pl-7 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm" placeholder="3,000" />
                  </div>
                </div>
              </div>

              {/* Row 8: Existing Bank Section */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  🏦 Existing Bank <span className="text-slate-300 font-normal">(optional)</span>
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Existing Bank Name</label>
                    <input type="text" value={newDeal.existingBank} onChange={e => setNewDeal({...newDeal, existingBank: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm" placeholder="e.g. ABA Bank" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Loan Outstanding ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                      <input type="number" min="0" value={newDeal.loanOutstanding} onChange={e => setNewDeal({...newDeal, loanOutstanding: e.target.value})}
                        className="w-full pl-7 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm" placeholder="20,000" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Existing Rate (%)</label>
                    <input type="number" step="0.01" value={newDeal.existingRate} onChange={e => setNewDeal({...newDeal, existingRate: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm" placeholder="7.5" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Maturity Date</label>
                    <input type="date" value={newDeal.maturityDate} onChange={e => setNewDeal({...newDeal, maturityDate: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm" />
                  </div>
                </div>
              </div>

              {/* RM info bar */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle size={15} className="text-indigo-500" />
                  <span className="text-sm text-indigo-800">RM: <strong>{isAdmin ? (rmList.find(r => r.username === newDeal.repUsername)?.name || "Not selected") : loggedInUser.name}</strong></span>
                </div>
                <span className="text-xs text-indigo-400">Branch: {isAdmin ? newDeal.branch : loggedInUser.branch}</span>
              </div>

              {/* Buttons */}
              <div className="flex space-x-3 pt-1">
                <button type="button" onClick={() => setIsAddDealModalOpen(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-medium transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white rounded-xl text-sm font-semibold shadow-md transition-all">
                  💾 Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD/EDIT USER MODAL */}
      {isUserModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsUserModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-bold">{editingUser ? "Edit User" : "Create New User"}</h3>
              <button onClick={() => setIsUserModalOpen(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input type="text" required value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" placeholder="Ahmad Razali" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Username <span className="text-red-500">*</span></label>
                  <input type="text" required value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                    disabled={!!editingUser}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 disabled:opacity-50" placeholder="ahmad_rm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type={showNewUserPw ? "text" : "password"} required value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 pr-10" placeholder="Password" />
                    <button type="button" onClick={() => setShowNewUserPw(!showNewUserPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showNewUserPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500">
                    <option value="rm">👤 Relationship Manager</option>
                    <option value="bm">🏦 Branch Manager</option>
                    <option value="admin">🔑 Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Primary Branch</label>
                  <select value={newUser.branch} onChange={e => setNewUser({ ...newUser, branch: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500">
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              {newUser.role === "bm" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    🏦 Assigned Branches <span className="text-xs text-slate-400">(tick all branches this BM controls)</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                    {BRANCHES.map(b => {
                      const checked = (newUser.branches || [newUser.branch]).includes(b);
                      return (
                        <label key={b} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-all ${checked ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"}`}>
                          <input type="checkbox" checked={checked} className="hidden"
                            onChange={e => {
                              const cur = newUser.branches || [newUser.branch];
                              const next = e.target.checked ? [...new Set([...cur, b])] : cur.filter(x => x !== b);
                              setNewUser({ ...newUser, branches: next.length ? next : [newUser.branch] });
                            }} />
                          {b}
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-indigo-600 mt-1.5">✅ Selected: {(newUser.branches || [newUser.branch]).join(", ")}</p>
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

      {/* STATUS FILTER MODAL */}
      {statusFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setStatusFilterModal(null)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl relative z-10 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{statusFilterModal.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {(() => {
                    if (statusFilterModal.status === "all_rm") return visibleDeals.filter(d => d.rmUsername === statusFilterModal.rmUsername).length;
                    if (statusFilterModal.status === "all") return visibleDeals.length;
                    if (statusFilterModal.rmUsername) return visibleDeals.filter(d => d.status === statusFilterModal.status && d.rmUsername === statusFilterModal.rmUsername).length;
                    return visibleDeals.filter(d => d.status === statusFilterModal.status).length;
                  })()} customer(s)
                </p>
              </div>
              <button onClick={() => setStatusFilterModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="overflow-y-auto">
              {(() => {
                let filtered;
                if (statusFilterModal.filteredDeals) {
                  const src = statusFilterModal.filteredDeals;
                  filtered = statusFilterModal.status === "all" ? src : src.filter(d => d.status === statusFilterModal.status);
                } else if (statusFilterModal.branchFilter) {
                  filtered = statusFilterModal.status === "all"
                    ? deals.filter(d => d.branch === statusFilterModal.branchFilter)
                    : deals.filter(d => d.branch === statusFilterModal.branchFilter && d.status === statusFilterModal.status);
                } else if (statusFilterModal.status === "all_rm") filtered = visibleDeals.filter(d => d.rmUsername === statusFilterModal.rmUsername);
                else if (statusFilterModal.status === "all") filtered = visibleDeals;
                else if (statusFilterModal.rmUsername) filtered = visibleDeals.filter(d => d.status === statusFilterModal.status && d.rmUsername === statusFilterModal.rmUsername);
                else filtered = visibleDeals.filter(d => d.status === statusFilterModal.status);
                if (!filtered.length) return <div className="py-16 text-center text-slate-400"><Briefcase size={40} className="mx-auto mb-3 opacity-30" /><p>No customers here</p></div>;
                return (
                  <table className="w-full text-left">
                    <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b">
                      <th className="p-4">#</th><th className="p-4">Customer</th><th className="p-4">Branch</th><th className="p-4">Loan Type</th>
                      <th className="p-4">Amount</th><th className="p-4">RM</th><th className="p-4">Priority</th><th className="p-4">Status</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map((d, i) => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="p-4 text-slate-400 text-sm">{i+1}</td>
                          <td className="p-4"><p className="font-semibold text-sm">{d.client}</p>{d.businessName && <p className="text-xs text-slate-400">{d.businessName}</p>}</td>
                          <td className="p-4"><span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg">{d.branch || "—"}</span></td>
                          <td className="p-4"><span className="text-xs text-slate-600">{d.loanType || "—"}</span></td>
                          <td className="p-4"><span className="font-bold text-sm">{formatCurrency(d.amount)}</span></td>
                          <td className="p-4"><span className="text-sm">{d.rmName || "—"}</span></td>
                          <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${d.customerStatus==="High"?"bg-red-100 text-red-600":d.customerStatus==="Low"?"bg-emerald-100 text-emerald-600":"bg-amber-100 text-amber-600"}`}>{d.customerStatus==="High"?"🔴 High":d.customerStatus==="Low"?"🟢 Low":"🟡 Med"}</span></td>
                          <td className="p-4"><span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(d.status)}`}>{d.status === "Won" ? "Completed" : d.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end">
              <button onClick={() => setStatusFilterModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* PRIORITY MODAL */}
      {isPriorityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsPriorityModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative z-10 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b bg-gradient-to-r from-red-50 to-orange-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-2"></span>
                  🔴 High Priority Customers
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">AI-ranked customers that need immediate follow-up</p>
              </div>
              <button onClick={() => setIsPriorityModalOpen(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            {/* Priority filter tabs */}
            {!isAiLoading && priorityList.length > 0 && (
              <div className="flex gap-2 px-6 pt-4 pb-2">
                {["High","Medium","Low","All"].map(lvl => {
                  const count = lvl === "All" ? priorityList.length : priorityList.filter(p => p.priorityLevel === lvl).length;
                  return (
                    <button key={lvl}
                      onClick={() => setPriorityTabFilter(lvl)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        (priorityTabFilter || "High") === lvl
                          ? lvl==="High"?"bg-red-500 text-white border-red-500":lvl==="Medium"?"bg-amber-500 text-white border-amber-500":lvl==="Low"?"bg-emerald-500 text-white border-emerald-500":"bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                      }`}>
                      {lvl === "High" ? "🔴" : lvl === "Medium" ? "🟡" : lvl === "Low" ? "🟢" : "🌐"} {lvl} ({count})
                    </button>
                  );
                })}
              </div>
            )}
            <div className="p-6 overflow-y-auto">
              {isAiLoading ? (
                <div className="flex flex-col items-center py-16 text-slate-400"><Loader2 size={40} className="animate-spin mb-3 text-red-400" /><p className="text-sm animate-pulse">AI is analyzing customers...</p></div>
              ) : (
                <div className="space-y-3">
                  {priorityList
                    .filter(item => {
                      const tab = priorityTabFilter || "High";
                      return tab === "All" ? true : item.priorityLevel === tab;
                    })
                    .map((item, i) => (
                    <div key={i} className={`rounded-xl border p-4 ${priorityColor(item.priorityLevel)}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="font-bold text-slate-400 w-6">{i + 1}</span>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className={`w-2 h-2 rounded-full ${priorityDot(item.priorityLevel)}`}></span>
                              <h4 className="font-bold text-slate-800">{item.customerName}</h4>
                            </div>
                            {item.businessName && <p className="text-xs text-slate-500 ml-4">{item.businessName}</p>}
                            <p className="text-xs mt-1 ml-4 opacity-80">{item.reason}</p>
                          </div>
                        </div>
                        <div className="text-right ml-4 flex-shrink-0">
                          {item.amount > 0 && <p className="font-bold text-slate-700">{formatCurrency(item.amount)}</p>}
                          <p className="text-xs text-slate-500">RM: {item.rmName}</p>
                          {item.status && <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge(item.status)}`}>{item.status === "Won" ? "Completed" : item.status}</span>}
                          <span className={`inline-block mt-1 ml-1 px-2 py-0.5 rounded-full text-xs font-bold border ${priorityColor(item.priorityLevel)}`}>{item.priorityLevel}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {priorityList.filter(item => (priorityTabFilter||"High") === "All" ? true : item.priorityLevel === (priorityTabFilter||"High")).length === 0 && (
                    <div className="py-10 text-center text-slate-400"><p>No {priorityTabFilter||"High"} priority customers found</p></div>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end">
              <button onClick={() => setIsPriorityModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER MODAL */}
      {isEditDealModalOpen && editingDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsEditDealModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Edit Customer</h3>
                <p className="text-xs text-slate-500 mt-0.5">Editing: <strong>{editingDeal.client}</strong></p>
              </div>
              <button onClick={() => setIsEditDealModalOpen(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleUpdateDeal} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={editDealForm.client} onChange={e => setEditDealForm({...editDealForm, client: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
                  <select value={editDealForm.branch} onChange={e => setEditDealForm({...editDealForm, branch: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500">
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Business / Workplace</label>
                <input type="text" value={editDealForm.businessName} onChange={e => setEditDealForm({...editDealForm, businessName: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone / Telegram</label>
                <input type="text" value={editDealForm.phone} onChange={e => setEditDealForm({...editDealForm, phone: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Request Amount ($)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input type="number" min="1" value={editDealForm.amount} onChange={e => setEditDealForm({...editDealForm, amount: e.target.value})}
                    className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Loan Type</label>
                  <select value={editDealForm.loanType} onChange={e => setEditDealForm({...editDealForm, loanType: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500">
                    {LOAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rate (%)</label>
                  <input type="number" step="0.01" value={editDealForm.rate} onChange={e => setEditDealForm({...editDealForm, rate: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tenor (months)</label>
                  <input type="number" value={editDealForm.tenor} onChange={e => setEditDealForm({...editDealForm, tenor: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Income Status</label>
                  <select value={editDealForm.incomeStatus} onChange={e => setEditDealForm({...editDealForm, incomeStatus: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500">
                    {INCOME_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Loan Status</label>
                  <select value={editDealForm.status} onChange={e => setEditDealForm({...editDealForm, status: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500">
                    <option value="Pending">Pending</option>
                    <option value="Pre-Approval">Pre-Approval</option>
                    <option value="Processing">Processing</option>
                    <option value="LOS">LOS</option>
                    <option value="LOO">LOO</option>
                    <option value="Won">Completed Drawdown</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                {isAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Assign RM</label>
                    <select value={editDealForm.repUsername} onChange={e => setEditDealForm({...editDealForm, repUsername: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500">
                      <option value="">— Select RM —</option>
                      {rmList.map(rm => <option key={rm.id} value={rm.username}>{rm.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex items-center space-x-2">
                <CheckCircle size={16} className="text-indigo-600" />
                <span className="text-sm text-indigo-800">RM: <strong>{editingDeal.rmName}</strong> • Created: {editingDeal.date}</span>
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => setIsEditDealModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EMAIL MODAL */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsEmailModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b bg-indigo-50 flex justify-between items-center">
              <div className="flex items-center font-bold text-indigo-900"><Mail size={20} className="mr-2 text-indigo-600" />AI Follow-up Draft</div>
              <button onClick={() => setIsEmailModalOpen(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-slate-500 mb-4">To: <strong>{selectedDealForEmail?.client}</strong> — {formatCurrency(selectedDealForEmail?.amount || 0)}</p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[200px] relative">
                {isAiLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 size={32} className="animate-spin mb-2 text-indigo-500" /><p className="text-sm animate-pulse">Writing...</p>
                  </div>
                ) : (
                  <textarea value={emailDraft} onChange={e => setEmailDraft(e.target.value)} className="w-full min-h-[200px] bg-transparent resize-none outline-none text-slate-700 text-sm leading-relaxed" />
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
              <button onClick={() => setIsEmailModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl">Close</button>
              <button onClick={() => copyToClipboard(emailDraft)} disabled={isAiLoading} className="flex items-center space-x-2 px-4 py-2 bg-red-700 hover:bg-red-800 disabled:bg-indigo-400 text-white text-sm rounded-xl">
                <Copy size={16} /><span>Copy</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOLLOW UP MODAL */}
      {isFollowUpModalOpen && selectedDealForFollowUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsFollowUpModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex justify-between items-center rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-slate-800">📋 List Customer Follow Up</h3>
                <p className="text-xs text-slate-500 mt-0.5">🔒 Locked after save — cannot be edited</p>
              </div>
              <button onClick={() => setIsFollowUpModalOpen(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Customer Info — read only */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
                <p className="text-xs text-indigo-400 uppercase font-semibold tracking-wide">Customer Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-400">Customer Name</p>
                    <p className="font-bold text-slate-800">{selectedDealForFollowUp.client}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Branch</p>
                    <p className="font-bold text-indigo-700">{selectedDealForFollowUp.branch}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Request Amount</p>
                    <p className="font-bold text-emerald-700">{formatCurrency(selectedDealForFollowUp.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Rate</p>
                    <p className="font-bold text-slate-700">{selectedDealForFollowUp.rate ? `${selectedDealForFollowUp.rate}%` : "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400">Date Created</p>
                    <p className="font-bold text-slate-700">{new Date(selectedDealForFollowUp.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                  </div>
                </div>
              </div>

              {/* Follow Up Form */}
              <form onSubmit={handleSaveFollowUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Start Date <span className="text-red-500">*</span></label>
                    <input type="date" required value={followUpForm.startDate}
                      onChange={e => setFollowUpForm(p => ({ ...p, startDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">End Date <span className="text-red-500">*</span></label>
                    <input type="date" required value={followUpForm.endDate}
                      min={followUpForm.startDate}
                      onChange={e => setFollowUpForm(p => ({ ...p, endDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Priority Status <span className="text-red-500">*</span></label>
                  <select value={followUpForm.status || "Medium"} onChange={e => setFollowUpForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm">
                    <option value="High">🔴 High</option>
                    <option value="Medium">🟡 Medium</option>
                    <option value="Low">🟢 Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Remark <span className="text-red-500">*</span></label>
                  <textarea required rows={4} value={followUpForm.remark}
                    onChange={e => setFollowUpForm(p => ({ ...p, remark: e.target.value }))}
                    placeholder="Write your follow-up notes here... e.g. Customer confirmed interest, waiting for income documents..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm resize-none leading-relaxed" />
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <Shield size={14} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-700">Once saved, this follow-up <strong>cannot be edited or deleted.</strong></p>
                </div>
                <div className="flex space-x-3 pt-1">
                  <button type="button" onClick={() => setIsFollowUpModalOpen(false)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-medium">Cancel</button>
                  <button type="submit"
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white rounded-xl text-sm font-semibold shadow-md">
                    🔒 Save & Lock
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW FOLLOW UP MODAL */}
      {isViewFollowUpModal && viewFollowUpDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsViewFollowUpModal(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl relative z-10 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-orange-50 flex justify-between items-center rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-slate-800">👁 Follow-up Details</h3>
                <p className="text-xs text-slate-500 mt-0.5">{viewFollowUpDeal.followUps.length} follow-up(s) recorded</p>
              </div>
              <button onClick={() => setIsViewFollowUpModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>

            {/* Customer Info */}
            <div className="px-6 pt-4">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-xs text-indigo-400 uppercase font-semibold tracking-wide mb-3">Customer Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-400">Customer Name</p>
                    <p className="font-bold text-slate-800">{viewFollowUpDeal.deal.client}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">RM Name</p>
                    <p className="font-bold text-slate-700">{viewFollowUpDeal.deal.rmName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Branch</p>
                    <p className="font-bold text-indigo-700">{viewFollowUpDeal.deal.branch || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Product Type</p>
                    <p className="font-bold text-slate-700">{viewFollowUpDeal.deal.loanType || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Amount Request</p>
                    <p className="font-bold text-emerald-700">{formatCurrency(viewFollowUpDeal.deal.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Rate</p>
                    <p className="font-bold text-slate-700">{viewFollowUpDeal.deal.rate ? `${viewFollowUpDeal.deal.rate}%` : "—"}</p>
                  </div>
                  {viewFollowUpDeal.deal.existingBank && <>
                    <div>
                      <p className="text-xs text-slate-400">Existing Bank</p>
                      <p className="font-bold text-slate-700">{viewFollowUpDeal.deal.existingBank}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Loan Outstanding</p>
                      <p className="font-bold text-slate-700">{viewFollowUpDeal.deal.loanOutstanding ? formatCurrency(viewFollowUpDeal.deal.loanOutstanding) : "—"}</p>
                    </div>
                  </>}
                </div>
              </div>
            </div>

            {/* Follow Up History */}
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">📝 Follow-up Notes</p>
              <div className="space-y-3">
                {viewFollowUpDeal.followUps.map((f, i) => (
                  <div key={f.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">#{i + 1}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${f.status === "High" ? "bg-red-50 text-red-600 border-red-200" : f.status === "Low" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200"}`}>
                          {f.status === "High" ? "🔴 High" : f.status === "Low" ? "🟢 Low" : "🟡 Medium"}
                        </span>
                        <span className="text-xs text-slate-400">📅 {new Date(f.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} → {new Date(f.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                      <span className="text-xs text-slate-400">🔒 {new Date(f.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">💬 {f.remark}</p>
                    <p className="text-xs text-slate-400 mt-1.5">👤 {f.rmName}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-slate-50 flex justify-between items-center">
              <button onClick={() => { setIsViewFollowUpModal(false); setSelectedDealForFollowUp(viewFollowUpDeal.deal); setFollowUpForm({ startDate: "", endDate: "", remark: "", status: "Medium" }); setIsFollowUpModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium rounded-xl">
                <Plus size={14} /><span>Add Follow Up</span>
              </button>
              <button onClick={() => setIsViewFollowUpModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT EXCEL MODAL */}
      {isImportModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isImporting && setIsImportModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl relative z-10 flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-orange-50 flex justify-between items-center rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-slate-800">📥 Import Customers from Excel</h3>
                <p className="text-xs text-slate-500 mt-0.5">Upload CSV/Excel file — preview before saving</p>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} disabled={isImporting}><X size={20} className="text-slate-400" /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">

              {/* Step 1: Download template */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-indigo-800 text-sm">Step 1: Download Template</p>
                  <p className="text-xs text-indigo-600 mt-0.5">Download the template, fill in your customers, then upload below.</p>
                </div>
                <button onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium rounded-xl flex-shrink-0">
                  <FileDown size={16} /><span>Download Template</span>
                </button>
              </div>

              {/* Step 2: Upload file */}
              <div className="border-2 border-dashed border-slate-200 hover:border-amber-400 rounded-xl p-8 text-center transition-colors">
                <Upload size={36} className="mx-auto mb-3 text-slate-300" />
                <p className="font-semibold text-slate-600 mb-1">Step 2: Upload your file</p>
                <p className="text-xs text-slate-400 mb-4">Supports .CSV files (Excel → Save As → CSV)</p>
                <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors">
                  <Upload size={16} /><span>Choose File</span>
                  <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>

              {/* Errors */}
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="font-semibold text-red-700 text-sm mb-2">⚠️ {importErrors.length} error(s) found — fix in file and re-upload:</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {importErrors.map((e, i) => <p key={i} className="text-xs text-red-600">• {e}</p>)}
                  </div>
                </div>
              )}

              {/* Preview table */}
              {importPreview.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-slate-800">
                      ✅ Step 3: Preview — <span className="text-emerald-600">{importPreview.length} customers ready to import</span>
                    </p>
                    <span className="text-xs text-slate-400">Scroll to review all rows</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-72">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0">
                          <tr className="bg-slate-100 text-slate-600 uppercase tracking-wide">
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Customer</th>
                            <th className="px-3 py-2">Branch</th>
                            <th className="px-3 py-2">Product</th>
                            <th className="px-3 py-2">Amount</th>
                            <th className="px-3 py-2">Rate</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Priority</th>
                            <th className="px-3 py-2">RM</th>
                            <th className="px-3 py-2">Existing Bank</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {importPreview.map((row, i) => (
                            <tr key={i} className="hover:bg-amber-50/30">
                              <td className="px-3 py-2 text-slate-400">{i+1}</td>
                              <td className="px-3 py-2 font-semibold text-slate-800">
                                {row.client}
                                {row.businessName && <div className="text-slate-400 font-normal">{row.businessName}</div>}
                              </td>
                              <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded">{row.branch}</span></td>
                              <td className="px-3 py-2 text-slate-600">{row.loanType}</td>
                              <td className="px-3 py-2 font-bold text-slate-700">{formatCurrency(row.amount)}</td>
                              <td className="px-3 py-2">{row.rate ? `${row.rate}%` : "—"}</td>
                              <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${statusBadge(row.status)}`}>{row.status}</span></td>
                              <td className="px-3 py-2">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${row.customerStatus==="High"?"bg-red-100 text-red-600":row.customerStatus==="Low"?"bg-emerald-100 text-emerald-600":"bg-amber-100 text-amber-600"}`}>
                                  {row.customerStatus}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-600">{row.rmName}</td>
                              <td className="px-3 py-2 text-slate-500">{row.existingBank || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="px-6 py-4 border-t bg-slate-50 rounded-b-2xl flex items-center justify-between gap-3">
              <button onClick={() => { setIsImportModalOpen(false); setImportPreview([]); setImportErrors([]); }} disabled={isImporting}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 text-sm font-medium">
                Cancel
              </button>
              {importPreview.length > 0 && (
                <button onClick={handleImportSave} disabled={isImporting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-md transition-all">
                  {isImporting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  {isImporting ? "Importing..." : `✅ Import ${importPreview.length} Customers`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
