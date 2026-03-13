import React, { useState, useMemo } from "react";
import {
  LayoutDashboard, Users, DollarSign, Target, TrendingUp,
  Search, Bell, Menu, X, Plus, CheckCircle, Clock, Briefcase,
  Upload, Sparkles, Mail, Copy, Loader2, Star, LogOut,
  Shield, Eye, EyeOff, UserPlus, Trash2, Edit2,
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{background: "linear-gradient(135deg, #0a4a2e 0%, #0d6b40 40%, #1a8a52 70%, #0f5c36 100%)"}}>
      {/* Decorative circles */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-10" style={{background:"radial-gradient(circle, #4ade80, transparent)", transform:"translate(-30%, -30%)"}}></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-10" style={{background:"radial-gradient(circle, #86efac, transparent)", transform:"translate(30%, 30%)"}}></div>

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative z-10">
        {/* Header — Chip Mong Green */}
        <div className="px-8 py-10 text-center" style={{background:"linear-gradient(135deg, #0d6b40 0%, #1a8a52 50%, #16a05f 100%)"}}>
          {/* Chip Mong Bank Logo SVG */}
          <div className="w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden shadow-lg">
            <img src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAIAAgADASIAAhEBAxEB/8QAHQABAAMAAgMBAAAAAAAAAAAAAAYHCAQFAgMJAf/EAFgQAAIBAwICBgMJCQsKBAcAAAABAgMEBQYRByEIEjFBUWETcYEUIjI3YnJ0kbIVFyNCUlaCobEWGCR1kqSzwdHS0zM0NUZjc4SUosNTk8LwNkNEVZXh8f/EABwBAQACAwEBAQAAAAAAAAAAAAADBAEFBgIHCP/EAD4RAAIBAwEDCQYEBAcBAQEAAAABAgMEEQUSITEGEzJBUWGBsdEiNHGRocEUcuHwNUNTghUWIzNSsvFCYpL/2gAMAwEAAhEDEQA/AK5ABrD4+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFzeyLH0PwY1tqeNO5lZRxNjNbq4vt4OS+TD4T8m0k/EyouXAmoW9W4ls0otvuK4PbaW1xd140LW3q160vg06UHKT9SRq3SPR+0diVCrmalznLhc36RulR38oRe/scmi0MLhcPhaHoMRi7KwpPtjb0Y00/XsuZPG3b4nQ23JivPfVko/V+n1MbYPhHxEy+0qGmbq3g+2V240NvZNp/UiZYzo4atrKMr/MYi0TXOMJTqyXs6qX6zUwJFbxRuKXJmzh0m5ePoZ6tOjNQSTu9YVJPvVKwUf1ub/YdhDo16eS9/qPKN+VOmv6i9Qe+Zh2FuOh2Ef5f1fqUVPo16fa95qPKJ+dOm/6jr7zozUWm7TWE4vuVWwT39qmv2GhQOZh2CWh2D/l/V+plnKdHDVtBSlj8viLyK7IzlOlJ+zqtfrIdneEXEPEKU6+mrm4px59e0lGvuvVBuX1o2uDw7eLKlXkzZz6LcfH1Pnnd21zaV5ULu3q29aPwqdWDjJetPmeo+gWZw2IzVs7fL4yzv6W23VuKMaiXq3XL2FX6u6P2jsrGdXC1LnB3L+CqcnVo7+cJPf6pIjlbtcDT3PJivDfSkpfR+n1MmgsjW/BbW2mnOtTsVmLKO79PYpzaS75Q+EuXgml4lbtNNppprtTIHFx4nPV7arby2asWn3gAGCEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHKxGNv8vkaOOxlpWu7uvLq06VKPWlJ/2efcDKTk8I4pYnDPhFqjWno7z0f3MxMufuy4i/fr/Zw7Z+vkvMuDhHwKx+EVLL6vjRyOR5Sp2nwqFB/K/8SX/SvPky7IpRioxSSS2SXcWadDO+R1em8m3NKpdbl2dfiQfh9ws0loyFOtZ2KvMjFc766SnU38Yrsh+it/FsnIBZSSWEdfRoU6EdinHC7gADJKAAAAAAAAAAAAAAACD8QOFmkNZqda+sFaZCXZe2m0Krfyu6f6Sb8GicAw0nuZFWoU68dipHK7zGXEzhDqfRaqXno/uniY8/dlvF/g1/tI9sPXzXn3Fdn0RaTTTSafamUnxZ4E43NqrldIqjjMj8Kdpt1beu/L/w5er3vkubK1ShjfE5HUuTbjmpa712ehloHLzGMyGHyVbG5SzrWd3Rl1alKrHqyj/+u/fvOIVjk2nF4YAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7zQ2lsrrDUVvhcTS61Wo96lRr3lGnvznJ+C/XyS5sJZ3HqEJVJKMVls/NE6WzOsM7Sw+FtnVrT51JvlCjDvnN9yX6+xbs2Fwt4c4PQWM9HZQVzkasf4TfVIrrz8o/kx8l7dzsOHejMPofT8MViqe8ntK4uJL8JXn+VLy8F2Je1uSF2lSUd74n0HSNFhZpVKm+fl8PUAAmN6AAAAVvxF4yaT0g52lOt918nHk7W1mmoP5c+aj6ub8igNZ8bdc6grSja5B4W03TjRsG4S5eNT4T9jS8iKdaMTT3uuWtq9lval2L14GxyJcRdeY3Q1pTuspjMvc0J9lW0tlOnF9ylJtKL9ZTHDXpCXVqqWP1tbyuqS2ir+3gvSrznDsl61s/Js0Dh8rhNTYdXWNu7TJ2FePVk4tTi01zjKL7H4xa38UZjNTXssloahSvqb/DzxLvW9eBR+R6TFtFtY7SVWou6Ve9UP1KD/AGnSV+kpqJv8Bp3FQW/486kv2NEw4l8AMRlnVyGkatPE3km5O0nu7eo/CPfT9m68EjOWqdN5zS+SeOzuOrWVwucVNbxmvGMlykvNMgnKrHiczqF1q9pL/Ulu7Uljy8y2V0ktU7rfA4Zrv29L/eOfZ9JfIxa92aTtaq7/AEV5Kn+2MigQR87PtNatbv1/Mf09DUmI6R+lLhxjk8PlbGTfOVNQrQXre6f6ifab4maF1BKMMdqSy9LLkqVeToTb8Eppb+zcw6D2riS4l2jymu4dNKX08vQ+iKaaTTTT7GgYV0jxA1fpWUVhs5dUqMeXueo/SUdvmS3S9a2ZdGg+kZQrVI2ussbG23eyvLKLcF86m22vXFv1E0a8Xx3G+tOUdrWwqnsPv4fP1waCBwMFmcVncfDIYbIW19az7KlGakk/B+D8nzOeTG/jJSWU8oAAGSGcUeHWD17jPRX0Pc2QpJ+5r2nFekg/B/lR8n7NmY91vpTNaOzlTE5u1dKqudOoudOtDulB96/Wux7M3qR3iDo7D62wFTE5al4yoXEUvSUJ/lRf7V2NENWkpb1xNFq+iwvE6lPdPz+PqYQB32vNJ5bRmoq+Fy1JKpD31KrH4FaD7Jxfh+x7ruOhKTWNzPn9SnKnJwmsNAAA8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHMwmMvs1lrbFYy3lcXlzUVOlTj2yb/Yu9vuRtThNoPH6C01CwodWtfVtp3t11dnVn4LwiuxL29rZCujPw7Wn8JHVOWobZXIU/wABCcedvQfNeqUuTfgtl4lzFyjT2VtM7zQNKVvDn6i9p8O5erAAJzpAAQ3inxDw2gcQri+fui+rJ+5bKEtp1X4t/ixXe/q3fIw2kssjrVoUYOdR4SO81ZqTDaWw9TK5y9p2ttDkt+cqku6MY9sn5Iy7xU4253VMquPwcq2GxDbW0J7V66+XJdi+Sva2QTXOrs5rLMyymbunVnzVKlHlTox3+DCPcv1vv3OhKdSs5blwOE1PXqty3Cj7MPq/32AAEJzwO30rqbPaXyCv8Dk69jW7JdR7xmvCUXykvJpnUAJ4PUJyhJSi8NGo+G3SAw+WdOw1dRp4i8k1FXUN3bTfnvu6ft3Xi0W1m8Rg9U4Z2eTtLXJ4+vFSin76L8JRkuafmmYCJhw84kao0RXisXeurY9bepZV/fUZ+Oy7Yvzjt57liFfqkdPZco5Jc3draXb6rr/fEsniX0fb6y9LkdF1pX1ut5OwrSSrQXyJPlP1PZ+sou8tbmyuqlreW9W3uKUurUpVYOMoPwafNGxOGnGPS+sfRWdWosTlp8vclxP3s38ieyUvU9n5Hfa/4f6Y1ta9TNWK90xj1aV5R2hXpru2l3rm+T3XkepUYyWYFi40O2vIc9ZSXw6vVfvgYYBZ/EvgtqfScql5Y05ZnFJtqtb026lOP+0gua9a3Xq7CsCtKLi8M5W4tqttPYqxwwADBAdrpfUeb0xk45HBZGtZXC5Nwe8ZrwlF8pLyaNO8JeN+I1RKjidQRpYrMS97CW/8HuH8lv4Evkv2Nt7GV8Tjb/LX9OwxlnXvLqq9oUqMHKT9i/aXzw56PFepKnfa2ulShyksfaz3k/KdRcl6o7+tE1Jzz7JvtEq38amLdZj1p8P0fw+po4HpsrajZWdG0t4yjRowVOmpTcmopbJbttv2nuLp9BXeAADJD+LGg8fr3TU8fcdSjfUt52V11edKfg/GL7Gvb2pGK87ir/B5i6xOUt5W95a1HTq05dz8vFNbNPvTTPoIU50leHS1HhHqbE0E8tj6bdaMVzuKC5teco82vFbrnyIK1PaWUc3r+lK4hz9Ne0uPevVGUQAUzgwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWZ0edCLWOsFc39BzxGN2rXG697Vnv7yn7ebfkn4orSnCdSpGnTi5zm1GMUt22+xG4eEGkaWi9DWWJ6q91zXp7yf5VaSW/sSSivKJLRhtSN3oVh+LuMyXsx3v7Il65LZAAvH0UAHXalzWP07grvM5SsqNpa03Ocu9+CS723skvFg8ykopyk9yOh4ra7x2g9NzyFy4Vr2rvCytets60/F+EV2t+ztaMYaoz2U1Lm7jMZi6lcXdeW8pPsiu6MV3RXcjsOI2r8jrbVFxmshJxjL3lvQ628aFJN9WC+vdvvbbI4UatTbfcfOtY1WV9UxHoLh397AAIjTA/YRlOcYQi5Sk9kkt234E34b8LtUa3qRrWVt7jxu/vr65TjT8+p3zfq5eLRp3htwq0voiEK9tb+7sol76+uIpzXzF2QXq5+LZLClKRuNP0W4vMSxsx7X9u3yMVSTjJxkmmns0+4G0uJXCfS+tYVLirQWOyrXvb63j75v5ceSn7efmjMXEXhjqnRFWVTIWjuce3tC+t05Un87vg/J+zcxOlKJjUNFuLP2sbUe1ffs8iFAAjNQC0uGvGzU+lfRWORk81ioLqqjWntVpr5FTZv2PdeGxVoMxk4vKJ7e6q209ulLDN0aC19pjWtr6TCZCMriMetVtKvvK1P1x715rdeZGeJfBbTGrI1bywhHC5V81Wt6a9FUl8uC2T9a2fe9+wyFZXVzZXdK7s7irb3FKXWp1acnGUX4prsLz4a9IO/sfR4/WlCV/braMb6jFKtBfLj2T9a2fzixGrGSxM6m31u2vYczfRXx6vVFa614cau0nk4WeQxVatCtU9Hb3FrF1add9yi0t93+S0n5E+4c9H/NZeNO+1XXnh7R81bQSdzNee/KHt3fkjTGCy2OzmJt8tibqF1ZXEetSqxTSkt2nyfNc01s/Ar/ihxl07oy4q4uhTqZXMU+Urem+rCk9t115tcu3sSb8djPNQjvb3Ez0TT7X/AF608w6l/wCcfAl+ldL6a0bi5UMNj7awoRjvWrP4c0u1zm+b9r2XkVvxE4/afwvpbLTNKObvo7r03W2toP5y5z/R5P8AKKD4gcR9Va1ry+6t/KnZ77wsqG8KMfDdfjPzluyIHmVfqiUrvlE1HmrOOzHt9FwRpfo2ay1HrDWedus/kqtz1bSDpUV72lS3n+LBcl6+197ZfRmXocf/ABLnvodP7ZpomotuG83+g1JVLKMpvLbfmAASm4AAAMe9IrQi0hq93uPouGIyjlVoJL3tKpv7+n5LnuvJ7dxWBuTi5pKnrPQt9h1GPutR9NZyf4taO7jz7t+cX5SZh2tTqUas6VWEoVIScZRktnFrk00Ua0NmR8612wVpcbUV7Mt6+6PEAERpAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC1OjJpVah4hwyNzTU7LDxVzNPsdVvakvrTl+ga9Ku6MmnHg+GVveVqajc5ao7uXLn6N8qa9XVXW/TLRL1GOzE+kaHafhrSOeMt78eH0AAJTcAyz0pNdyzGoVpLHV28fjZb3Ti+VW4715qCe3zut4IvfjDqv9xugchmKbXutx9BZp99afKL89uctvCLMP1qlStVnVqzlOpOTlKUnu5N822ytXnhbKOU5S37hBW0Hve9/Ds8TxB7bS2uLy6p2tpQq169WShTpU4uUpyfYklzbL04Z9H2+vfRZHWlaVjbv30bCjJeml8+XZBeS3fqZXjBy4HK2ljXu5bNKOfJeJT2k9MZ3VWSWPwOOrXlZ/CcVtCmvGUnyivWzSHDPgHhcL6LIaqnTzF/HaSt0n7mpvwafOp7dl5Fp43H6f0lgnRsqFliMbbx603uqcIrvlKT7X5t7lM8S+kHaWvpcdoqiruut4yv68fwUX4wj2y9b2XkywqcKe+R1NLTbHS4qrdS2pdnouv4v6Fw6n1Jp3SGJjdZm/tsfbQj1aUPxpbdkYQXN+pLkZy4l8fM1m1Vx+lqdTDWEk4yuG17pqLya5U/Zu/MqXP5rK5/JVMlmb+vfXdT4VSrLd7eCXYl5LkcAjnWcty3Gr1DlBXuMwpezH6/Pq8C7eGXH3L4j0WO1dTqZayW0Vdxf8JprxlvyqL17PzZovT2e0/q/DO6xN5bZKyqLq1I7b7br4M4PmvU0YHOy03n8xpzJwyWEyFexuY8uvTlspLffqyXZJcux8hCu47mZ0/lDWt8Qre1H6/r4/M0hxM4A4nLemyOkalPFXj3k7SS/g9R+Ee+n7N15IzjqfTub0zk547O46vZXEexVI+9mvGMlykvNNo0Twz6QGNyXo8drKlDG3b5K9pRfoJ/OXNwfnzXqLdzuFwGrMMrbKWdpk7GrHrU5PaSW65ShJc0/NMkdOFTfE2dXS7LU4OraS2ZdnqurwMCgvHiZ0f8AKYx1cho6pUyln8J2dRpXFNfJfJVF9T7tn2lI16NW3rToV6U6VWEnGcJxcZRa7U0+xleUHF7zlbuyr2k9mrHHk/geAAPJVNo9HX4mtP8AzK39PUMy8efje1F9JX2Immujr8TWn/mVv6eoZl48/G9qL6SvsRLNX/biddrP8Lt/7f8AqQgAFY5Evfocf/Eue+h0/tmmjNvQ6sryOWzl/K1rRtJ28KUa7g1CU1LdxUuxtLuNJF6h0D6NyfTVhDPf5gAEpugAAAZF6UGllgeIUsnbUlCzzEHcLZclVXKova9pfpGuisekxpxZ3hjd3dOn1rrFSV5TaXPqLlUXq6rcv0URVo7UTUa5afibSWOMd68OP0MeAAonzYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHNwGOrZjO2GJoJ+lvLmnQhsuxyklv+s4RZfRnxSynFvH1JxUqdhSq3ck14R6sX7JTizMVlpFi0o8/XhT7Wka/wAdaULDH29jaw6lC2pRo0o+EYpJL6ke8A2R9XSSWEAADJlvpbamlf6vtNNUKm9vjKXpKyT7a1RJ815Q6u3zmRzhnwb1PrD0V7cU3iMTJp+6biD69SPjTh2y9b2XmzQmnuFGBtdS32qM6o5rMXdzO461eG9Gh1nuowg+T6q2Sk9+xbJHda+1/pnRVp6XNX8fdElvStKO069T1R7l5vZeZXdLLcpnLT0iNWtO7vpYWeGerqy/Q8OH3D3TGiLRQw9ipXUo7Vbyt76tU8ef4q8o7IjnEzjTpnSTq2NjOOZy0d4uhQn+DpS+XPs9i3fjsUZxL406n1aqtlZTlhsTNOLoUJ/hKq+XPk36lsvHcrA8yrJboFS75QQpR5myjhLrx5L7v5Eo19r7U2trv0ubv26EXvStKO8KFP1R35vze78yLgFZtvezl6tWdWTnN5bAABGD9pwnVqRp04SnObUYxit22+xJE44bcLtUa3qwrWds7PGdbad9cRap7b8+ou2b7ezl4tGnuG3C3S+iKUK1pb+7cnt7++uIp1N+/qLsgvVz8WyWFKUjcafotxeYl0Y9r+y6/IpLhjwEzOa9FkdVzqYiwe0lbJfwmqvBp/5P27vyRpXTOBxWmsNRxGFtIWtnR+DCLbbb7W2+bb8WdkC3CnGHA7ix0y3sl/prf2viCGcRuGmmNcUHLJWvue/Udqd9bpRqrZclJ/jR8n7NiZg9NJrDLdajTrQcKiyjF/EzhLqfRUql1Oj90cSnur23W6iv9pHtg/PmvMr4+iLSaaaTT7UynuJnAjAagVW/056PCZJ8+pGP8Gqvzil7z1x5eTK06HXE5HUOTTjmdq89z+z9SQ9HX4mtP/Mrf09QzLx5+N7UX0lfYias4O4PI6b4cYnCZWlGleWqqxqRjNSXOtOSaa7mmn7SuszwQuNVcTczqDPX3uTE17hSo0bdp1qyUYrm+yC5eb8l2nqcHKCSLmo2Ve4sKFKEfaWM93s9ZnPTmBzGo8lDHYTHV765l+JSjuorxk+yK83sjRHDTo+4+w9FkNZ1o5C523VjSk1Rg/lS5Ob8lsvWXFpjTmE0zjVj8FjaFjbrnJU4++m/GUnzk/NtnamYUEt7JNP5O0aGJ1val9P18fkeq0t7e0tqdtaUKVvQpRUadKlBRjBLsSS5JHtAJzo0sAAAAAAA9V7bUbyzr2dzBTo16cqdSL/GjJbNfUz2gGGs7mfP3UWMq4XP5DEV93Usrmpbye227hJrf27bnALO6TmJWM4tXtaEOrTyFGldxW3LdrqS+uUJP2lYmtksNo+UXdHmK86fY2gADBXAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABf/Q2sFPK6iybi96VCjQi/nylJ/YRQBqDod2yhovM3my3q5H0W/wAynF/+slorM0bnQIbd/Duy/oXiAC8fRwcHO5fGYLF1spl72lZ2dFJ1KtR7JbvZLzbfYlzZzim+lzeyt+G1pawezuslTjLzjGE5ftUTzOWzFsq3tw7a3nVXUiG8S+kHeXfpMfoqjKzoPeMr+vBOrL5keyPre78kyir67ur67q3d7c1rm4qy61SrVm5zm/Ft82ekFCU3LifNLu+r3ctqrLPd1LwAAPJUAPO3o1rivChb0qlarUkowhCLlKTfYkl2su7hlwAymU9FkdY1KmMs3tKNnDb3RUXyn2QX1vyR6jByeEWrSyr3c9mlHPkipNLabzmqMnHHYLHV72u9ut1F72C8ZSfKK82zR/DLgFh8P6LI6sqU8tfLaStYp+5qT8++o/XsvJ9paWKxmm9GYB0bKhZYjG28etUm5KEV8qc3zb829yP6M4n4HV+s7rT+BjVuKNraSuJ3kl1ITanGPVjF82vfb7vbs7H2lmNKMelxOvstGtLOUfxElKb4Lq8F1/Fk4o06dGlGlSpxp04JRjGK2UUuxJdx5AFg6cAAAAAAAAAAAAAAAAAAAAAAAAAAAzd0ybBRyOncpGPOrRrW83t2dVxlFf8AXIz+ai6Ydt19EYi8250sl6Pfw69Ob/8AQZdKNZe2z5zyghsX8+/D+gABEaUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGs+iXDq8Lasttuvkq0vX7ymv6jJhrXomz6/CyceXvMjWj/ANMH/WTUOmdBya998GW4AC6fQAUJ0yam2C09R35Sua0vqjFf1l9lB9MmnvhNO1efvbmtH64x/sI63QZqdc9wqeHmjNQAKB81BPOGHCvUmupxubWEbLFKXVnfV1717PmoR7Zv6l4tEDNgdFz4obL6TX+2ySlBSlhm20Wyp3lzzdTglnyO94c8NNL6HoRnjrRXGQcdql9cJSqy8Uu6C8o7ee50fEzjVpnSTq2NhJZjLR3i6NCf4KlL5c/X3Ld+OxU/SG4k6oq6symk7S8dhi7WapTjbtxnX3im+vLt257dVbLbt3KWJZ1tn2Ym4vtcja5t7OOzjdn0X3ZKNea91NrW7dXN5CUqCl1qVpS3hQpeqPe/N7vzLD6H3xg5T+Kpf0tIpQuvoffGDlP4ql/S0iKm25ps0+l1Z1dQpzm8ts1MAC+fSgAAAAAAAAAAAAAAADg57M4vA42pksxf0LG0pr31SrLZepd7fglzZ69OZ7D6ixsMlhMjQvrWT269KXwX4SXbF+TSZjK4HjnIbWxnf2dZ2QAMnsAAAAAAqHpaQ6/C2lLbfqZKjL1e9qL+syYa06WU+rwshHl7/JUY8/mzf9RkspV+mfPuUvvvggACE0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANS9D656+gsra786WTlP2SpU1/6WZaNC9DW+SrakxknzlGhXgvU5xl+2JLReJo3XJ+ezfwXblfQ0YAC8fRgUx0vLN1uHVjdxW7t8lDreUZU5r9vVLnILx7xTy/CXPUIR3nRoK6j5eikpv8A6Ys8VFmLKOp0udtKkV2P1MUAA158tBsDoufFDZfSa/22Y/NgdFz4obL6TX+2ye36R0XJn3x/lfmjO3Hn43tRfSV9iJCCb8efje1F9JX2IkIIp9Jmnvfean5n5guvoffGDlP4ql/S0ilC6+h98YOU/iqX9LSM0umizo/v1P4mpgAbA+mgAAAAAAAAAArHiVxo0vpL0tlZ1FmctB9V29vP8HTfy6nNLbwW735NIxKSissguLmlbw26ssIsq5r0La3qXFzWp0aNOLlOpUkoxil2tt8kilOJPSAxGK9Lj9JUo5W8Xvfdc91bQfl3z9my82UXxA4jap1tXl91r+ULPrbwsqG8KMPDl+M/OW7IiVZ1290TkL/lLOeYWywu18fDsO41ZqfPaqyTyGeyVa9rdkFJ7QprwjFcor1I8dLakzel8nHI4LI1rK4XJuGzjNeEovlJeTR1IIMvOTmeeqbfObT2u3r+ZqPhnx+xGX9FjtXU6eJvXtFXcf8ANqj8Zb86ft3Xmi66FalcUYV6FWFWlOKlCcJKUZJ9jTXaj54lhcINca8weWo4vTEbjLUqsueMnGVSDW/Nx76fbzktl477FiFd8JHUadyjqJqncLa71x+XX++Js8HGxVa8uMbQr39krK6nBOrbqqqno5fk9ZJJ+s5JaOzTysgAAyUn0wbhQ0DirXfZ1cpGe3io0qi/9SMtGhemVfJ19N4yMlvGNevNb8+bhGP7JGeijWfts+c8oJ7V/NdmF9AACI0oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALV6LGVWP4rUbWUto5G0q23lukqi/o9vaVUdro7LzwGq8Xmobv3FdU60ku2UVJdZe1br2nqDxJMs2VbmLiFTsaN+A8aNSFalCrSmp05xUoyT5NPsZ5GxPq4PVeW9G8s61pcQU6NenKnUi++Mls19TPaAGs7mfP7UuKr4PUOQw1yn6WyuZ0JNrbfqya39T7fadeXR0stMvG61t9RUKTVvlaKVWSXJVqaUX9ceq/PZlLmunHZk0fKr62dtcTpPqf06voDYHRc+KGy+k1/tsx+bA6LnxQ2X0mv9tktv0jb8mffH+V+aM7cefje1F9JX2IkIJvx5+N7UX0lfYiQgin0mae995qfmfmC6+h98YOU/iqX9LSKULr6H3xg5T+Kpf0tIzS6aLOj+/U/iXvrziHgdE5XFWee9PRo5GNVxuYQ68aTg4fCS57PrdqT7OwkuJyWPy9hTv8Xe0L21qreFWjUU4v2rv8jPnTN/zrS/zLr9tIpjR+r9R6SvPdWAyte0be9Skn1qVT50Hyfr23XcWJVtmbT4HTXWvStL2dGpHMVjhxW5fM3oClOHXSAwWW9FY6qorD3r977pjvK2m/N9sPbuvNF0UK1K4owr0KsKtKcVKE4SUoyT7Gmu1E0ZqXA3treULqO1Slnz+R5gHTat1TgNKY/wB3Z/JUbKk91BSe86jXdGK5yfqR6bwWJzjCLlJ4SO5IfxB4kaV0TQl91b5Vb3beFlb7TrS9a32ivOTXluUVxJ4/5nL+ksNJ0qmHs22nczadzUXl2qn7N35opavWq3FadevVnVqzk5TnOTlKTfa232srTrpbonL3/KWEMwtll9r4eHaWRxJ4zap1d6WztqrxGKk2lb28n16kf9pPtfqWy8mVoAVpScnlnIXFzVuJ7dWWWAAYIAfsIynJRjFyk3sklu2yc8N+FmqdbVIV7S29xYxy2nfXCaht39Rds36uXi0aa4c8LNKaGoxuqFBXmSjHed/dJOUfHqLsgvVz27WyWFKUjcWGi3F57WNmPa/suvyKP4acBs9nXSv9TSqYXHPaXomv4TVXlF8oeuXPyNDYTC6Q4d6eqO1pWeJsqcd69zVklKo13zm+cn4L2JEG4l8d9P6edSw09Gnm8lFuMpRltb0n5zXw/VHl5ozbrHV+pNZZKNznMhWu5p7UaMVtTp790ILkvX2vvbJNqFPo72bh3dhpK2bdbdTt/X7LxNn6E1hjNZ2t7f4anXlYW1w7eFxVh1FXkopycYvn1V1lzez335ciRkY4V6cWlNA4nCyj1a9Kip3H+9n76f1NtepIk5ZjnG86m2dR0our0sbwAeNWpClSnVqSUYQi5Sk+xJdrMk5kXpT5VZDitWtYzbjjrSlb7d27TqP+k29hVR22ssvLP6syualv/DbupWin+LGUm4r2LZew6k103mTZ8ova3P3E6na2AAeSsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAbP6POoVqHhbjJVKnXubBOyr8+adPlD64OH6ywjK3RP1SsVrG407c1FG2y1NOl1nyVeCbW3zouS82omqS/SltRPpejXX4m0jLrW5+H6AAEhtSGcaNJfuy0BfYulFSvaX8Js/8AewT2X6Sco/pGIpxlCTjKLjJPZprZpn0QMo9J/QssDqf901hR2xuVm3V6q5Urjtkv0ucvX1itcQz7SOT5TWDnFXMFw3P4dTKcNgdFz4obL6TX+2zH5sDoufFDZfSa/wBtni36RreTPvj/ACvzRnbjz8b2ovpK+xEhBN+PPxvai+kr7ESEEU+kzT3vvNT8z8wXX0PvjByn8VS/paRShdfQ++MHKfxVL+lpGaXTRZ0f36n8Tuemb/nWl/mXX7aRns0J0zf860v8y6/bSM9nqt02Sa9/EKnh5IEs0BxD1Toq4Tw9+5WrlvOzr7zoT/R396/OOzImCNNrejWUqs6UlOm8PuNecOOOGl9TqFplZwwWSeyVO4qfgaj+TU5JeqWz8NyVa/0BpjXNmoZizXuiMNqN5Q2jWpru2ltzXPfZ7owyT7h3xa1boxU7W3uY3+Mjy9x3W8oxXyJfCh7OXkyeNfKxM6a15QxqR5q9jtJ9fqvT5HYcSuC+qNJupeWVOWZxabarW0G6lOP+0h2r1rdeorE2jw74t6S1kqdtSuvudk5LnZ3TUZN/Il2T9nPyRwOJXBbS+rFUvLGnHDZVptVremlTqS/2kFyfrWz9YlRTWYC50GnXhz1jLK7M+T+zMegmWsOGOs9M5anYXWHr3arz9Hb17OnKrTrSfYk0t0/JpMs7hp0e7iv6LI63ru3pdqx1Ce85fPmuUfVHd+aIlTk3jBpaGl3Vaq6cYPK453YKZ0hpTP6syKscDja13UTXpJpbU6SffOT5RXr9hpHhpwFwWC9Hf6nnTzWQXNUOr/Bqb9T5zfnLZfJ7yeZXLaL4badhCvOyxFlBfgrelFdeq/kxXOb8X9bM+8S+PWdzjq2GmI1MLj29vTp/wqovnLlD9Hn5k2zCn0t7N/G0sNKW1cPbn2fp92XjxD4oaT0LQdtcXEbq/hHanj7Vpzjt2KXdBevn4JmZuJHFfVOtZTt7i49wYuT5WNtJqLXy5ds/by8kQOpOdSpKpUlKc5NuUpPdtvvZ+Ec6spGov9buLv2V7Mexfd9fkCzOjhpN6m4iW91Xoqdhidrqv1lvFzT/AAcfbLnt4RZWtKnOrVhSpQlOpOSjGMVu5N9iS72bY4KaKjojRFvYVoQ+6Vx+Hvpx571H2R38IrZevd94ow2pHrQrF3VypNezHe/sibgAvH0YFe9IXUP7n+FmTlTqKNxfpWVHns26m/W29UFNlhGVelhqhZXWdvp63nvb4mn+F861RJv6o9Vevcjqy2Ymq1m6/DWkmuL3Lx/QpgAFA+aAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHvx15cY/IW9/Z1HSubarGrSmu2M4vdP60bt0BqS11bpHH5616qVzSXpaae/o6i5Th7JJ+tbPvMFlz9FvXMcHqOel8hWUbDKzToSk+VO422X8tJR9aiTUZ7MsM3/J+/8Aw1xzcn7MvPq9DVQALp9BB1WrsBj9T6dvMHk6fXtrqn1W12wl2xkvNPZr1HagNZPM4RnFxkspmCdc6YyWkNS3WDykNqtGW8KiW0a1N/BnHyf6ua7jUvRc+KGy+k1/ts7XjNw7s9fae9FB07fLWu8rO5a7++nL5L/U9n4p8To5469xHDWljMlbTtru2vbinVpTXOMlN/8AvfvK8KexPuOZ0/TJWOovHQaeH4rcZs48/G9qL6SvsRIQTfjz8b2ovpK+xEhBWn0mcje+81PzPzBb/RPyeOxvEO7jkL2hau6x8qFD0s1FVKjqU2opvvaT2XeVADEZbLyebS4dtWjVSzg2xxc4bY3iFj7enc3dayvbPr+5biC60Y9bbdShut0+qu9PzMq8QuHOqNEXD+61k52bltTvaHvqM/Dn+K/KWzJJwy416k0p6OxyUp5rEx2SpVp/haS+RN89vkvdeGxpfR2sdKa9xNR4y5o3UJwauLK4ivSQi+TU6b33T8eafiWcQq9zOrlTsNa9qL2Kn7+fhvMLA09xL6P2MyXpcho6tDGXb5uyqtu3m+/qvm4P616jOup9O5rTWSljs5jq9jcLsVSPvZrxjLskvNNkE6cocTnL3TLiyf8AqLd2rgdWADwa8JtNNNprsaLU4cccNU6YdO0ys5Z3GrZejuKn4amvk1Ob9kt1y5bFVgzGTi8ont7qtbT26UsM25pPinonUWJqZChmbey9DDr16F7UjSqUl4tN7NeabXNFYcSukLSp+lx+h7dVZ84vI3MPerzp032+uX8lmcgSuvJrBua/KO7q01COIvra4/oczNZXJZrIVMhlr64vbqp8KrWm5S9XPsXl2I4YBCaCUnJ5fEAFi8EeGt3rvOKtdwq0cFay3uq65Oo+1UoP8p8t33Lz2TzGLk8Ilt7epcVFTprLZNei5w7d7fQ1vl6H8FtpNY6nOPKpVXJ1fVHml8rn+KaXPTZWtvZWdGztKMKFvQgqdKnBbRhFLZJLw2PcX4QUFg+mafYwsqCpx49b7WAAey8dFr/UltpLSGQz911ZK2pN0qbf+UqPlCPtk16lu+4wnkr25yWRuche1ZVrm5qyq1qku2U5Pdv62W/0pNcrOakhpfHVnKwxU37ocX72rcdj9kFvH1uXkUwUq09qWEfPuUF/+JuObi/Zj59foAAQmgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB+wlKElKMnGSe6aezTPwAGyeAnEGGt9LKje1Y/dqwiqd3HfnVj2Rqpeff4Pw3RZBgnQ2p8lpDUtrnMXParRe06bfvasH8KEvJ/q5PuNtaG1Ri9Yabts3iqqlSqrapTb99Rqbe+hLzW/t5NcmXaNTaWHxPoWh6orulzdR+3H6rt9TvAATG+AAAMTcek1xe1Emmv4SvsRIObX4rcMsHr6yU7j+BZWlHq0L6nDeSX5M1+PHy33Xc1z3ydr7Q2o9E5D3Lm7KUaUpbUbqnvKjW+bLx8ns/Io1abi8nzrWNLr21WVVrMW28/HtIyACI0gORjb69xt7Svcfd17S5pPrU6tGbhOL8mjjgGU2nlGheGXSEnB08drmi6i7I5KhBbr/eU13ecf5PeXff2OltdadirinYZrGV03TqRamk+zeMlzjJdm62aMFkg0VrPUejr/3XgcjUt+s96lGXvqVX50Hyfr7V3NE8K7W6W86Ox5Qzgubultx+v6lq8S+j9kcd6XIaNrTyNqk5Ssq0l6eHzHttNeXJ+so67t7i0ualtd0KtvXpScalKrBxlBrtTT5pmtOGXHHTup3SsMz1MJlJe9Sqz/AVX8mb7G/yZepNks1/w70tre32y9io3SjtTvbfaFePh77b3y8pJo9OlGazAt19Ftr2HPWMl8Or1RhsFl8SuDWqNHqpe28PuxioJydzbwfWppf+JDm4+tbrxaK0K8ouLwzl7i2q289irHDAAMEAB5UaVStWhRo051Kk5KMIQjvKTfYkl2svrhLwEubudHL63hK2tuUqeNT2qVP9418FfJXPx2PUYOTwi3Z2Na8nsUlnv6l8SE8HOFeV13exu66qWeCpT2rXTWzqbdsKe/a/PsXr5PX2CxOPweJt8VirWna2dvDqU6cFyS8fNvtbfNs5Fla21laUrSzoUre3oxUKdKnFRjCK7EkuxHtLtOmoI+g6ZpdKwhu3yfF/vqAAJDaArfj3xBp6I0u6FnVX3ayEZU7SK7aS7JVX6t+Xi/UyWa51Ri9H6buc3laqjSpLanTT99Wqbe9hHze3s5t8kYl1zqfJav1LdZzKT3q1pbU6ae8aNNfBhHyX6+b7WQ1qmysLiaHXNUVpS5um/bl9F2+h0tSc6lSVSpKU5ybcpSe7bfez8AKR89AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABM+EvEHJaBz/uu3UrjH3G0by0ctlUiuyS8Jrns/Wu8hgMptPKJaNadGaqU3ho+gGms5jNR4W3zGHuoXNncR3hOPan3xa7muxpnYmI+E/ETLaBzPp7frXONrte67Ny2jUX5UfCa8fYzYWjNUYbV2DpZfCXSrUJ8pRfKdKXfGce5//wBW6LtOoprvPomlatTvoYe6a4r7r97jugASm3BxspYWWUsKthkbWjd2taPVqUqsFKMl6mckAw0msMoPiD0d7G59Je6MvfcVXm/cV1JypPyjPnKPqfW9aKG1ZpDUulbn0Gew9zZbvaNSUetTn82a3i/Yzep67ihRuaE6FxRp1qU1tOFSKlGS8Gn2kE6EXw3HP3nJy2r+1S9h93D5eh88gbO1PwY4fZyLf3GWMq91XHS9C1+js4f9JW2d6NNVSlPBanhJd1K9t2tv04N7/wAkhdCSOer8nLyl0UpLufrgz0C08lwD4i2rfoLKwv8A6PeRW/8A5nVOjr8JOI9GXVnpS9b+RKE/2SZG4SXUa2enXcONOXyZCCyOGfGLU+jfR2dao8tiY8vclxPnTX+zns3H1c15HU0+FnEOb2jpLJLnt76CX7WdhZcFuJV1JbaclRi/xq11Rjt7Otv+ozFTTyiW2o31Ge3RhJPuTNR8P+IWmNbW3Ww98o3Sj1qlnX2hXh59XfmvNbojPEvgnpnVfpL3HRjhcrJ9Z1qMN6VV/Lp7pe1bPx3Ku030fNcU7yjeVs3jsRUpyUoVKFWc61N+K6qS3/SNG6Sx+XxeFpWWazbzV1T5O6lbqjKS25JpN7vz7X3luOZrE0dpa87f0ubvaOO/970zF+teHmrNJZKFnlMVVnGrPq29e3TqU6z+S13/ACXs/Ilug+BGr8/OncZeCwNjLZuVwt60l5U090/ndX2muQeVbxyVqfJi2jUcpSbj2er/APCG8PuGmlNEwVTF2Ppr7q7TvblqdZ+Oz7Iryil57kyAJkktyOgpUadGOxTWF3AAGSQHW6mzmM05hLjMZe6jbWlvHrSk+1vujFd8n2JHH1nqjDaRwdXL5u6jQoQ5Qguc6su6EF3t/wD7ey5mPeLHETLa+zPp7jrW2NoN+5LNS3jTX5UvGb8fYiKpVUF3mo1XVqdjDC3zfBfd/vefnFriDktfZ73VcJ2+Pt242VonuqcX2yfjJ7Ld+zuIWAUm23lnzutWnWm6lR5bAAMEQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAO90Rq3OaOzMcpg7t0anJVaclvTrR336s496/Wu5o6IBPHA9wqSpyUoPDRs/hVxX0/rmhTtfSRx+ZUff2VWXw2lu3Tf467eXatnutuZYR88KVSpSqwq0pyp1ISUoyi9nFrsafcy7+GPH/J4r0OO1hTq5SzSUVeQ290U13dZdlTu5tp9+7Zap1+qR2Om8pIyxTutz7erx7P3wNQA6jSupsDqjHq+wOToX1H8bqPaUH4Si+cX5NI7csp5OqhOM4qUXlAAA9AAAAAAAAAAAAAAAAA6nU+pMHpnHu+zuTt7Gjz6vpJe+m/CMVzk/JJhvB5nOMFtSeEdsV7xW4rYDQtCVs5RyGZlH8HZUpfA5cnUf4q8u19y7yoOJvH/KZWNTHaPpVcVaPeMrye3uia+Ttypr635opGtVqVq061apOpUnJynOct5Sb7W2+1lapX6onK6lykjFOFrvfb1eHb++J3et9W5zWOZllM5dutU5qlSjyp0Y7/AAYR7l+t97Z0QBVbzxOOnUlUk5TeWwAAeAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADmYfK5PD3sb3FX9zY3MOypQqOEvVy7V5F0aI6RWYso07bVWNhk6S2TubfalW28XH4Mn6uqUWD1Gco8C3a39xaPNKWPL5G39I8T9EanjCOOzlvSuJf/TXT9DV38EpcpP5rZMj53Ej03rvWGnFGOG1Df21OPZSdT0lJfoS3j+onjcdqOktuVLW6vDxXo/U3cDKuE6ResLRRhk8di8lFdslCVGo/an1f+kmWL6SuEqJfdPTOQtn3+568K32uoSqtB9ZuKWv2NTjPHxT/wDC+AVRZ9IDh5XS9LXyVr/vbRv7LZ2FLjhwymt5ainT8pWNx/VBnrnI9pbjqdnLhVj80WOCuKnHDhlFe91FKfzbG4/rgdfd9IDh7QT9FWyd1/urTbf+U0Ocj2iWp2ceNWPzRa4KHyfSVwdNS+5mmsjcfk+6K0KO/r6vXIbnOkXrC7UoYvH4zGwfZLqSrVF7ZPq/9J5daC6ypV1+xp8J5+Cf/hqp8luyG6v4n6I0upwyOcoVbmP/ANNav01Xfwajyi/nNGRNSa81jqJSjmNRX9xSl20VU6lJ/oR2j+ojZFK47Eae55Ut7qEPF+i9S9dcdIrL3vXttJ46GMpc0rq5Sq1mvFR+BF+vrFL5rLZPNX87/L39xfXU/hVa9RyfqW/YvJcjhAglOUuJzd1f3F281ZZ7ur5AAHkqAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAmf3quIn5p5H+Sv7TKTfAkp0alXOxFv4LJDATP71XET808j/JX9o+9VxE/NPI/yV/aNmXYS/g7j+nL5MhgJn96riJ+aeR/kr+0feq4ifmnkf5K/tGzLsH4O4/py+TIYCWXHDXX9CLlPSGYaX/h20pv/AKdyOZHHZDG1lRyNjdWdV9kK9KVOX1NINNcSOdCpT6cWvijjAAwRAAAAAAAHZYrT+ey1vK4xWEyV/RjLqSqW1rOpFS2T2bimt9muXmcv9xesfzTz3/46r/dM4ZIqNSSyov5HRA739xesfzTz3/46r/dOlr0qtCtOhXpzpVacnCcJxalGSezTT7GjGGjEqc4dJYPAAA8AAAAEpxHDzW2WxtHI43Tl9c2lePWpVYRXVkt9t1z8jlfeq4ifmnkf5K/tM7L7CwrS4ayoP5MhgJZkOG2u7Cxr3t5pfIUrehB1KtRwTUYpbtvZ9iREw01xI6lKpSeJxa+KwAAYIwDkYuwvMnkKGPsLedxdXE1ClSh2zk+xIlf3quIn5p5H+Sv7TKTfAlp0KtRZhFv4LJDATP71XET808j/ACV/adLqfSuotM+5/u/ibnH+6et6H0yS6/V2623q6y+sOLXUep21aC2pQaXwZ0wB3mmdI6l1LSrVcDh7nIQoSUasqST6rfYnzMJZIoQlUezBZfcdGCZ/eq4ifmnkf5K/tH3quIn5p5H+Sv7TOzLsJ/wdx/Tl8mQwHtvbavZXlezuqUqVxQqSpVacu2EovZp+po9RgrNY3MAHf6N0ZqbWFa4o6cxU76VvFSrP0kKcYJvZbym0t3z5b78n4BLPA906c6ktmCy+xHQAsT7yPE/82f5/bf4g+8jxP/Nn+f23+IetiXYWf8Ou/wClL/8Al+hXYJrqDhVrzT+Ir5bMYSnZ2Vuk6lWd9bvbd7JJKo2229kkt2Qow01xIKtGpReKkWn3rAABgiAAAAAAAAAAAAAAAAAAAAAAAAAAAB9ET53H0RLNt1nYck/5v9v3AB67ivQtqfpLitTow3261SSit/Wy0dg3g9gOF91sV/8Ac7L/AM+P9p508njqs1CnkLScn2RjWi2/1jJ5249pyjjZPHWGUtJWmSsra8t5/CpV6SnF+xnJAMtJrDM78ZeBVtQsa+d0RRqQdJOdfG9ZyUo9rlSb57r8nv7vB52PoiYj444Ojp7ilmrC2SjbyrK4pRS2UVUip9VeScmvYVK9NR3o4nlDplO3xXpLCbw13kKABXOWB+04TqVI06cZTnJpRjFbtt9yPwtDo06V/dFxFoXteDlZ4hK7qcuTqJ/g4/yl1v0WZjHaeCe1t5XFaNKPFs0xwo0xDSGg8Zhdl7ohT9JdS8a0/fT+pvqrySJSAbFLCwfVaVONKChHgtwMndKjSjwuuIZ62pKNnmIucuquUa8dlP611ZebcjWJB+OGk/3X8PL+xo0fSX1uvdVnsufpIL4K+dHrR9qPFWO1E1+sWf4u1lFcVvXh6mJgHyezBQPmYAABtrgN8UOnfoz+3Im5COA3xQ6d+jP7cibmxh0UfVrH3an+VeQaTTTSafamZM6RPDJ6Uyr1BhaD+4d5U9/CK5WtV8+r5Qf4vh2eG+sziZnG2OYxVzi8lbwuLS5punVpy7JJ/sfn3GKkFNYINT0+F9R2HxXB9jPnyCZ8XdB3ug9TzsanXrY+vvUsrlrlOG/wX8qPY/Y+8hhQaaeGfNK1GdGbpzWGiX8F/jW019Pp/tNxGHeC/wAa2mvp9P8AabiLVv0WdpyW93n8fsgZ26Z/+qf/ABn/AGDRJnbpn/6p/wDGf9g91ugzYa//AA+p4f8AZGdzSvQ2/wBB6h+k0fsyM1Gleht/oPUP0mj9mRWo9NHI8nvf4ePky/AAXj6MYL4i/GDqP+Nbr+lkdEd7xF+MHUf8a3X9LI4+ktP5PVGftcJiKDq3VxLZb/BhHvnJ90Uubf8AWa1rLPk1WEp13GKy235nN4e6Py+ttRUsRiqe3ZK4ryXvKFPfnKX9S72bU0TpfE6Q0/QwuHoKnRprec2vf1p985Pvb/V2Lkjg8MtEYvQmnYYvH/ha02p3VzKO0q89u3yS7l3ettuUl2lT2Fl8TvtG0mNlDbnvm+Pd3L7g42VyFlisbcZHI3FO2tLeDqVas3soxR7Lu4oWlrVurqtToUKMHOpUqSUYwilu22+xGQ+O3FG51tlJYzGVZ0dP20/wUOx3Ml/8yS8PBd3b2vlmpUUEWdT1KnY0tp75Pgv31HX8Z+JV/r3MdSn17bC2037ktn2y7vST8ZNd3YlyXe3X4BRbcnlnzevXqXFR1Kjy2AAYIQAAAAAAAAAAAAAAAAAAAAAAAAAAAfRE+dx9ESzbdZ2HJP8Am/2/cFS9K74qX9Po/skW0QjjVpDIa30W8JjLi1t6/umnW69w5KG0d9171N78/AnmsxaR0eo05VLWpCCy2mYlBdf727WP/wB5wP8A5lX/AAzzodG3VbqpV87hYU++UHVk17HBftKfNT7D5/8A4Nff02e7op6uzb1bPS9zeV7rGVrWdSnSqTclQnHZ7x37E1umly3aZp0r3hFwrxHD+FW6hcTyGVr0/R1bqcOqox3TcYR57JtLfdtvZeosIt0ouMcM7nR7atb2qhWe/wAl2Axt0lrundcYcsqUlJUIUaLa8VSi39Te3sNMcVdf4rQeBnd3VSnWyNWLVnZ9b31WXi12qC737O3YxPk726yWRucje1XWubmrKtWm+2U5Pdv62RXEljZNNynvIOEbeL35y+795OOACqcYDY/Ry0r+5rhva1q8HG9yjV5X6y2cYyX4OPsjs/XJmZuD+lnrDX+OxE4Slaqfp7tpdlGHOS8t+Ud/lI3GkkkkkkuxIs28f/o67kvZ5lK4l1bl9wAVXxs4krRepNL2FKe0at17oyCSbatudNrbv360pLzposSkorLOrubmnbU+cqPdu+pagPyEozipRkpRa3TT3TR+nonMX9IDSa0pxGvIW9JwsL/+F2vLklJ++ivVLfl4bFfGvOk7pT90HD2eToQ3vMNJ3Mdlu5Umtqi+pKX6JkMoVY7Mj5rrVn+Fu5JcHvXj+oAPGMlJNrs32IzXwt6s6cqsY+zHGX1LPD54fyZtzgN8UOnfoz+3Im5COA3xQ6d+jP7cibmxh0UfULH3an+VeQAB6LRHOIukMZrbTFfDZGKi5Lr29dLeVCql72a/rXem0Ym1bgMlpjUF1hMtQdK5tp9V/kzj3Ti++LXNM34Vvx14cUdc4D3RZQhTzllBu1qPl6WPNulJ+D7n3PybIa1PaWVxOf1zSvxcOdpr219V2ehmXgv8a2mvp9P9puIxDwhoVrXi/p+2uaU6NalkoQqU5x2lCSezTXc0zbx5t+DIOSyxQn8fsDO3TP8A9U/+M/7Bokzt0z/9U/8AjP8AsHut0GX9f/h9Tw/7IzuaV6G3+g9Q/SaP2ZGajSvQ2/0HqH6TR+zIrUemjkeT3v8ADx8mX4AC8fRjDGqsXf5rivmsVi7adzeXOZuadKlDtk/Sy+pJc2+xJNmrODfDux0Dp9Un6OvlrlKV7dJdr7oR7+ov1vn5Ly4ecO8fpnOZjUVdQucvk7yvW9LtyoUp1HJQj57Nbvx5diJyQ06Wy8viaHStIVvN16vTbeO5eoPGrUhSpTq1ZxhThFylKT2UUu1t9yPIzL0j+Kk8lcXOjMDOpSs6FR08hX5xdacXs6a+Qn2+L8lz9zmoLLNhqF/TsqTqT8F2s6npBcVpaqvJ6ewFxKOCoT/C1Yvb3ZNd/wAxPsXe+fhtTwBQlJyeWfNru6qXVV1aj3v94AAMFYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH0RPncfREs23WdhyT/m/2/cAEd4j6op6M0feaiq2cryNs6adGNTqOXXnGHbs9tutv2FlvCydbUqRpwc5PCW9kiBn/wDfMWP5o3P/AD0f7g/fMWP5o3P/AD0f7hHz0O01f+O2H9T6P0NAHqu6U69tUo07irbTnFxVWkoucH4rrJrf1poqHTPSG0hk7yna5SzvsQ6j2VaptUpRfynHmvX1dvHYuKEozipRkpRa3TT3TR7jJS4F63u6F1FulLJmHi/wV1bTu7rUOPylxqeMvf1VW/zuK8l2TS+Ts/CJRrTTaaaa7Uz6ImbeljomzsalprHG0IUfdVb3PfQhHZSqNOUamy72lJN9/LzK9WiktpHK63ocKUHcUfFcfFFAAHa6PwdzqTVGOwVpuqt7XjS6yW/Uj2ylt4JJv2FZLJykIuclGPFmkOibpX7m6TudTXMGrjKz6lHrL4NCDa3Xzpb+yMS7DjYmwtsXi7TG2cOpbWlGFGlHwjFJL9SOSbGEdlYPqllbK1oRpLqX16w2km20ku1swzxb1M9W8QMpmITcraVX0Vr5UYe9j9aXW9bZqPpCan/czwzv5UZqN5kP4Fb81uuun137IKXPx2MYle4l/wDJy/Ki7zKNuure/sbJ6OWp/wB0fDKyp1qnWvMY/cVbftail6N/yHFb97TLIMh9GjWVtpbW1Wzyd5StcZlKXo6tWrJRhTqQ3cJSk+SXOUf0i+tQ8ZuHmGhLfOxyFVLlSsYOq5eqXwPrkSU6i2d7NrpWqUZ2cZVZpNbnl9n6FgVqdOtSnSqwjOnOLjKMlupJ9qZhXihpqWktdZTB7p0aNXrUGnvvSl76HtSaT80yx+IHSKzOQp1LPS9nHEUJLZ3FRqpcP1fiw/W/Booy+vbm9uKlxc1qlarVk5VKlSblKbfa23zbK9etB7kbuhySveVMoKjBwpp/7klhY/8Aynvl4YXeflerv72PZ3s87b/Je04pyrb/ACXtK0XlnUcvuT1noHJONpaLdzkW2+Mnh73+8LqNv8Bvih079Gf25E3IRwG+KHTv0Z/bkTc2sOijj7H3an+VeR0fEG6uLHQWob20rSo3Nvi7mrRqRfOE40pOMl5ppMjfBPiLba907vWcKWZs4xje0VyUvCpFfkvw7ny8G++4n/Fpqj+J7v8AoZmKNG6jyelNRW2cxNVQuKEucXzjUi/hQku9Nf8AvciqVNiSNRqmpysbum3vi1vXjx+JvkEf4fatxmtNM0M3jJNRn7ytRk/fUaiXvoP6+3vTTJATJ53o31OpGpFTg8plZa14a0rriVgNcYalCnc0L2m8lSWyVWG+3pV8pd/iufaudmgBRS4EdK3p0ZSlBY2nl/EGdumf/qn/AMZ/2DRJnbpn/wCqf/Gf9gjrdBmu1/8Ah9Tw/wCyM7mleht/oPUP0mj9mRmo0r0Nv9B6h+k0fsyK1Hpo5Hk97/Dx8mX4AC8fRgA+S3ZwMFmcVnbJ3uHv6F7bRqzpOpRlvHrxezX/AL7Vs1yaBhySeM7znmfOlFw49NSlrjC2/wCEppLJ0qcfhR7q3LvXZLy2fczQZ41qVOtRnRrQjUp1IuM4SW6knyaa8DzOKksMqX1nC8oulPw7mfPAFjcd+HtXQ+p3Vs6UnhL6TnZz5tUn2uk34ru8V6mVya+ScXhnzG4oTt6jpVFvQABghAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB9ET53H0RLNt1nYck/wCb/b9wVt0mPiazPz7f+ngWSdbqbBYrUmGrYfNWvuqxruLqUvSSh1urJSXOLT7Uu8sSWU0dRd0pVqE6ceLTXzRgAGzfvI8MPzZ/n9z/AIh7Lbgvwzt60a1PS9Nyj2Kpd15x9sZTaftRV/DyOL/yvd/8o/N+hjXHWV3kb+jYWFtVubqvNQpUqcetKcn3JG9dH2Nzi9JYfGXklK5tLChQrST3TnCnGMnv60z8wGmdO4Df7i4TH4+UltKdC3jCUl5yS3ftO2J6VLYOh0fSHYbUpSy38gVh0oIQlwgyEpJNwuKDj5P0iX7Gyzyg+l5qe3pYfH6SoVIyua9ZXdyk+cKcU1BP5zbf6Jmq8QZZ1erGnZVHLrWPnuM1GheiHpTrVshrC6gtoJ2dnuu97OpL6uqvbIz/AGNtXvb2hZ21OVSvXqRpUoRW7lKT2SXtZvHQun6GltI43AW/VatKChOcVsp1HznL2ybftK9COZZ7Dk+Tdnz1zzsuEPPqO7AOq1dm7bTmmMjnLtx9FZUJVdm9uvL8WPrlLZL1lxvB3k5KEXKXBGYulhqpZXXFPCW9XrW2HpdSST3Trz2c/qXVj5NMpb08/L6jlZ2/ucnlLi/vKrq3NzVlWrTf405Pdv8AWcA1NWo5SbO+5EckLC80tX2o0IznWbktpZajwil4LPie116nil7DwlOcu2TPEEeWd7acmtHs5bdC1hF9qis/PGQDzjTnLsiyXaH4car1fWh9yMTWqW8ns7qqnToR8ffvk9vBbvyMxhKXAp6tyx0jS8xq1VKf/CHtS+S4f3YXeRCEJTeyRyqcOpDq77ltcUeDF1obRVrnFkfd9WNdU76NOl1adJSXvXHfm11uTb23co8kVQS824Pefnzl9y2vtbmrSVPm6Kw1Hc2+xt/Pcty68m2uA3xQ6d+jP7cibkI4DfFDp36M/tyJubKHRRcsfdqf5V5Ed4n/ABaao/ie7/oZmEDd/E/4tNUfxPd/0MzCBWuOKOT5Vf71P4PzJnwi17faC1LG+pKVbH19qd9bJ/5SG/wl8qPavauxm0sJk7DNYm2yuMuYXNnc01UpVI9kk/2Pua7U00fPotno+cTpaPyqwmYrN4K8qc5SbfuSo/x18l/jL29z3xRqbO58CDQtW/DS5iq/YfDufoa4B+U5wqQjUpyjOEknGUXumn3o/S4d6DO3TP8A9U/+M/7Bokzt0z/9U/8AjP8AsEVboM0+v/w+p4f9kZ3NK9Db/QeofpNH7MjNRpXobf6D1D9Jo/ZkVqPTRyPJ73+Hj5MvwAF4+jGeukjxVq0Kl3ojT85057ejyV0uT2a50oetP3z9niV9wA4hPROp/ct/Uf3FyMowud3yoy7I1V6ux+Xjsjp+OPxtaj+mP9iIYUJVJbeT5teajXV862d8W0vgnw9T6IQlGcVKMlKLW6ae6aP0orovcRPunj1ozMXDd7aQ3sKk3zq0V209/GPd8n5pepdhJSWUd/ZXcLuiqsOv6PsOi15pfHaw0xdYLJR/B1o706iXvqNRfBnHzT+tbrvMQatwGR0xqG7weVpejubWfVbW/Vmu6UfGLWzRvwqzpDcOVrHT33UxlHfOY6DdJR7bil2um/PtcfPdd5HWp7SyuJqde0v8VT52mvbj9V2ehkEBpptNNNdqYKR8/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB9ET53Fiffu4n/nN/MLb/AAyalUUM5N9omqUbDb5xN7WOGOrPeu02aDGX37uJ/wCc38wtv8Mffu4n/nN/MLb/AAyb8RE33+aLT/jL5L1Nmgxl9+7if+c38wtv8Mffu4n/AJzfzC2/wx+IiP8ANFp/xl8l6mzT8nKMIuUpKMUt229kkYuuOM3EyvFxnqiqk1t7y1oQf1xgiMZ3VWpc6nHMZ7JX0H/8utcylD+TvsvqMO4XUiOpypoJexBv44Xqaj4o8a9O6Ytq1nha9HMZjZxjCjLrUaMvGc1ye35MefLZ7dplHO5bIZzLXGVyt1Uury4n16lSb5t+Hkl2JLkkcIFedRz4nM6hqla+l7e5LgkXD0VdK/dnXNTPXNNu1w8OvDdcpV57qC9i60vWomsDIPDHjFW0JplYWy05a3LlWlWrV53EoyqSfJckuWySXsJT++Xyv5q2X/NS/uk9KpCMcHQ6RqdjZ2yhKXtPe9z4/I0qZ76XuqepQxukLarzqP3ZdqMu5bxpxft6z28os6798vlfzVsv+al/dKd1zqO81bqq+z99FQq3U01Ti91TiklGK9SSX6xVrJxwjGsa5QrWzpUJZb47mtx0bhF9sU/Yfnoqf5KPMFTCNDb65qdtFRo3E4pdSnJeTPD0VP8AJR+qMV2RS9h5AYR5udY1C6WzXrzmu+Un5s1twb4f8OL3SWK1JZ4Oje17ihGVSV5N1/R1VynHqy97ykmt+r4MtqnCFOChTjGEYrZRitkkYm0DxS1VonE1cXhato7WrWdZxr0ev1ZNJPbmtlyRIv3wfEHxxX/Kv+8W4VoJcDo7LXbGhRjHZw8b8JcTVGpMRaZ7AX2Gvo9a3vKEqM+XNbrtXmnzXmjB+psPeaf1BfYW/h1bmzrSpT8Ht2SXk1s15Msj98HxB8cV/wAq/wC8QTXOqslrHN/djLUrSN26Uac5W9LqKaj2Nrd7vblv4JHirOM+Brdb1C0voxlTztLtXUa84DfFDp36M/tyJuYkwPFfX+CxFtiMVn/c9lbR6lGl7joS6q3b7ZQbfNvtZzvv3cT/AM5v5hbf4ZJGvFJI2dtyktaVGEHGWUkuC6l8TVfE/wCLTVH8T3f9DMwgTvKcYOIuTxl1jb7UXpbW7ozoV6fuK3j14Ti4yW6gmt03zXMghDVqKb3Gj1rUqV/UjKmmsLr/APWAARGlNEdGfiht6HRGoLntfVxlxUl9VBv7P8nwRok+d8JShJSjJxknumns0ywaPGribSpQpR1PJxhFRTlZ28nsvFunu35vmWKdfZWJHVaXyhjb0uauE3jg12d+WjZ5nbpn/wCqf/Gf9grv793E/wDOb+YW3+GR3Wmt9Uay9yfukyfu73H1/QfgKdPqdfq9b4EVvv1Y9vgZqVoyjhHvU9et7u1lRhGWXjjjqafaR00r0Nv9B6h+k0fsyM1Ex4e8R9R6Gtru3wbs1C7nGdX09HrveKaW3NeJDTkoyyzSaTdQtLqNWpwWfI3ADI/74PiD44r/AJV/3h++D4g+OK/5V/3izz8Drv8AMtl3/L9SM8cfja1H9Mf7EQw7DUuZvNQZ68zWQ9H7qu6npKvo49WO/ku468qN5eThbioqlac1wbb+pycTkLzFZO2yWPryoXdtUjVpVI9sZJ7r/wDhtzhVrSz1zpKhl6HVp3UPwV5QT/yVVLn+i+1PwfimYaO+0brHUuj7i4r6cyk7GdxBQrJU4VIzSe63jNNbrx235vxZJSqbD7jZaRqjsKj2t8HxX3RvMGMvv3cT/wA5v5hbf4Y+/dxP/Ob+YW3+GT/iInSf5otP+MvkvUl/Se4cfcm/lrPDW7Vjd1P4fTguVGs/x/KMn2+EvnIowneT4v8AEPJ4+vj8hnqdza3EHTq0p4+2cZxfan+DIIVqji3mJyWpVretXdS3TSfFPHHuw2AAeCgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/9k=" alt="Chip Mong Bank" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to Chip Mong Bank</h1>
          <p className="text-green-200 text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center space-x-2">
              <X size={16} /><span>{error}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
            <input type="text" required value={username} onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none transition" style={{"--tw-ring-color":"#0d6b40"}}
              onFocus={e => e.target.style.borderColor="#0d6b40"} onBlur={e => e.target.style.borderColor=""}
              placeholder="Enter username" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none pr-12 transition"
                onFocus={e => e.target.style.borderColor="#0d6b40"} onBlur={e => e.target.style.borderColor=""}
                placeholder="Enter password" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full text-white py-3 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-all hover:opacity-90 shadow-lg disabled:opacity-60"
            style={{background:"linear-gradient(135deg, #0d6b40, #1a8a52)"}}>
            {loading && <Loader2 size={18} className="animate-spin" />}
            <span>{loading ? "Signing in..." : "Sign In"}</span>
          </button>
          <p className="text-center text-xs text-slate-400">Contact your administrator for login credentials.</p>
        </form>
      </div>
    </div>
  );
}

// =============================================
// MAIN APP
// =============================================
export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [appUsers, setAppUsers] = useState([]);
  const [deals, setDeals] = useState([]);
  const [isAddDealModalOpen, setIsAddDealModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPriorityModalOpen, setIsPriorityModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState(null);
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
  const [teamStartDate, setTeamStartDate] = useState("");
  const [teamEndDate, setTeamEndDate] = useState("");
  const [teamLoanType, setTeamLoanType] = useState("all");
  const [teamLoanStatus, setTeamLoanStatus] = useState("all");
  const [teamCustStatus, setTeamCustStatus] = useState("all");
  const [editingDeal, setEditingDeal] = useState(null); // deal being edited
  const [topPerfFilter, setTopPerfFilter] = useState("Pending"); // Top Performance dropdown
  const [topPerfStartDate, setTopPerfStartDate] = useState("");
  const [topPerfEndDate, setTopPerfEndDate] = useState("");
  const [topPerfLoanType, setTopPerfLoanType] = useState("all");
  const [isEditDealModalOpen, setIsEditDealModalOpen] = useState(false);
  const [editDealForm, setEditDealForm] = useState({});

  const [newDeal, setNewDeal] = useState({
    client: "", businessName: "", phone: "", branch: loggedInUser?.branch || "NRD",
    amount: "", approvedAmount: "", repUsername: "", status: "Pending",
    loanType: "Personal Loan", rate: "", tenor: "", incomeStatus: "Pending", incomeType: "Salary", incomeAmount: "", customerStatus: "Medium",
  });

  const isAdmin = loggedInUser?.role === "admin";
  const rmList = appUsers.filter(u => u.role === "rm");

  const showToast = (msg) => { setSuccessToast(msg); setTimeout(() => setSuccessToast(null), 3500); };

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

    return () => { unsubDeals(); unsubUsers(); };
  }, [firebaseUser]);

  // Visible deals based on role
  const visibleDeals = useMemo(() => {
    if (!loggedInUser) return [];
    // STRICT: RM can ONLY see their own customers. Admin sees all.
    if (loggedInUser.role !== "admin") {
      return deals.filter(d => d.rmUsername === loggedInUser.username);
    }
    return deals;
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
      date: new Date().toISOString().split("T")[0], createdAt: Date.now(),
    };
    try {
      await addDoc(collection(db, "artifacts", appId, "public", "data", "deals"), deal);
      setNewDeal({ client: "", businessName: "", phone: "", branch: loggedInUser?.branch || "NRD", amount: "", approvedAmount: "", repUsername: "", status: "Pending", loanType: "Personal Loan", rate: "", tenor: "", incomeStatus: "Pending", incomeType: "Salary", incomeAmount: "", customerStatus: "Medium" });
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
      const updateData = { name: newUser.name, role: newUser.role, branch: newUser.branch };
      // 🔐 Only hash+save password if it was changed
      if (newUser.password !== "••••••") {
        updateData.password = await hashPassword(newUser.password);
        updateData.passwordHashed = true;
      }
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "appUsers", editingUser.id), updateData);
      showToast(`✅ User "${newUser.name}" updated!`);
    } else {
      // 🔐 Always hash new user passwords
      const hashedPw = await hashPassword(newUser.password);
      await addDoc(usersRef, { ...newUser, password: hashedPw, passwordHashed: true, createdAt: Date.now() });
      showToast(`✅ User "${newUser.name}" created! Username: ${newUser.username}`);
    }
    setNewUser({ username: "", password: "", name: "", role: "rm", branch: "NRD" });
    setEditingUser(null); setIsUserModalOpen(false);
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Delete "${userName}"?`)) return;
    await deleteDoc(doc(db, "artifacts", appId, "public", "data", "appUsers", userId));
    showToast(`🗑️ "${userName}" deleted.`);
  };

  const handleEditUser = (u) => {
    setEditingUser(u);
    setNewUser({ username: u.username, password: "••••••", name: u.name, role: u.role, branch: u.branch || "NRD" });
    setIsUserModalOpen(true);
  };

  const handleLogout = () => { setLoggedInUser(null); setActiveTab("dashboard"); };

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
        { id: "deals", icon: <Briefcase size={19} />, label: "Performance Sale Team" },
        ...(isAdmin ? [{ id: "users", icon: <Shield size={19} />, label: "User Created", badge: "Admin" }] : []),
      ].map(item => (
        <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id
            ? "bg-gradient-to-r from-indigo-500/30 to-blue-500/20 text-white border border-indigo-500/30 shadow-sm"
            : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
          {item.icon}<span className="font-medium flex-1 text-left">{item.label}</span>
          {item.badge && <span className="text-xs bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">{item.badge}</span>}
        </button>
      ))}
      <div className="pt-4 border-t border-white/10 mt-4">
        <div className="px-4 py-3 bg-white/5 rounded-xl mb-2 border border-white/10">
          <p className="text-sm font-bold text-white">{loggedInUser.name}</p>
          <p className="text-xs text-slate-400">{isAdmin ? "🔑 Administrator" : "👤 RM"} • {loggedInUser.branch}</p>
        </div>
        <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-green-900/30 border border-green-700/30 flex items-center gap-2">
          <Shield size={13} className="text-green-400 flex-shrink-0" />
          <span className="text-xs text-green-400 font-medium">Secured & Encrypted</span>
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
      <aside className="hidden md:flex flex-col w-64 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 h-screen sticky top-0 shadow-2xl">
        <div className="p-6 border-b border-white/10 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-lg flex-shrink-0">
            <img src="data:image/png;base64,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" alt="CMB" className="w-full h-full object-cover" />
          </div>
          <span className="text-lg font-bold text-white">Chip Mong Bank</span>
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
        <div className="flex-1 p-6 overflow-y-auto">

          {/* DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 max-w-7xl mx-auto">

              {/* Banking Hero Banner */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 via-green-800 to-teal-800 p-7 shadow-2xl">
                {/* Animated background circles */}
                <div className="absolute -top-10 -right-10 w-48 h-48 bg-emerald-400/10 rounded-full blur-2xl animate-pulse"></div>
                <div className="absolute -bottom-10 -left-5 w-40 h-40 bg-teal-400/10 rounded-full blur-2xl animate-pulse" style={{animationDelay:"1s"}}></div>
                <div className="absolute top-5 right-40 w-24 h-24 bg-green-300/10 rounded-full blur-xl animate-pulse" style={{animationDelay:"0.5s"}}></div>
                <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-400/30 flex items-center justify-center">
                        <Sparkles size={16} className="text-emerald-300" />
                      </div>
                      <span className="text-emerald-300 text-xs font-semibold tracking-widest uppercase">AI Analysis</span>
                    </div>
                    <h3 className="text-xl font-bold text-white">Customer Priority Analysis</h3>
                    <p className="text-emerald-100/70 mt-1 text-sm">Instantly see which pending customers to follow up with first.</p>
                  </div>
                  <button onClick={handleAnalyzePipeline} disabled={isAiLoading}
                    className="whitespace-nowrap flex items-center space-x-2 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 disabled:opacity-50 text-emerald-900 px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/30 transition-all hover:shadow-emerald-400/50 hover:scale-105">
                    {isAiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    <span>View Customer Priority ✨</span>
                  </button>
                </div>
              </div>

              {/* Active filter indicator */}
              {(topPerfStartDate || topPerfEndDate || topPerfLoanType !== "all") && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500 font-medium">🔍 Filters active:</span>
                  {topPerfLoanType !== "all" && <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">{topPerfLoanType}</span>}
                  {topPerfStartDate && <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">From: {topPerfStartDate}</span>}
                  {topPerfEndDate && <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">To: {topPerfEndDate}</span>}
                  <button onClick={() => { setTopPerfStartDate(""); setTopPerfEndDate(""); setTopPerfLoanType("all"); }} className="text-xs text-red-400 hover:text-red-600 font-medium">✕ Clear all</button>
                </div>
              )}

              {/* KPI Cards - Banking Style */}
              {(() => {
                // Apply same date + product filters as Top Performance to KPI cards
                let dashDeals = visibleDeals;
                if (topPerfLoanType !== "all") dashDeals = dashDeals.filter(d => d.loanType === topPerfLoanType);
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
                    <div className="flex flex-wrap gap-3 justify-between items-center mb-3">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center">
                        <span className="w-1 h-5 bg-gradient-to-b from-indigo-500 to-blue-500 rounded-full mr-3 inline-block"></span>
                        🏆 Top Performance
                      </h3>
                    </div>
                    {/* Filter row */}
                    <div className="flex flex-wrap gap-2 items-center">
                      {/* Status */}
                      <select value={topPerfFilter} onChange={e => setTopPerfFilter(e.target.value)}
                        className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:border-indigo-400 text-slate-700 font-medium shadow-sm flex-1 min-w-[130px]">
                        <option value="Pending">⏳ Pipeline</option>
                        <option value="Pre-Approval">✅ Pre-Approval</option>
                        <option value="Processing">🔄 Processing</option>
                        <option value="LOS">📁 LOS</option>
                        <option value="LOO">⭐ LOO</option>
                        <option value="Won">🏦 Completed Drawdown</option>
                        <option value="Rejected">❌ Rejected</option>
                        <option value="all">🌐 Total (All Status)</option>
                      </select>
                      {/* Product Type */}
                      <select value={topPerfLoanType} onChange={e => setTopPerfLoanType(e.target.value)}
                        className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:border-indigo-400 text-slate-700 font-medium shadow-sm flex-1 min-w-[130px]">
                        <option value="all">📦 All Products</option>
                        {LOAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {/* Start Date */}
                      <div className="flex items-center gap-1 flex-1 min-w-[120px]">
                        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">From</span>
                        <input type="date" value={topPerfStartDate} onChange={e => setTopPerfStartDate(e.target.value)}
                          className="text-xs border border-slate-200 bg-white rounded-xl px-2 py-2 outline-none focus:border-indigo-400 text-slate-700 w-full shadow-sm" />
                      </div>
                      {/* End Date */}
                      <div className="flex items-center gap-1 flex-1 min-w-[120px]">
                        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">To</span>
                        <input type="date" value={topPerfEndDate} onChange={e => setTopPerfEndDate(e.target.value)}
                          className="text-xs border border-slate-200 bg-white rounded-xl px-2 py-2 outline-none focus:border-indigo-400 text-slate-700 w-full shadow-sm" />
                      </div>
                      {/* Reset */}
                      {(topPerfStartDate || topPerfEndDate || topPerfLoanType !== "all") && (
                        <button onClick={() => { setTopPerfStartDate(""); setTopPerfEndDate(""); setTopPerfLoanType("all"); }}
                          className="text-xs text-slate-400 hover:text-red-500 px-2 py-2 rounded-xl hover:bg-red-50 transition-colors whitespace-nowrap">✕ Reset</button>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const perfList = (isAdmin ? rmList : [loggedInUser])
                      .map(rm => {
                        let rmDeals = topPerfFilter === "all"
                          ? deals.filter(d => d.rmUsername === rm.username)
                          : deals.filter(d => d.rmUsername === rm.username && d.status === topPerfFilter);
                        // Apply loan type filter
                        if (topPerfLoanType !== "all") rmDeals = rmDeals.filter(d => d.loanType === topPerfLoanType);
                        // Apply date range filter
                        if (topPerfStartDate) rmDeals = rmDeals.filter(d => d.date >= topPerfStartDate);
                        if (topPerfEndDate) rmDeals = rmDeals.filter(d => d.date <= topPerfEndDate);
                        const total = rmDeals.reduce((s, d) => s + d.amount, 0);
                        return { ...rm, filteredCount: rmDeals.length, filteredTotal: total };
                      })
                      .sort((a, b) => b.filteredTotal - a.filteredTotal || b.filteredCount - a.filteredCount);
                    const maxVal = perfList[0]?.filteredTotal || 1;
                    const filterLabel = { all:"Total (All Status)", Won:"Completed Drawdown", Pending:"Pipeline", "Pre-Approval":"Pre-Approval", Processing:"Processing", LOS:"LOS", LOO:"LOO", Rejected:"Rejected" }[topPerfFilter] || topPerfFilter;
                    return perfList.map((rm, i) => (
                      <div key={rm.id || rm.username}
                        onClick={() => setStatusFilterModal({ title: `${rm.name} — ${filterLabel}`, status: topPerfFilter === "all" ? "all_rm" : topPerfFilter, rmUsername: rm.username })}
                        className="flex items-center px-5 py-4 border-b border-slate-50 last:border-0 hover:bg-indigo-50/40 transition-colors cursor-pointer">
                        <span className={`font-extrabold w-7 text-base flex-shrink-0 ${i === 0 ? "text-amber-400" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-400" : "text-slate-300"}`}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}`}
                        </span>
                        <div className="w-10 h-10 rounded-full overflow-hidden ml-1 flex-shrink-0">
                          {rm.photoUrl
                            ? <img src={rm.photoUrl} alt={rm.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600">{rm.name?.charAt(0)}</div>}
                        </div>
                        <div className="ml-3 flex-1 min-w-0">
                          <p className="font-bold text-slate-800">{rm.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${i === 0 ? "bg-amber-400" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-400" : "bg-indigo-300"}`}
                                style={{ width: `${maxVal > 0 ? Math.round((rm.filteredTotal/maxVal)*100) : 0}%`, transition:"width 0.8s ease" }}></div>
                            </div>
                            <span className="text-xs text-slate-400 flex-shrink-0">{rm.filteredCount} {filterLabel}</span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-bold text-emerald-600 text-sm">{formatCurrency(rm.filteredTotal)}</p>
                          <p className="text-xs text-slate-400">{rm.branch}</p>
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
                          let d = selectedTeamRm ? visibleDeals.filter(x => x.rmUsername === selectedTeamRm) : visibleDeals;
                          if (teamLoanType !== "all") d = d.filter(x => x.loanType === teamLoanType);
                          if (teamLoanStatus !== "all") d = d.filter(x => x.status === teamLoanStatus);
                          if (teamCustStatus !== "all") d = d.filter(x => x.customerStatus === teamCustStatus);
                          if (teamStartDate) d = d.filter(x => x.date >= teamStartDate);
                          if (teamEndDate) d = d.filter(x => x.date <= teamEndDate);
                          return d.length;
                        })()} records
                      </span>
                    </div>
                    <button onClick={() => setIsAddDealModalOpen(true)}
                      className="flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-all hover:shadow-md">
                      <Plus size={16} /><span>Create New Customer</span>
                    </button>
                  </div>
                  {/* 5 Filters row */}
                  <div className="flex flex-wrap gap-2 items-center">
                    {/* Product Types */}
                    <select value={teamLoanType} onChange={e => setTeamLoanType(e.target.value)}
                      className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:border-indigo-400 text-slate-700 font-medium shadow-sm flex-1 min-w-[120px]">
                      <option value="all">📦 All Products</option>
                      {LOAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {/* Loan Status */}
                    <select value={teamLoanStatus} onChange={e => setTeamLoanStatus(e.target.value)}
                      className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:border-indigo-400 text-slate-700 font-medium shadow-sm flex-1 min-w-[120px]">
                      <option value="all">📋 All Status</option>
                      <option value="Pending">⏳ Pipeline</option>
                      <option value="Pre-Approval">✅ Pre-Approval</option>
                      <option value="Processing">🔄 Processing</option>
                      <option value="LOS">📁 LOS</option>
                      <option value="LOO">⭐ LOO</option>
                      <option value="Won">🏦 Completed</option>
                      <option value="Rejected">❌ Rejected</option>
                    </select>
                    {/* Customer Status */}
                    <select value={teamCustStatus} onChange={e => setTeamCustStatus(e.target.value)}
                      className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-2 outline-none focus:border-indigo-400 text-slate-700 font-medium shadow-sm flex-1 min-w-[110px]">
                      <option value="all">🎯 All Priority</option>
                      <option value="High">🔴 High</option>
                      <option value="Medium">🟡 Medium</option>
                      <option value="Low">🟢 Low</option>
                    </select>
                    {/* Start Date */}
                    <div className="flex items-center gap-1 flex-1 min-w-[110px]">
                      <span className="text-xs text-slate-400 font-medium whitespace-nowrap">From</span>
                      <input type="date" value={teamStartDate} onChange={e => setTeamStartDate(e.target.value)}
                        className="text-xs border border-slate-200 bg-white rounded-xl px-2 py-2 outline-none focus:border-indigo-400 text-slate-700 w-full shadow-sm" />
                    </div>
                    {/* End Date */}
                    <div className="flex items-center gap-1 flex-1 min-w-[110px]">
                      <span className="text-xs text-slate-400 font-medium whitespace-nowrap">To</span>
                      <input type="date" value={teamEndDate} onChange={e => setTeamEndDate(e.target.value)}
                        className="text-xs border border-slate-200 bg-white rounded-xl px-2 py-2 outline-none focus:border-indigo-400 text-slate-700 w-full shadow-sm" />
                    </div>
                    {/* Reset */}
                    {(teamLoanType !== "all" || teamLoanStatus !== "all" || teamCustStatus !== "all" || teamStartDate || teamEndDate) && (
                      <button onClick={() => { setTeamLoanType("all"); setTeamLoanStatus("all"); setTeamCustStatus("all"); setTeamStartDate(""); setTeamEndDate(""); }}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-2 rounded-xl hover:bg-red-50 transition-colors whitespace-nowrap font-medium">✕ Reset</button>
                    )}
                  </div>
                </div>

                {/* RM mini cards row */}
                {isAdmin && (
                  <div className="flex gap-3 p-4 overflow-x-auto border-b border-slate-100 bg-slate-50/50">
                    <button onClick={() => setSelectedTeamRm(null)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold flex-shrink-0 transition-all ${!selectedTeamRm ? "bg-indigo-600 text-white border-indigo-600 shadow" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"}`}>
                      <Users size={14} /> All
                    </button>
                    {rmList.map(rm => {
                      const cnt = visibleDeals.filter(d => d.rmUsername === rm.username).length;
                      const sel = selectedTeamRm === rm.username;
                      return (
                        <button key={rm.username} onClick={() => setSelectedTeamRm(sel ? null : rm.username)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold flex-shrink-0 transition-all ${sel ? "bg-indigo-600 text-white border-indigo-600 shadow" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"}`}>
                          {rm.photoUrl
                            ? <img src={rm.photoUrl} alt={rm.name} className="w-6 h-6 rounded-full object-cover" />
                            : <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${sel ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-600"}`}>{rm.name?.charAt(0)}</div>}
                          {rm.name}
                          <span className={`px-1.5 py-0.5 rounded-full text-xs ${sel ? "bg-white/20" : "bg-indigo-50 text-indigo-600"}`}>{cnt}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Customer table */}
                <div className="overflow-x-auto">
                  {(() => {
                    let teamDeals = selectedTeamRm ? visibleDeals.filter(d => d.rmUsername === selectedTeamRm) : visibleDeals;
                    if (teamLoanType !== "all") teamDeals = teamDeals.filter(d => d.loanType === teamLoanType);
                    if (teamLoanStatus !== "all") teamDeals = teamDeals.filter(d => d.status === teamLoanStatus);
                    if (teamCustStatus !== "all") teamDeals = teamDeals.filter(d => d.customerStatus === teamCustStatus);
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
                                  <button onClick={() => openEditDeal(deal)}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-medium transition-colors">
                                    <Edit2 size={12} /><span>Edit</span>
                                  </button>
                                  {isAdmin && (
                                    <button onClick={() => handleDeleteDeal(deal.id, deal.client)}
                                      className="flex items-center space-x-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-xs font-medium transition-colors">
                                      <Trash2 size={12} /><span>Del</span>
                                    </button>
                                  )}
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

          {/* DEALS */}
          {activeTab === "deals" && (
            <div className="max-w-7xl mx-auto bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-lg font-bold">{isAdmin ? "All Customers" : "My Customers"}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                    <th className="p-4">Customer</th><th className="p-4">Branch</th><th className="p-4">Phone</th>
                    <th className="p-4">Loan Type</th><th className="p-4">Amount</th><th className="p-4">Rate/Tenor</th>
                    <th className="p-4">Income</th><th className="p-4">RM</th><th className="p-4">Date</th><th className="p-4">Status</th><th className="p-4">Action</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDeals.map(deal => (
                      <tr key={deal.id} className="hover:bg-slate-50/50">
                        <td className="p-4"><p className="font-semibold text-slate-800">{deal.client}</p>{deal.businessName && <p className="text-xs text-slate-400">{deal.businessName}</p>}</td>
                        <td className="p-4"><span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg">{deal.branch || "—"}</span></td>
                        <td className="p-4"><span className="text-sm text-slate-600">{deal.phone || "—"}</span></td>
                        <td className="p-4"><span className="text-sm text-slate-600">{deal.loanType || "—"}</span></td>
                        <td className="p-4"><span className="font-bold text-slate-700">{formatCurrency(deal.amount)}</span></td>
                        <td className="p-4"><span className="text-sm text-slate-600">{deal.rate ? `${deal.rate}%` : "—"}{deal.tenor ? ` / ${deal.tenor}mo` : ""}</span></td>
                        <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${deal.incomeStatus === "Verified" ? "bg-emerald-50 text-emerald-700" : deal.incomeStatus === "Unverified" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{deal.incomeStatus || "—"}</span></td>
                        <td className="p-4"><span className="text-sm font-medium text-slate-700">{deal.rmName || "—"}</span></td>
                        <td className="p-4"><span className="text-xs text-slate-500">{new Date(deal.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(deal.status)}`}>{deal.status === "Won" ? "Completed" : deal.status}</span>
                            {deal.status === "Pending" && (
                              <button onClick={() => handleDraftEmail(deal)} className="text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg">
                                <Sparkles size={11} className="inline mr-1" />Draft
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEditDeal(deal)}
                              className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-medium transition-colors">
                              <Edit2 size={12} /><span>Edit</span>
                            </button>
                            {isAdmin && (
                              <button onClick={() => handleDeleteDeal(deal.id, deal.client)}
                                className="flex items-center space-x-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-xs font-medium transition-colors">
                                <Trash2 size={12} /><span>Del</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                      <p className="text-sm text-slate-500 mt-0.5">{appUsers.filter(u => u.role === "admin").length} admin accounts</p>
                    </div>
                    <button onClick={() => { setEditingUser(null); setNewUser({ username: "", password: "", name: "", role: "rm", branch: "NRD" }); setIsUserModalOpen(true); }}
                      className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
                      <UserPlus size={18} /><span>Add New User</span>
                    </button>
                  </div>
                  {/* Stats row */}
                  <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                    <div className="p-4 text-center">
                      <p className="text-2xl font-bold text-slate-800">{appUsers.filter(u => u.role === "admin").length}</p>
                      <p className="text-xs text-slate-500 mt-1">Total Admins</p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-2xl font-bold text-purple-600">{appUsers.filter(u => u.role === "admin").length}</p>
                      <p className="text-xs text-slate-500 mt-1">Admins</p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-2xl font-bold text-indigo-600">{appUsers.filter(u => u.role === "rm").length}</p>
                      <p className="text-xs text-slate-500 mt-1">RMs</p>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {appUsers.filter(u => u.role === "admin").map(u => (
                      <div key={u.id} className="flex items-center p-5 hover:bg-slate-50 transition-colors">
                        <div className="relative flex-shrink-0">
                          {u.photoUrl ? (
                            <img src={u.photoUrl} alt={u.name} className="w-11 h-11 rounded-full object-cover border-2 border-indigo-100" />
                          ) : (
                            <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg ${u.role === "admin" ? "bg-purple-100 text-purple-600" : "bg-indigo-100 text-indigo-600"}`}>
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
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-indigo-100 text-indigo-700"}`}>
                              {u.role === "admin" ? "🔑 Admin" : "👤 RM"}
                            </span>
                            {u.username === loggedInUser.username && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">You</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">@{u.username} • Branch: <span className="font-semibold text-slate-700">{u.branch}</span></p>
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
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-indigo-100 text-indigo-700"}`}>
                            {u.role === "admin" ? "🔑 Admin" : "👤 RM"}
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
                <button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-sm font-semibold shadow-md transition-all">
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
                    <option value="admin">🔑 Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
                  <select value={newUser.branch} onChange={e => setNewUser({ ...newUser, branch: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500">
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
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
                  // KPI card click — already pre-filtered by date/product
                  const src = statusFilterModal.filteredDeals;
                  filtered = statusFilterModal.status === "all" ? src : src.filter(d => d.status === statusFilterModal.status);
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
              <button onClick={() => copyToClipboard(emailDraft)} disabled={isAiLoading} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm rounded-xl">
                <Copy size={16} /><span>Copy</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
