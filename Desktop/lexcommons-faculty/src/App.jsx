// LexCommons - teaching.lexcommons.org
import { useState, useEffect, useRef } from "react";
const API_URL = "https://api.lexcommons.org";
function getUser() { try { return JSON.parse(localStorage.getItem("lc_user")); } catch { return null; } }
function setUser(u) { localStorage.setItem("lc_user", JSON.stringify(u)); }
function clearUser() { localStorage.removeItem("lc_user"); }
async function api(path, opts = {}) {
  const u = getUser();
  const res = await fetch(API_URL + path, { ...opts, headers: { "Content-Type": "application/json", ...(u?.token ? { Authorization: "Bearer " + u.token } : {}), ...opts.headers } });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}
const C = { navy: "#0B1D3A", gold: "#C9A84C", linen: "#F4F0E8", surface: "#FFFFFF", border: "#E2DDD4", text: "#1A1A2E", muted: "#6B7B8D", green: "#2D8B55", red: "#B91C1C", blue: "#1A66CC" };
const Card = ({ children, style = {}, as: Tag = "div", onClick, ...props }) => <Tag style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: 20, ...style }} onClick={onClick} {...(Tag === "button" ? { type: "button" } : {})} {...props}>{children}</Tag>;
const Badge = ({ label, color = C.navy }) => <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, background: color + "18", color, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{label}</span>;
const Btn = ({ children, onClick, variant = "primary", disabled, style = {} }) => {
  const styles = { primary: { background: C.navy, color: "#fff", border: "none" }, secondary: { background: "transparent", color: C.navy, border: "1px solid " + C.navy }, gold: { background: C.gold, color: C.navy, border: "none" }, danger: { background: C.red, color: "#fff", border: "none" }, ghost: { background: "transparent", color: C.muted, border: "1px solid " + C.border } };
  return <button onClick={onClick} disabled={disabled} style={{ padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, ...styles[variant], ...style }}>{children}</button>;
};
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("sso_token");
    if (token) {
      try {
        const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const p = JSON.parse(atob(b64));
        const ROLE_MAP = { 4: "administrator", 3: "manager", 2: "faculty", 1: "user" };
        const u = { id: p.id, email: p.email, name: ((p.firstName || "") + " " + (p.lastName || "")).trim() || p.email, role: ROLE_MAP[p.role] || "user", token, lastLogin: new Date().toISOString().slice(0, 10), site: "all", active: true };
        setUser(u); window.history.replaceState({}, "", window.location.pathname); onLogin(u);
      } catch { setError("SSO login failed."); }
    }
  }, []);
  const handleLogin = async () => {
    setLoading(true); setError("");
    try {
      const data = await fetch(API_URL + "/api/auth/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }).then(r => r.json());
      if (data.error) throw new Error(data.error);
      const u = { id: data.user.id, email: data.user.email, name: data.user.name || data.user.email, role: data.user.roleStr || "user", token: data.token, lastLogin: new Date().toISOString().slice(0, 10), site: "all", active: true };
      setUser(u); onLogin(u);
    } catch (e) { setError(e.message || "Invalid credentials."); }
    finally { setLoading(false); }
  };
  return (
    <div style={{ minHeight: "100vh", background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 52, height: 52, background: C.gold, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 24, color: C.navy, fontWeight: 700 }}>P</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>LexCommons</div>
          <div style={{ fontSize: 13, color: "#8DA4BE", marginTop: 4 }}>Professor Portal</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 28 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 20 }}>Faculty Sign In</div>
          {error && <div style={{ background: "#fef2f2", color: C.red, borderRadius: 6, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@school.edu" onKeyDown={e => e.key === "Enter" && handleLogin()} style={{ width: "100%", padding: "9px 12px", background: C.linen, border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</label>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" onKeyDown={e => e.key === "Enter" && handleLogin()} style={{ width: "100%", padding: "9px 12px", background: C.linen, border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <Btn onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: "10px", fontSize: 14 }}>{loading ? "Signing in..." : "Sign In"}</Btn>
          <div style={{ marginTop: 16, borderTop: "1px solid " + C.border, paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <a href="https://api.lexcommons.org/auth/google?origin=https://teaching.lexcommons.org" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "9px 12px", border: "1px solid " + C.border, borderRadius: 6, textDecoration: "none", color: C.text, fontSize: 13, fontWeight: 500 }}>
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </a>
            <a href="https://api.lexcommons.org/auth/microsoft?origin=https://teaching.lexcommons.org" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "9px 12px", border: "1px solid " + C.border, borderRadius: 6, textDecoration: "none", color: C.text, fontSize: 13, fontWeight: 500 }}>
              <svg width="16" height="16" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#00a4ef"/><rect x="1" y="11" width="9" height="9" fill="#7fba00"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
              Continue with Microsoft
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

const ALL_PRODUCTS = [
  { id: "lawschool", label: "Law School",  icon: "📚", url: "https://lawschoolcommons.com" },
  { id: "cite",      label: "Cite",        icon: "§",  url: "https://cite.lexcommons.org" },
  { id: "classroom", label: "Classroom",   icon: "🎓", url: "https://classroom.lexcommons.org" },
  { id: "faculty",   label: "Faculty",     icon: "👩‍🏫", url: "https://faculty.lexcommons.org" },
  { id: "admin",     label: "Admin",       icon: "⚙️", url: "https://admin.lexcommons.org" },
  { id: "lawfirm",   label: "Law Firm",    icon: "🏛️", url: "https://lawfirmcommons.com", planned: true },
];

function ssoUrl(url) {
  try { const u = JSON.parse(localStorage.getItem("lc_user")); if (u && u.token) return url + "?sso_token=" + u.token; } catch(e) {}
  return url;
}

function AppSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} title="LexCommons apps"
        style={{ width: 28, height: 28, borderRadius: 6, background: open ? "rgba(201,168,76,0.2)" : "transparent",
          border: "1px solid transparent", cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", color: "#C9A84C" }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="4" height="4" rx="1"/><rect x="6" y="1" width="4" height="4" rx="1"/>
          <rect x="11" y="1" width="4" height="4" rx="1"/><rect x="1" y="6" width="4" height="4" rx="1"/>
          <rect x="6" y="6" width="4" height="4" rx="1"/><rect x="11" y="6" width="4" height="4" rx="1"/>
          <rect x="1" y="11" width="4" height="4" rx="1"/><rect x="6" y="11" width="4" height="4" rx="1"/>
          <rect x="11" y="11" width="4" height="4" rx="1"/>
        </svg>
      </button>
      {open && (
        <div style={{ position: "absolute", top: 36, left: 0, width: 260, background: "#111827",
          border: "1px solid #1e2432", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          padding: "12px", zIndex: 9999 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7B8D", textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: 10, paddingLeft: 4 }}>LexCommons Suite</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {ALL_PRODUCTS.map(p => (
              <a key={p.id} href={p.planned ? undefined : ssoUrl(p.url)}
                target={p.planned ? undefined : "_blank"} rel="noopener noreferrer"
                onClick={p.planned ? e => e.preventDefault() : undefined}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  padding: "12px 8px", borderRadius: 8, textDecoration: "none",
                  background: p.planned ? "transparent" : "rgba(255,255,255,0.04)",
                  border: "1px solid " + (p.planned ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)"),
                  cursor: p.planned ? "default" : "pointer", opacity: p.planned ? 0.35 : 1 }}>
                <span style={{ fontSize: 22 }}>{p.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: p.planned ? "#6B7B8D" : "#C4D0DE",
                  textAlign: "center", lineHeight: 1.3 }}>{p.label}</span>
                {p.planned && <span style={{ fontSize: 9, color: "#C9A84C", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.06em" }}>Soon</span>}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar({ user, page, setPage, onLogout, dyslexia, setDyslexia }) {
  const NAV = [{ id: "dashboard", label: "Dashboard", icon: "@" }, { id: "courses", label: "My Courses", icon: "#" }, { id: "students", label: "Students", icon: "*" }, { id: "grades", label: "Gradebook", icon: "%" }, { id: "program-outcomes", label: "Outcomes", icon: "🎯" }, { id: "faculty-service", label: "Service", icon: "🤝" }, { id: "scholarship", label: "Scholarship", icon: "📚" }, { id: "alerts", label: "Academic Alerts", icon: "⚠️" }, { id: "question-bank", label: "Question Bank", icon: "Q" }];
  return (
    <div style={{ width: 210, background: C.navy, display: "flex", flexDirection: "column", flexShrink: 0, minHeight: "100vh" }}>
      <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, background: C.gold, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.navy, fontWeight: 700 }}>P</div>
          <div><div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>LexCommons</div><div style={{ fontSize: 10, color: "#6B8BA4" }}>Professor Portal</div></div></div><AppSwitcher /></div>
      </div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.gold, color: C.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{(user.name || "?")[0].toUpperCase()}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{user.name}</div>
        <div style={{ fontSize: 11, color: "#6B8BA4" }}>{user.role}</div>
      </div>
      <nav style={{ flex: 1, padding: "10px 8px" }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: page === n.id ? "rgba(201,168,76,0.15)" : "transparent", border: "none", borderRadius: 6, color: page === n.id ? C.gold : "#8DA4BE", fontSize: 13, fontWeight: page === n.id ? 600 : 400, cursor: "pointer", textAlign: "left", marginBottom: 2 }}>
            <span>{n.icon}</span>{n.label}
          </button>
        ))}
      </nav>
      <div style={{ padding: "8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <a href="https://classroom.lexcommons.org" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", color: "#6B8BA4", fontSize: 12, textDecoration: "none", borderRadius: 6 }}>↗ Student View</a>
        <button onClick={() => setDyslexia(d => !d)} title="Toggle OpenDyslexic font" style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: dyslexia ? "rgba(201,168,76,0.15)" : "transparent", border: "none", borderRadius: 6, color: dyslexia ? "#c9a84c" : "#6B8BA4", fontSize: 12, cursor: "pointer", textAlign: "left" }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Aa</span> {dyslexia ? "Dyslexic Font On" : "Dyslexic Font"}
        </button>
        <button onClick={onLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "transparent", border: "none", borderRadius: 6, color: "#6B8BA4", fontSize: 13, cursor: "pointer", textAlign: "left" }}>Sign Out</button>
      </div>
    </div>
  );
}

// ── CoursePageEditor ────────────────────────────────────────────────────────
const BLOCK_TYPES = [
  { type: "heading", label: "Heading", icon: "H" },
  { type: "text",    label: "Text",    icon: "¶" },
  { type: "image",   label: "Image",   icon: "🖼" },
  { type: "video",   label: "Video",   icon: "▶" },
  { type: "callout", label: "Callout", icon: "💡" },
  { type: "divider", label: "Divider", icon: "—" },
];
function makeBlock(type) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const defaults = {
    heading: { text: "New Heading", level: 2 },
    text:    { text: "Start writing..." },
    image:   { url: "", caption: "", width: "100%" },
    video:   { url: "", caption: "" },
    callout: { text: "Add a note here.", icon: "💡" },
    divider: {},
  };
  return { id, type, ...defaults[type] };
}

// ─── Block Editor System (transplanted from ops, adapted for courses) ─────────

// ─── Block Editor System ──────────────────────────────────────────────────────

const BLOCK_LIBRARY = [
  { category: "Structure", blocks: [
    { type: "hero",    label: "Hero",      icon: "▬", desc: "Full-width banner with headline & CTA" },
    { type: "columns", label: "Columns",   icon: "⊞", desc: "Two-column side-by-side layout" },
    { type: "cta",     label: "CTA Band",  icon: "⬛", desc: "Call-to-action with button" },
    { type: "divider", label: "Divider",   icon: "─", desc: "Section separator" },
    { type: "spacer",  label: "Spacer",    icon: "↕", desc: "Blank vertical space" },
  ]},
  { category: "Content", blocks: [
    { type: "heading", label: "Heading",   icon: "H", desc: "Section heading H2–H4" },
    { type: "text",    label: "Text",      icon: "¶", desc: "Paragraph of body text" },
    { type: "list",    label: "List",      icon: "≡", desc: "Bullet or numbered list" },
    { type: "quote",   label: "Quote",     icon: "❝", desc: "Blockquote with attribution" },
    { type: "image",   label: "Image",     icon: "🖼", desc: "Image with caption" },
  ]},
  { category: "Media", blocks: [
    { type: "video",   label: "Video",     icon: "▶", desc: "Upload or embed a video" },
    { type: "audio",   label: "Audio",     icon: "♪", desc: "Upload or embed audio" },
    { type: "record",  label: "Record",    icon: "⏺", desc: "Record audio or video in browser" },
  ]},
  { category: "Advanced", blocks: [
    { type: "cards",   label: "Card Grid", icon: "⊟", desc: "2–3 cards in a row" },
    { type: "emoji",   label: "Emoji",     icon: "😊", desc: "Large emoji or decorative character" },
    { type: "gif",     label: "GIF",       icon: "🎞", desc: "Search and embed a GIF via Giphy" },
    { type: "html",    label: "Raw HTML",  icon: "<>", desc: "Embed custom HTML" },
  ]},
];


// ── Course / Page Templates ───────────────────────────────────────────────────
const COURSE_TEMPLATES = [
  {
    id: "syllabus",
    label: "Course Syllabus",
    icon: "📋",
    desc: "Full syllabus with policies, schedule, grading",
    blocks: [
      { type: "heading", data: { text: "Course Syllabus", level: "h2", align: "left", color: "#1A1A2E" } },
      { type: "columns", data: { leftHeading: "Instructor", leftContent: "Professor Name\nOffice: Room 000\nOffice Hours: TBD", rightHeading: "Course Details", rightContent: "Credits: 3\nMeeting Time: TBD\nRoom: TBD", gap: "24px" } },
      { type: "divider", data: { label: "Course Description", color: "#D4CFC0", thickness: 1 } },
      { type: "text",    data: { content: "This course covers foundational principles of law, with emphasis on critical reading, analysis, and argumentation. Students will develop research and writing skills through case study, simulation, and seminar discussion.", align: "left" } },
      { type: "heading", data: { text: "Learning Objectives", level: "h3", align: "left", color: "#1A1A2E" } },
      { type: "list",    data: { items: ["Analyze judicial opinions and statutory text", "Apply legal reasoning to novel fact patterns", "Draft clear and persuasive legal memoranda", "Conduct effective primary and secondary research"], style: "bullet" } },
      { type: "heading", data: { text: "Grading", level: "h3", align: "left", color: "#1A1A2E" } },
      { type: "list",    data: { items: ["Participation: 15%", "Research Memo #1: 20%", "Research Memo #2: 25%", "Midterm: 15%", "Final Exam: 25%"], style: "bullet" } },
      { type: "heading", data: { text: "Course Policies", level: "h3", align: "left", color: "#1A1A2E" } },
      { type: "text",    data: { content: "Attendance is mandatory. More than two unexcused absences will result in a grade reduction. All assignments must be submitted via the course portal by 11:59 PM on the due date. Late submissions will be penalized 10% per day.", align: "left" } },
    ]
  },
  {
    id: "case_study",
    label: "Case Study",
    icon: "⚖️",
    desc: "Structured case brief with facts, issues, holding",
    blocks: [
      { type: "heading", data: { text: "Case Name v. Case Name", level: "h2", align: "left", color: "#1A1A2E" } },
      { type: "text",    data: { content: "Court Name | Year | Citation", align: "left" } },
      { type: "divider", data: { label: "", color: "#D4CFC0", thickness: 1 } },
      { type: "heading", data: { text: "Facts", level: "h3", align: "left", color: "#1A1A2E" } },
      { type: "text",    data: { content: "Summarize the key facts of the case here. Focus on the facts that are legally relevant to the court's decision.", align: "left" } },
      { type: "heading", data: { text: "Issue(s)", level: "h3", align: "left", color: "#1A1A2E" } },
      { type: "text",    data: { content: "State the legal question(s) the court was asked to decide. Use the format: Whether [party] [did something] that [legal standard].", align: "left" } },
      { type: "heading", data: { text: "Holding", level: "h3", align: "left", color: "#1A1A2E" } },
      { type: "text",    data: { content: "State the court's answer to the issue(s) and the resulting judgment.", align: "left" } },
      { type: "heading", data: { text: "Reasoning", level: "h3", align: "left", color: "#1A1A2E" } },
      { type: "text",    data: { content: "Explain how the court analyzed the facts under the applicable legal rules. Note any precedents cited or distinguished.", align: "left" } },
      { type: "quote",   data: { text: "Insert a key quotation from the opinion here.", attribution: "Court, Year" } },
      { type: "heading", data: { text: "Discussion Questions", level: "h3", align: "left", color: "#1A1A2E" } },
      { type: "list",    data: { items: ["How does this case relate to the rule from prior sessions?", "What would the outcome have been under the dissent's approach?", "How would you argue this case if representing the other party?"], style: "numbered" } },
    ]
  },
  {
    id: "reading_guide",
    label: "Reading Guide",
    icon: "📖",
    desc: "Pre-class reading guide with key concepts",
    blocks: [
      { type: "heading", data: { text: "Reading Guide", level: "h2", align: "left", color: "#1A1A2E" } },
      { type: "columns", data: { leftHeading: "Session", leftContent: "Session number and date", rightHeading: "Required Reading", rightContent: "Casebook pp. 000–000 | Statute §000", gap: "24px" } },
      { type: "divider", data: { label: "Focus Areas", color: "#D4CFC0", thickness: 1 } },
      { type: "heading", data: { text: "Key Concepts to Identify", level: "h3", align: "left", color: "#1A1A2E" } },
      { type: "list",    data: { items: ["Term or doctrine to look for", "Second concept from reading", "Third concept from reading"], style: "bullet" } },
      { type: "heading", data: { text: "Guiding Questions", level: "h3", align: "left", color: "#1A1A2E" } },
      { type: "list",    data: { items: ["What rule emerges from today's cases?", "How do the cases relate to each other?", "What policy arguments support or undermine the rule?"], style: "numbered" } },
      { type: "heading", data: { text: "Vocabulary", level: "h3", align: "left", color: "#1A1A2E" } },
      { type: "text",    data: { content: "Add any legal terms students should define before class. Consider using bold or a list format for clarity.", align: "left" } },
    ]
  },
  {
    id: "assignment",
    label: "Assignment Page",
    icon: "📝",
    desc: "Assignment with instructions, rubric, submission",
    blocks: [
      { type: "heading", data: { text: "Assignment Title", level: "h2", align: "left", color: "#1A1A2E" } },
      { type: "columns", data: { leftHeading: "Due Date", leftContent: "Date at 11:59 PM", rightHeading: "Submission", rightContent: "Upload PDF via course portal", gap: "24px" } },
      { type: "divider", data: { label: "", color: "#D4CFC0", thickness: 1 } },
      { type: "heading", data: { text: "Overview", level: "h3", align: "left", color: "#1A1A2E" } },
      { type: "text",    data: { content: "Describe the assignment purpose and what students are expected to produce.", align: "left" } },
      { type: "heading", data: { text: "Instructions", level: "h3", align: "left", color: "#1A1A2E" } },
      { type: "list",    data: { items: ["Step one of the assignment", "Step two of the assignment", "Formatting: double-spaced, 12pt, Times New Roman", "Length: 3–5 pages"], style: "numbered" } },
      { type: "heading", data: { text: "Grading Rubric", level: "h3", align: "left", color: "#1A1A2E" } },
      { type: "list",    data: { items: ["Issue Spotting (25%): Identifies all relevant legal issues", "Analysis (40%): Applies rule to facts with precision", "Writing (20%): Clear, concise, well-organized", "Citation (15%): Proper Bluebook format throughout"], style: "bullet" } },
      { type: "quote",   data: { text: "A well-written memo makes the analysis look inevitable.", attribution: "Bryan Garner" } },
    ]
  },
  {
    id: "announcement",
    label: "Announcement",
    icon: "📢",
    desc: "Course announcement or news post",
    blocks: [
      { type: "hero",    data: { headline: "Course Announcement", subline: "Posted by Professor — Date", btnText: "", btnLink: "", bgColor: "#0B1D3A", textColor: "#ffffff", align: "left" } },
      { type: "text",    data: { content: "Write the body of your announcement here. Keep it concise and action-oriented. Students should immediately know what (if anything) is required of them.", align: "left" } },
      { type: "divider", data: { label: "", color: "#D4CFC0", thickness: 1 } },
      { type: "text",    data: { content: "If there are follow-up items or links, add them below.", align: "left" } },
    ]
  },
  {
    id: "exam_prep",
    label: "Exam Prep Sheet",
    icon: "🎓",
    desc: "Review sheet with topics, tips, and practice Qs",
    blocks: [
      { type: "heading", data: { text: "Exam Preparation Guide", level: "h2", align: "left", color: "#1A1A2E" } },
      { type: "columns", data: { leftHeading: "Exam Format", leftContent: "3 hours | Open outline | 2 essays + 10 MC", rightHeading: "Topics Covered", rightContent: "Weeks 1–12 with emphasis on Weeks 8–12", gap: "24px" } },
      { type: "divider", data: { label: "Core Topics", color: "#D4CFC0", thickness: 1 } },
      { type: "list",    data: { items: ["Topic 1 with key subtopics", "Topic 2 with key subtopics", "Topic 3 with key subtopics", "Topic 4 with key subtopics"], style: "bullet" } },
      { type: "heading", data: { text: "Issue-Spotting Tips", level: "h3", align: "left", color: "#1A1A2E" } },
      { type: "text",    data: { content: "When you see [trigger fact], think [doctrine]. Always state the rule before applying it. Flag and analyze both sides when the outcome is genuinely close.", align: "left" } },
      { type: "heading", data: { text: "Practice Questions", level: "h3", align: "left", color: "#1A1A2E" } },
      { type: "list",    data: { items: ["Practice question 1", "Practice question 2", "Practice question 3"], style: "numbered" } },
      { type: "quote",   data: { text: "Know the rules cold. The exam tests your judgment in applying them.", attribution: "Study tip" } },
    ]
  },
  {
    id: "resource_page",
    label: "Resource Library",
    icon: "📚",
    desc: "Curated links and resources for a topic area",
    blocks: [
      { type: "heading", data: { text: "Resource Library", level: "h2", align: "left", color: "#1A1A2E" } },
      { type: "text",    data: { content: "A curated collection of research tools, databases, and reference materials for this course.", align: "left" } },
      { type: "divider", data: { label: "Primary Sources", color: "#D4CFC0", thickness: 1 } },
      { type: "cards",   data: { cards: [{ title: "Westlaw", body: "Full-text case law, statutes, and secondary sources.", link: "https://westlaw.com", icon: "⚖️" }, { title: "LexisNexis", body: "Comprehensive legal research platform.", link: "https://lexisnexis.com", icon: "📘" }, { title: "Google Scholar", body: "Free access to published opinions.", link: "https://scholar.google.com", icon: "🔍" }] } },
      { type: "divider", data: { label: "Writing Resources", color: "#D4CFC0", thickness: 1 } },
      { type: "list",    data: { items: ["Bluebook Online — citation format reference", "ALWD Guide to Legal Citation", "The Redbook: A Manual on Legal Style — Bryan Garner", "Plain English for Lawyers — Richard Wydick"], style: "bullet" } },
    ]
  },
  {
    id: "blank",
    label: "Blank Page",
    icon: "⬜",
    desc: "Start with a single heading — build from scratch",
    blocks: [
      { type: "heading", data: { text: "Page Title", level: "h2", align: "left", color: "#1A1A2E" } },
      { type: "text",    data: { content: "Start writing here.", align: "left" } },
    ]
  },
];

const BLOCK_DEFAULTS = {
  hero:    { headline: "Welcome to LexCommons", subline: "Legal education tools for students and faculty.", btnText: "Get Started", btnLink: "#", bgColor: "#0B1D3A", textColor: "#ffffff", align: "center" },
  text:    { content: "Enter your paragraph text here. This block supports rich content for body copy, descriptions, and explanatory text.", align: "left" },
  heading: { text: "Section Heading", level: "h2", align: "left", color: "#1A1A2E" },
  image:   { src: "", alt: "Image description", caption: "", align: "center", maxWidth: "100%" },
  cta:     { heading: "Ready to get started?", body: "Join thousands of law students using LexCommons.", btnText: "Sign Up Free", btnLink: "#", bgColor: "#0B1D3A", btnColor: "#C9A84C" },
  columns: { leftHeading: "Column One", leftContent: "Content for the left column goes here.", rightHeading: "Column Two", rightContent: "Content for the right column goes here.", gap: "24px" },
  divider: { label: "", color: "#D4CFC0", thickness: 1 },
  spacer:  { height: 40 },
  list:    { items: ["First item", "Second item", "Third item"], style: "bullet" },
  quote:   { text: "The law is reason, free from passion.", attribution: "Aristotle" },
  cards:   { cards: [
    { title: "Legal Research", body: "Access curated research tools and databases.", link: "#", icon: "⚖️" },
    { title: "Citation Tools", body: "Generate and verify legal citations instantly.", link: "#", icon: "📋" },
    { title: "Case Study Hub", body: "Browse annotated cases across all practice areas.", link: "#", icon: "📚" },
  ]},
  html:    { code: '<div class="custom">\n  <!-- Your HTML here -->\n</div>' },
  emoji:   { emoji: "⚖️", size: 64, align: "center", caption: "" },
  gif:     { url: "", alt: "", caption: "", align: "center", query: "" },
  video:   { src: "", poster: "", caption: "", align: "center", controls: true, autoplay: false, loop: false },
  audio:   { src: "", caption: "", controls: true, autoplay: false, loop: false },
  record:  { src: "", mediaType: "audio", caption: "", duration: 0 },
};

// ── Shared field renderer ─────────────────────────────────────────────────────

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: 12, color: "#A8BDD4", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</label>
    {children}
  </div>
);

const Inp = ({ value, onChange, mono, placeholder, type = "text" }) => (
  <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ width: "100%", padding: "7px 9px", background: "#F0EAD6", border: "1px solid #1e2432", borderRadius: 4, color: mono ? "#7ab8f5" : "#1A1A2E", fontSize: 14, fontFamily: mono ? "monospace" : "inherit", boxSizing: "border-box" }} />
);

const Sel = ({ value, onChange, options }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{ width: "100%", padding: "7px 9px", background: "#F0EAD6", border: "1px solid #1e2432", borderRadius: 4, color: "#1A1A2E", fontSize: 14 }}>
    {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
  </select>
);

const ColorSwatch = ({ value, onChange, label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <input type="color" value={value} onChange={e => onChange(e.target.value)}
      style={{ width: 32, height: 28, padding: 2, background: "#F0EAD6", border: "1px solid #1e2432", borderRadius: 4, cursor: "pointer" }} />
    <span style={{ fontSize: 13, color: "#6B7B8D", fontFamily: "monospace" }}>{value}</span>
  </div>
);

const Ta = ({ value, onChange, rows = 4, placeholder }) => (
  <textarea value={value ?? ""} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
    style={{ width: "100%", padding: "7px 9px", background: "#F0EAD6", border: "1px solid #1e2432", borderRadius: 4, color: "#1A1A2E", fontSize: 14, resize: "vertical", lineHeight: 1.6, boxSizing: "border-box", fontFamily: "inherit" }} />
);

// ── Block canvas previews ─────────────────────────────────────────────────────

function BlockPreview({ block }) {
  const d = block.data;
  const s = { fontFamily: "Source Sans 3, Segoe UI, sans-serif" };

  if (block.type === "hero") return (
    <div style={{ ...s, background: d.bgColor || "#0B1D3A", padding: "40px 32px", textAlign: d.align || "center", borderRadius: 4 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: d.textColor || "#fff", marginBottom: 10, lineHeight: 1.2 }}>{d.headline}</div>
      <div style={{ fontSize: 15, color: (d.textColor || "#fff") + "bb", marginBottom: 20, maxWidth: 520, margin: "0 auto 20px" }}>{d.subline}</div>
      {d.btnText && <span style={{ display: "inline-block", padding: "9px 22px", background: "#C9A84C", color: "#fff", borderRadius: 5, fontSize: 15, fontWeight: 600 }}>{d.btnText}</span>}
    </div>
  );

  if (block.type === "text") return (
    <div style={{ ...s, padding: "12px 0", fontSize: 15, color: "#3D3D56", lineHeight: 1.75, textAlign: d.align || "left" }}>{d.content}</div>
  );

  if (block.type === "heading") {
    const sizes = { h2: 22, h3: 17, h4: 14 };
    return <div style={{ ...s, fontSize: sizes[d.level] || 22, fontWeight: 700, color: d.color || "#1A1A2E", textAlign: d.align || "left", padding: "8px 0", borderBottom: d.level === "h2" ? "1px solid #1e2432" : "none", marginBottom: 4 }}>{d.text}</div>;
  }

  if (block.type === "image") return (
    <div style={{ ...s, textAlign: d.align || "center", padding: "8px 0" }}>
      {d.src ? <img src={d.src} alt={d.alt} style={{ maxWidth: d.maxWidth || "100%", borderRadius: 4, display: "inline-block" }} />
        : <div style={{ background: "#F0EAD6", border: "2px dashed #3a4356", borderRadius: 6, padding: "40px 20px", color: "#6B7B8D", fontSize: 15, textAlign: "center" }}>🖼 No image URL set — enter one in the properties panel</div>}
      {d.caption && <div style={{ fontSize: 13, color: "#6B7B8D", marginTop: 6, fontStyle: "italic" }}>{d.caption}</div>}
    </div>
  );

  if (block.type === "cta") return (
    <div style={{ ...s, background: d.bgColor || "#0B1D3A", padding: "28px 32px", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1A2E", marginBottom: 4 }}>{d.heading}</div>
        <div style={{ fontSize: 15, color: "#6B7B8D" }}>{d.body}</div>
      </div>
      <span style={{ padding: "9px 20px", background: d.btnColor || "#C9A84C", color: "#fff", borderRadius: 5, fontSize: 15, fontWeight: 600, whiteSpace: "nowrap" }}>{d.btnText}</span>
    </div>
  );

  if (block.type === "columns") return (
    <div style={{ ...s, display: "grid", gridTemplateColumns: "1fr 1fr", gap: d.gap || "24px", padding: "8px 0" }}>
      {["left", "right"].map(side => (
        <div key={side} style={{ background: "#FAF6EE", border: "1px solid #1e2432", borderRadius: 5, padding: "16px 18px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1A2E", marginBottom: 6 }}>{d[side + "Heading"]}</div>
          <div style={{ fontSize: 14, color: "#6B7B8D", lineHeight: 1.65 }}>{d[side + "Content"]}</div>
        </div>
      ))}
    </div>
  );

  if (block.type === "divider") return (
    <div style={{ ...s, padding: "12px 0", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, height: d.thickness || 1, background: d.color || "#D4CFC0" }} />
      {d.label && <span style={{ fontSize: 13, color: "#6B7B8D", textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>{d.label}</span>}
      {d.label && <div style={{ flex: 1, height: d.thickness || 1, background: d.color || "#D4CFC0" }} />}
    </div>
  );

  if (block.type === "spacer") return (
    <div style={{ height: d.height || 40, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #1e2432", borderRadius: 4 }}>
      <span style={{ fontSize: 12, color: "#8B7333" }}>{d.height}px spacer</span>
    </div>
  );

  if (block.type === "list") return (
    <div style={{ ...s, padding: "6px 0" }}>
      {d.style === "numbered"
        ? <ol style={{ margin: 0, paddingLeft: 22 }}>{(d.items||[]).map((item, i) => <li key={i} style={{ fontSize: 15, color: "#3D3D56", lineHeight: 1.8, marginBottom: 2 }}>{item}</li>)}</ol>
        : <ul style={{ margin: 0, paddingLeft: 20 }}>{(d.items||[]).map((item, i) => <li key={i} style={{ fontSize: 15, color: "#3D3D56", lineHeight: 1.8, marginBottom: 2 }}>{item}</li>)}</ul>}
    </div>
  );

  if (block.type === "quote") return (
    <div style={{ ...s, borderLeft: "3px solid #C9A84C", paddingLeft: 18, margin: "10px 0" }}>
      <div style={{ fontSize: 16, color: "#1A1A2E", fontStyle: "italic", lineHeight: 1.7, marginBottom: 6 }}>"{d.text}"</div>
      {d.attribution && <div style={{ fontSize: 14, color: "#6B7B8D" }}>— {d.attribution}</div>}
    </div>
  );

  if (block.type === "cards") return (
    <div style={{ ...s, display: "grid", gridTemplateColumns: `repeat(${(d.cards||[]).length}, 1fr)`, gap: 12, padding: "6px 0" }}>
      {(d.cards||[]).map((card, i) => (
        <div key={i} style={{ background: "#FAF6EE", border: "1px solid #1e2432", borderRadius: 6, padding: "16px 18px" }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>{card.icon}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1A2E", marginBottom: 4 }}>{card.title}</div>
          <div style={{ fontSize: 14, color: "#6B7B8D", lineHeight: 1.6 }}>{card.body}</div>
        </div>
      ))}
    </div>
  );

  if (block.type === "html") return (
    <div style={{ background: "#F0EAD6", border: "1px solid #1e2432", borderRadius: 5, padding: 12 }}>
      <div style={{ fontSize: 12, color: "#6B7B8D", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Raw HTML Block</div>
      <iframe srcDoc={d.code} sandbox="allow-same-origin allow-scripts" style={{ width: "100%", minHeight: 200, border: "none", display: "block" }} />
    </div>
  );

  if (block.type === "video") return (
    <div style={{ ...s, textAlign: d.align || "center", padding: "8px 0" }}>
      {d.src
        ? <video src={d.src} poster={d.poster || undefined} controls={d.controls !== false} autoPlay={!!d.autoplay} loop={!!d.loop}
            style={{ maxWidth: "100%", borderRadius: 6, display: "inline-block" }} />
        : <div style={{ background: "#F0EAD6", border: "2px dashed #3a4356", borderRadius: 6, padding: "40px 20px", color: "#6B7B8D", fontSize: 15, textAlign: "center" }}>▶ No video uploaded yet — use the properties panel</div>}
      {d.caption && <div style={{ fontSize: 13, color: "#6B7B8D", marginTop: 6, fontStyle: "italic" }}>{d.caption}</div>}
    </div>
  );

  if (block.type === "audio") return (
    <div style={{ ...s, padding: "12px 0" }}>
      {d.src
        ? <audio src={d.src} controls={d.controls !== false} autoPlay={!!d.autoplay} loop={!!d.loop} style={{ width: "100%", borderRadius: 4 }} />
        : <div style={{ background: "#F0EAD6", border: "2px dashed #3a4356", borderRadius: 6, padding: "24px 20px", color: "#6B7B8D", fontSize: 15, textAlign: "center" }}>♪ No audio uploaded yet — use the properties panel</div>}
      {d.caption && <div style={{ fontSize: 13, color: "#6B7B8D", marginTop: 6, fontStyle: "italic" }}>{d.caption}</div>}
    </div>
  );

  if (block.type === "record") return (
    <div style={{ ...s, background: "#F0EAD6", border: "1px solid #1e2432", borderRadius: 6, padding: "16px 18px", textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "#6B7B8D", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {d.mediaType === "video" ? "▶ Recorded Video" : "♪ Recorded Audio"}
      </div>
      {d.src
        ? (d.mediaType === "video"
            ? <video src={d.src} controls style={{ maxWidth: "100%", borderRadius: 6, maxHeight: 200 }} />
            : <audio src={d.src} controls style={{ width: "100%" }} />)
        : <div style={{ color: "#8B7333", fontSize: 14, padding: "12px 0" }}>⏺ Use the Record button in the properties panel to capture {d.mediaType}</div>}
      {d.caption && <div style={{ fontSize: 13, color: "#6B7B8D", marginTop: 6, fontStyle: "italic" }}>{d.caption}</div>}
    </div>
  );

  if (block.type === "emoji") return (
    <div style={{ ...s, textAlign: d.align || "center", padding: "12px 0" }}>
      <span style={{ fontSize: d.size || 64, lineHeight: 1 }}>{d.emoji || "\u2696\ufe0f"}</span>
      {d.caption && <div style={{ fontSize: 13, color: "#6B7B8D", marginTop: 6, fontStyle: "italic" }}>{d.caption}</div>}
    </div>
  );

  if (block.type === "gif") return (
    <div style={{ ...s, textAlign: d.align || "center", padding: "8px 0" }}>
      {d.url
        ? <img src={d.url} alt={d.alt || "GIF"} style={{ maxWidth: "100%", borderRadius: 6, display: "inline-block" }} />
        : <div style={{ background: "#F0EAD6", border: "2px dashed #3a4356", borderRadius: 6, padding: "40px 20px", color: "#6B7B8D", fontSize: 15, textAlign: "center" }}>\U0001f39e Search for a GIF in the properties panel</div>}
      {d.caption && <div style={{ fontSize: 13, color: "#6B7B8D", marginTop: 6, fontStyle: "italic" }}>{d.caption}</div>}
    </div>
  );

  return <div style={{ color: "#6B7B8D", fontSize: 14 }}>Unknown block: {block.type}</div>;
}

// ── Properties panels per block type ─────────────────────────────────────────


function ImageBlockProps({ d, set, token }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true); setUploadError(null);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      set('src', data.url);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      {sectionTitle("Image Block")}

      {/* Upload area */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#8DA4BE", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Upload Image</div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile}
          style={{ display: "none" }} id="img-upload" />
        <label htmlFor="img-upload" style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "10px", border: "1px dashed #3a4356", borderRadius: 5,
          cursor: uploading ? "not-allowed" : "pointer",
          background: "#0d2240", color: uploading ? "#8DA4BE" : "#C9A84C",
          fontSize: 13, fontWeight: 600
        }}>
          {uploading ? "↑ Uploading…" : "↑ Choose file to upload"}
        </label>
        {uploadError && <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 4 }}>{uploadError}</div>}
      </div>

      {/* Or enter URL */}
      <Field label="Or enter URL"><Inp value={d.src} onChange={v => set("src", v)} mono placeholder="https://…/image.jpg" /></Field>

      {/* Preview */}
      {d.src && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#8DA4BE", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Preview</div>
          <img src={d.src} alt={d.alt || ""} style={{ width: "100%", borderRadius: 4, border: "1px solid #1e2432", objectFit: "cover", maxHeight: 120 }}
            onError={e => { e.target.style.display = "none"; }} />
        </div>
      )}

      <Field label="Alt Text"><Inp value={d.alt} onChange={v => set("alt", v)} placeholder="Describe the image" /></Field>
      <Field label="Caption"><Inp value={d.caption} onChange={v => set("caption", v)} placeholder="Optional caption" /></Field>
      <Field label="Alignment"><Sel value={d.align} onChange={v => set("align", v)} options={["left","center","right"]} /></Field>
      <Field label="Max Width"><Inp value={d.maxWidth} onChange={v => set("maxWidth", v)} placeholder="100%, 600px, etc." mono /></Field>
    </div>
  );
}

const sectionTitle = (t) => (
  <div style={{ fontSize: 12, color: "#A8C4D8", textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 700, marginBottom: 12, marginTop: 4, paddingBottom: 6, borderBottom: "1px solid #1e2432" }}>{t}</div>
);


// ── Emoji Block Properties ────────────────────────────────────────────────────
const COMMON_EMOJIS = [
  "⚖️","📋","📚","🎓","📝","🔍","💡","✅","⭐","🏆",
  "📖","🖊️","📐","🔖","📌","🗂️","💼","🏛️","⚡","🎯",
  "👋","🤝","🙌","👍","💪","🧠","❤️","🔥","✨","🎉",
  "😊","😄","🤔","💬","📢","🚀","🌟","🏅","🎖️","🎁"
];

function EmojiPicker({ value, onSelect }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => setOpen(v => !v)}
          style={{ fontSize: 32, background: "rgba(201,168,76,0.1)", border: "1px solid #3a4356", borderRadius: 8, padding: "6px 14px", cursor: "pointer", lineHeight: 1 }}>
          {value || "⚖️"}
        </button>
        <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Paste custom emoji"
          style={{ flex: 1, padding: "6px 8px", background: "#0d2240", border: "1px solid #3a4356", borderRadius: 5, color: "#E8E4DC", fontSize: 14 }}
          onKeyDown={e => { if (e.key === "Enter" && custom) { onSelect(custom); setCustom(""); setOpen(false); } }} />
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 50, background: "#0f1923", border: "1px solid #2a3a52", borderRadius: 8, padding: 8, display: "flex", flexWrap: "wrap", gap: 4, width: 220, marginTop: 4, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
          {COMMON_EMOJIS.map(em => (
            <button key={em} onClick={() => { onSelect(em); setOpen(false); }}
              style={{ fontSize: 22, background: value === em ? "rgba(201,168,76,0.2)" : "transparent", border: value === em ? "1px solid #C9A84C" : "1px solid transparent", borderRadius: 4, padding: "3px 5px", cursor: "pointer", lineHeight: 1, transition: "all 0.1s" }}>
              {em}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmojiBlockProps({ d, set }) {
  return (
    <div>
      {sectionTitle("Emoji Block")}
      <Field label="Emoji">
        <EmojiPicker value={d.emoji} onSelect={v => set("emoji", v)} />
      </Field>
      <Field label="Size (px)">
        <input type="range" min={24} max={128} value={d.size || 64}
          onChange={e => set("size", Number(e.target.value))}
          style={{ width: "100%", accentColor: "#C9A84C" }} />
        <div style={{ fontSize: 12, color: "#8DA4BE", marginTop: 2 }}>{d.size || 64}px</div>
      </Field>
      <Field label="Alignment"><Sel value={d.align} onChange={v => set("align", v)} options={["left","center","right"]} /></Field>
      <Field label="Caption"><Inp value={d.caption} onChange={v => set("caption", v)} placeholder="Optional caption" /></Field>
    </div>
  );
}

// ── GIF Block Properties (Giphy public beta) ──────────────────────────────────
// Uses Giphy's public-beta key (rate-limited but functional for demos)
const GIPHY_KEY = "dc6zaTOxFJmzC"; // Giphy public beta key

function GifBlockProps({ d, set }) {
  const [query, setQuery]       = useState(d.query || "");
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=12&rating=pg`);
      const data = await res.json();
      setResults(data.data || []);
    } catch { setResults([]); }
    finally { setSearching(false); setSearched(true); }
  };

  const pick = (gif) => {
    set("url",   gif.images.original.url);
    set("alt",   gif.title || query);
    set("query", query);
  };

  return (
    <div>
      {sectionTitle("GIF Block")}
      <Field label="Search Giphy">
        <div style={{ display: "flex", gap: 6 }}>
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
            placeholder="celebration, law, success…"
            style={{ flex: 1, padding: "6px 8px", background: "#0d2240", border: "1px solid #3a4356", borderRadius: 5, color: "#E8E4DC", fontSize: 13 }} />
          <button onClick={search} disabled={searching}
            style={{ padding: "6px 10px", background: "#C9A84C", border: "none", borderRadius: 5, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            {searching ? "…" : "Search"}
          </button>
        </div>
      </Field>
      {d.url && (
        <div style={{ marginBottom: 12, textAlign: "center" }}>
          <img src={d.url} alt={d.alt} style={{ maxWidth: "100%", borderRadius: 6, border: "2px solid #C9A84C" }} />
          <div style={{ fontSize: 11, color: "#8DA4BE", marginTop: 4 }}>Selected GIF</div>
        </div>
      )}
      {results.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: "#8DA4BE", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Results</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, maxHeight: 260, overflow: "auto" }}>
            {results.map(gif => (
              <img key={gif.id}
                src={gif.images.fixed_height_small.url}
                alt={gif.title}
                onClick={() => pick(gif)}
                style={{ width: "100%", cursor: "pointer", borderRadius: 4, border: d.url === gif.images.original.url ? "2px solid #C9A84C" : "2px solid transparent", transition: "border 0.1s" }} />
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#6B7B8D", marginTop: 6, textAlign: "right" }}>Powered by GIPHY</div>
        </div>
      )}
      {searched && results.length === 0 && <div style={{ fontSize: 13, color: "#8DA4BE" }}>No results found.</div>}
      {sectionTitle("Settings")}
      <Field label="Caption"><Inp value={d.caption} onChange={v => set("caption", v)} placeholder="Optional caption" /></Field>
      <Field label="Alignment"><Sel value={d.align} onChange={v => set("align", v)} options={["left","center","right"]} /></Field>
    </div>
  );
}

function BlockProperties({ block, onChange, token }) {
  const d = block.data;
  const set = (key, val) => onChange({ ...d, [key]: val });
  const setCard = (idx, key, val) => {
    const cards = [...(d.cards || [])];
    cards[idx] = { ...cards[idx], [key]: val };
    onChange({ ...d, cards });
  };
  const setItem = (idx, val) => {
    const items = [...(d.items || [])];
    items[idx] = val;
    onChange({ ...d, items });
  };


  if (block.type === "hero") return (
    <div>
      {sectionTitle("Hero Block")}
      <Field label="Headline"><Inp value={d.headline} onChange={v => set("headline", v)} /></Field>
      <Field label="Subline"><Ta value={d.subline} onChange={v => set("subline", v)} rows={2} /></Field>
      <Field label="Button Text"><Inp value={d.btnText} onChange={v => set("btnText", v)} /></Field>
      <Field label="Button Link"><Inp value={d.btnLink} onChange={v => set("btnLink", v)} mono placeholder="/path or https://…" /></Field>
      <Field label="Alignment"><Sel value={d.align} onChange={v => set("align", v)} options={["left","center","right"]} /></Field>
      {sectionTitle("Colors")}
      <Field label="Background Color"><ColorSwatch value={d.bgColor || "#0B1D3A"} onChange={v => set("bgColor", v)} /></Field>
      <Field label="Text Color"><ColorSwatch value={d.textColor || "#ffffff"} onChange={v => set("textColor", v)} /></Field>
    </div>
  );

  if (block.type === "text") return (
    <div>
      {sectionTitle("Text Block")}
      <Field label="Content"><Ta value={d.content} onChange={v => set("content", v)} rows={6} /></Field>
      <Field label="Alignment"><Sel value={d.align} onChange={v => set("align", v)} options={["left","center","right","justify"]} /></Field>
    </div>
  );

  if (block.type === "heading") return (
    <div>
      {sectionTitle("Heading Block")}
      <Field label="Text"><Inp value={d.text} onChange={v => set("text", v)} /></Field>
      <Field label="Level"><Sel value={d.level} onChange={v => set("level", v)} options={[{value:"h2",label:"H2 — Section"},{value:"h3",label:"H3 — Subsection"},{value:"h4",label:"H4 — Minor"}]} /></Field>
      <Field label="Alignment"><Sel value={d.align} onChange={v => set("align", v)} options={["left","center","right"]} /></Field>
      <Field label="Color"><ColorSwatch value={d.color || "#1A1A2E"} onChange={v => set("color", v)} /></Field>
    </div>
  );

  if (block.type === "image") return (
    <ImageBlockProps d={d} set={set} token={token} />
  );

  if (block.type === "cta") return (
    <div>
      {sectionTitle("CTA Block")}
      <Field label="Heading"><Inp value={d.heading} onChange={v => set("heading", v)} /></Field>
      <Field label="Body Text"><Ta value={d.body} onChange={v => set("body", v)} rows={2} /></Field>
      <Field label="Button Text"><Inp value={d.btnText} onChange={v => set("btnText", v)} /></Field>
      <Field label="Button Link"><Inp value={d.btnLink} onChange={v => set("btnLink", v)} mono placeholder="/path or https://…" /></Field>
      {sectionTitle("Colors")}
      <Field label="Background"><ColorSwatch value={d.bgColor || "#0B1D3A"} onChange={v => set("bgColor", v)} /></Field>
      <Field label="Button Color"><ColorSwatch value={d.btnColor || "#C9A84C"} onChange={v => set("btnColor", v)} /></Field>
    </div>
  );

  if (block.type === "columns") return (
    <div>
      {sectionTitle("Left Column")}
      <Field label="Heading"><Inp value={d.leftHeading} onChange={v => set("leftHeading", v)} /></Field>
      <Field label="Content"><Ta value={d.leftContent} onChange={v => set("leftContent", v)} rows={3} /></Field>
      {sectionTitle("Right Column")}
      <Field label="Heading"><Inp value={d.rightHeading} onChange={v => set("rightHeading", v)} /></Field>
      <Field label="Content"><Ta value={d.rightContent} onChange={v => set("rightContent", v)} rows={3} /></Field>
      {sectionTitle("Layout")}
      <Field label="Gap"><Inp value={d.gap} onChange={v => set("gap", v)} mono placeholder="24px" /></Field>
    </div>
  );

  if (block.type === "divider") return (
    <div>
      {sectionTitle("Divider")}
      <Field label="Label (optional)"><Inp value={d.label} onChange={v => set("label", v)} placeholder="e.g. Features" /></Field>
      <Field label="Color"><ColorSwatch value={d.color || "#D4CFC0"} onChange={v => set("color", v)} /></Field>
      <Field label="Thickness (px)"><Inp value={String(d.thickness || 1)} onChange={v => set("thickness", parseInt(v)||1)} mono /></Field>
    </div>
  );

  if (block.type === "spacer") return (
    <div>
      {sectionTitle("Spacer")}
      <Field label="Height (px)">
        <input type="range" min={8} max={200} value={d.height || 40} onChange={e => set("height", parseInt(e.target.value))}
          style={{ width: "100%", marginBottom: 4 }} />
        <span style={{ fontSize: 14, color: "#6B7B8D" }}>{d.height || 40}px</span>
      </Field>
    </div>
  );

  if (block.type === "list") return (
    <div>
      {sectionTitle("List Block")}
      <Field label="Style"><Sel value={d.style} onChange={v => set("style", v)} options={["bullet","numbered"]} /></Field>
      <Field label="Items">
        {(d.items||[]).map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <Inp value={item} onChange={v => setItem(i, v)} placeholder={`Item ${i+1}`} />
            <button onClick={() => { const it = (d.items||[]).filter((_, j) => j !== i); onChange({ ...d, items: it }); }}
              style={{ padding: "0 8px", background: "#F0EAD6", border: "1px solid #252c3a", borderRadius: 4, color: "#B91C1C", cursor: "pointer", fontSize: 15 }}>×</button>
          </div>
        ))}
        <button onClick={() => onChange({ ...d, items: [...(d.items||[]), "New item"] })}
          style={{ width: "100%", padding: "6px", background: "#FAF6EE", border: "1px dashed #3a4356", borderRadius: 4, color: "#C9A84C", cursor: "pointer", fontSize: 14, marginTop: 2 }}>
          + Add Item
        </button>
      </Field>
    </div>
  );

  if (block.type === "quote") return (
    <div>
      {sectionTitle("Quote")}
      <Field label="Quote Text"><Ta value={d.text} onChange={v => set("text", v)} rows={3} /></Field>
      <Field label="Attribution"><Inp value={d.attribution} onChange={v => set("attribution", v)} placeholder="e.g. Aristotle" /></Field>
    </div>
  );

  if (block.type === "cards") return (
    <div>
      {sectionTitle("Card Grid")}
      {(d.cards||[]).map((card, i) => (
        <div key={i} style={{ background: "#F0EAD6", border: "1px solid #1e2432", borderRadius: 5, padding: "10px 12px", marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: "#8DA4BE", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Card {i+1}</span>
            {(d.cards||[]).length > 1 && <button onClick={() => { const c = d.cards.filter((_, j) => j !== i); onChange({ ...d, cards: c }); }}
              style={{ background: "none", border: "none", color: "#B91C1C", cursor: "pointer", fontSize: 15 }}>×</button>}
          </div>
          <Field label="Icon"><Inp value={card.icon} onChange={v => setCard(i, "icon", v)} placeholder="emoji or text" /></Field>
          <Field label="Title"><Inp value={card.title} onChange={v => setCard(i, "title", v)} /></Field>
          <Field label="Body"><Ta value={card.body} onChange={v => setCard(i, "body", v)} rows={2} /></Field>
          <Field label="Link"><Inp value={card.link} onChange={v => setCard(i, "link", v)} mono placeholder="/path" /></Field>
        </div>
      ))}
      {(d.cards||[]).length < 4 && (
        <button onClick={() => onChange({ ...d, cards: [...(d.cards||[]), { title: "New Card", body: "Card description.", link: "#", icon: "⭐" }] })}
          style={{ width: "100%", padding: "7px", background: "#FAF6EE", border: "1px dashed #3a4356", borderRadius: 4, color: "#C9A84C", cursor: "pointer", fontSize: 14 }}>
          + Add Card
        </button>
      )}
    </div>
  );

  if (block.type === "html") return (
    <div>
      {sectionTitle("Raw HTML")}
      <div style={{ fontSize: 13, color: "#e67e22", background: "#FEF3C7", border: "1px solid #e67e2233", borderRadius: 5, padding: "8px 10px", marginBottom: 12 }}>
        ⚠️ Raw HTML is injected directly. Sanitize carefully.
      </div>
      <Field label="HTML Code"><Ta value={d.code} onChange={v => set("code", v)} rows={8} /></Field>
    </div>
  );

  if (block.type === "video") return (
    <VideoBlockProps d={d} set={set} token={token} />
  );

  if (block.type === "audio") return (
    <AudioBlockProps d={d} set={set} token={token} />
  );

  if (block.type === "record") return (
    <RecordBlockProps d={d} set={set} token={token} />
  );

  if (block.type === "emoji") return (
    <EmojiBlockProps d={d} set={(k, v) => onChange({ ...d, [k]: v })} />
  );

  if (block.type === "gif") return (
    <GifBlockProps d={d} set={(k, v) => onChange({ ...d, [k]: v })} />
  );

  return <div style={{ color: "#6B7B8D", fontSize: 14, padding: "20px 0" }}>No properties for this block type.</div>;
}

function MediaUploadField({ label, accept, fieldKey, d, set, token, fileInputId }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);
  const ref = useRef();
  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true); setErr(null);
    try {
      const form = new FormData(); form.append('file', file);
      const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      set(fieldKey, data.url);
    } catch (e) { setErr(e.message); }
    finally { setUploading(false); if (ref.current) ref.current.value = ''; }
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#8DA4BE", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <input ref={ref} type="file" accept={accept} onChange={handleFile} style={{ display: "none" }} id={fileInputId} />
      <label htmlFor={fileInputId} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", border: "1px dashed #3a4356", borderRadius: 5, cursor: uploading ? "not-allowed" : "pointer", background: "#0d2240", color: uploading ? "#8DA4BE" : "#C9A84C", fontSize: 13, fontWeight: 600 }}>
        {uploading ? "↑ Uploading…" : "↑ Choose file"}
      </label>
      {err && <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 4 }}>{err}</div>}
    </div>
  );
}

function VideoBlockProps({ d, set, token }) {
  return (
    <div>
      {sectionTitle("Video Block")}
      <MediaUploadField label="Upload Video" accept="video/*" fieldKey="src" d={d} set={set} token={token} fileInputId="vid-upload" />
      <Field label="Or enter video URL"><Inp value={d.src} onChange={v => set("src", v)} mono placeholder="https://…/video.mp4" /></Field>
      <MediaUploadField label="Poster Image (thumbnail)" accept="image/*" fieldKey="poster" d={d} set={set} token={token} fileInputId="vid-poster-upload" />
      <Field label="Caption"><Inp value={d.caption} onChange={v => set("caption", v)} /></Field>
      <Field label="Alignment"><Sel value={d.align} onChange={v => set("align", v)} options={["left","center","right"]} /></Field>
      {sectionTitle("Playback")}
      <Field label="Show controls">
        <button onClick={() => set("controls", !d.controls)} style={{ padding: "5px 12px", borderRadius: 4, border: "1px solid #3a4356", background: d.controls !== false ? "#C9A84C22" : "#0d2240", color: d.controls !== false ? "#C9A84C" : "#6B7B8D", fontSize: 13, cursor: "pointer" }}>
          {d.controls !== false ? "✓ On" : "Off"}
        </button>
      </Field>
      <Field label="Autoplay">
        <button onClick={() => set("autoplay", !d.autoplay)} style={{ padding: "5px 12px", borderRadius: 4, border: "1px solid #3a4356", background: d.autoplay ? "#C9A84C22" : "#0d2240", color: d.autoplay ? "#C9A84C" : "#6B7B8D", fontSize: 13, cursor: "pointer" }}>
          {d.autoplay ? "✓ On" : "Off"}
        </button>
      </Field>
      <Field label="Loop">
        <button onClick={() => set("loop", !d.loop)} style={{ padding: "5px 12px", borderRadius: 4, border: "1px solid #3a4356", background: d.loop ? "#C9A84C22" : "#0d2240", color: d.loop ? "#C9A84C" : "#6B7B8D", fontSize: 13, cursor: "pointer" }}>
          {d.loop ? "✓ On" : "Off"}
        </button>
      </Field>
    </div>
  );
}

function AudioBlockProps({ d, set, token }) {
  return (
    <div>
      {sectionTitle("Audio Block")}
      <MediaUploadField label="Upload Audio" accept="audio/*" fieldKey="src" d={d} set={set} token={token} fileInputId="aud-upload" />
      <Field label="Or enter audio URL"><Inp value={d.src} onChange={v => set("src", v)} mono placeholder="https://…/audio.mp3" /></Field>
      <Field label="Caption"><Inp value={d.caption} onChange={v => set("caption", v)} /></Field>
      {sectionTitle("Playback")}
      <Field label="Show controls">
        <button onClick={() => set("controls", !d.controls)} style={{ padding: "5px 12px", borderRadius: 4, border: "1px solid #3a4356", background: d.controls !== false ? "#C9A84C22" : "#0d2240", color: d.controls !== false ? "#C9A84C" : "#6B7B8D", fontSize: 13, cursor: "pointer" }}>
          {d.controls !== false ? "✓ On" : "Off"}
        </button>
      </Field>
      <Field label="Loop">
        <button onClick={() => set("loop", !d.loop)} style={{ padding: "5px 12px", borderRadius: 4, border: "1px solid #3a4356", background: d.loop ? "#C9A84C22" : "#0d2240", color: d.loop ? "#C9A84C" : "#6B7B8D", fontSize: 13, cursor: "pointer" }}>
          {d.loop ? "✓ On" : "Off"}
        </button>
      </Field>
    </div>
  );
}

function RecordBlockProps({ d, set, token }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const startRecording = async () => {
    setErr(null);
    try {
      const constraints = d.mediaType === "video" ? { video: true, audio: true } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(1000);
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (e) { setErr("Mic/camera access denied: " + e.message); }
  };

  const stopRecording = () => {
    return new Promise(resolve => {
      if (!mediaRef.current) return resolve(null);
      mediaRef.current.onstop = () => {
        const mimeType = d.mediaType === "video" ? "video/webm" : "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        resolve(blob);
      };
      mediaRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      clearInterval(timerRef.current);
      setRecording(false);
    });
  };

  const handleStop = async () => {
    const blob = await stopRecording();
    if (!blob) return;
    setUploading(true);
    try {
      const ext = d.mediaType === "video" ? ".webm" : ".webm";
      const file = new File([blob], `recording${ext}`, { type: blob.type });
      const form = new FormData(); form.append('file', file);
      const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      set('src', data.url);
      set('duration', seconds);
    } catch (e) { setErr(e.message); }
    finally { setUploading(false); }
  };

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  return (
    <div>
      {sectionTitle("Record Block")}
      <Field label="Media Type">
        <Sel value={d.mediaType} onChange={v => set("mediaType", v)} options={[{value:"audio",label:"Audio only"},{value:"video",label:"Video + Audio"}]} />
      </Field>
      <div style={{ margin: "16px 0", padding: 16, background: "#0d1a2e", border: "1px solid #3a4356", borderRadius: 8, textAlign: "center" }}>
        {recording ? (
          <div>
            <div style={{ fontSize: 28, color: "#ef4444", marginBottom: 8 }}>⏺ {fmt(seconds)}</div>
            <div style={{ fontSize: 13, color: "#8DA4BE", marginBottom: 12 }}>Recording {d.mediaType}…</div>
            <button onClick={handleStop} style={{ padding: "9px 22px", background: "#B91C1C", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              ⏹ Stop & Upload
            </button>
          </div>
        ) : uploading ? (
          <div style={{ color: "#C9A84C", fontSize: 14 }}>↑ Uploading recording…</div>
        ) : d.src ? (
          <div>
            <div style={{ fontSize: 13, color: "#2D8B55", marginBottom: 10 }}>✓ Recording saved ({fmt(d.duration || 0)})</div>
            {d.mediaType === "video"
              ? <video src={d.src} controls style={{ maxWidth: "100%", borderRadius: 6, maxHeight: 120, marginBottom: 10 }} />
              : <audio src={d.src} controls style={{ width: "100%", marginBottom: 10 }} />}
            <button onClick={startRecording} style={{ padding: "7px 16px", background: "#0d2240", color: "#C9A84C", border: "1px solid #C9A84C44", borderRadius: 5, fontSize: 13, cursor: "pointer" }}>
              ⏺ Record again
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: "#6B7B8D", marginBottom: 12 }}>
              {d.mediaType === "video" ? "🎥 Camera + microphone" : "🎙 Microphone only"}
            </div>
            <button onClick={startRecording} style={{ padding: "10px 24px", background: "#C9A84C", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              ⏺ Start Recording
            </button>
          </div>
        )}
        {err && <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 8 }}>{err}</div>}
      </div>
      <Field label="Caption"><Inp value={d.caption} onChange={v => set("caption", v)} /></Field>
    </div>
  );
}

// ── Main block editor ─────────────────────────────────────────────────────────

function CourseBlockEditor({ course, onSave, onClose, token: tokenProp }) {
  const token = tokenProp || (() => { try { return JSON.parse(localStorage.getItem("lc_user"))?.token || ""; } catch { return ""; } })();
  const [meta, setMeta] = useState({ title: course?.title || "", coverImage: course?.cover_image || "" });
  const [blocks, setBlocks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [saved, setSaved] = useState(false);
  const [savedMsg, setSavedMsg] = useState("Saved");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const initialLoad = useRef(true);

  // Load full content on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/courses/${course.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.page_content) {
          // page_content is jsonb — already a parsed object from the API
          const pc = typeof data.page_content === 'string'
            ? JSON.parse(data.page_content)
            : data.page_content;
          if (Array.isArray(pc) && pc.length > 0) { setBlocks(pc); return; }
        }
      } catch {}
      finally { setLoading(false); }
      setLoading(false);
    })();
  }, []);

  const selectedBlock = blocks.find(b => b.id === selectedId);
  const selectedIdx = blocks.findIndex(b => b.id === selectedId);

  // Mark dirty whenever blocks or title change — but skip the initial data load
  useEffect(() => {
    if (initialLoad.current) { initialLoad.current = false; return; }
    setDirty(true);
  }, [blocks, meta.title]);

  // ── Keyboard shortcuts (editor-scoped) ────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const inInput = ["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName) || e.target.isContentEditable;
      // Cmd/Ctrl+S → Save
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
        return;
      }
      // Escape → Back (with dirty check)
      if (e.key === "Escape" && !inInput) {
        e.preventDefault();
        if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
        onClose();
        return;
      }
      // Delete / Backspace → delete selected block (only when not in an input)
      if ((e.key === "Delete" || e.key === "Backspace") && !inInput && selectedId) {
        e.preventDefault();
        deleteBlock(selectedId);
        return;
      }
      // [ / ] → move selected block up/down
      if (e.key === "[" && !inInput && selectedIdx > 0) {
        e.preventDefault();
        moveBlock(selectedIdx, -1);
      }
      if (e.key === "]" && !inInput && selectedIdx >= 0 && selectedIdx < blocks.length - 1) {
        e.preventDefault();
        moveBlock(selectedIdx, 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, selectedId, selectedIdx, blocks.length, saving]);

  const [libTab, setLibTab] = useState("blocks"); // "blocks" | "templates"

  const addBlock = (type) => {
    const newBlock = { id: "b" + Date.now(), type, data: { ...BLOCK_DEFAULTS[type] } };
    setBlocks(prev => [...prev, newBlock]);
    setSelectedId(newBlock.id);
  };

  const loadTemplate = (tpl) => {
    if (blocks.length > 0 && !window.confirm("Load this template? It will replace your current blocks.")) return;
    const newBlocks = tpl.blocks.map((b, i) => ({ id: "b" + (Date.now() + i), type: b.type, data: { ...(BLOCK_DEFAULTS[b.type] || {}), ...(b.data || {}) } }));
    setBlocks(newBlocks);
    setSelectedId(newBlocks[0]?.id || null);
    setDirty(true);
    setLibTab("blocks");
  };

  const updateBlockData = (id, data) => setBlocks(prev => prev.map(b => b.id === id ? { ...b, data } : b));
  const deleteBlock    = (id) => { setBlocks(prev => prev.filter(b => b.id !== id)); if (selectedId === id) setSelectedId(null); };
  const duplicateBlock = (b) => { const nb = { ...b, data: { ...b.data }, id: "b" + Date.now() }; setBlocks(prev => { const i = prev.findIndex(x => x.id === b.id); const n = [...prev]; n.splice(i+1, 0, nb); return n; }); setSelectedId(nb.id); };
  const moveBlock      = (idx, dir) => { const nb = [...blocks]; const t = nb[idx]; nb[idx] = nb[idx+dir]; nb[idx+dir] = t; setBlocks(nb); };

  const handleSave = async () => {
    setSaving(true); setSaveError("");
    try {
      
      const res = await fetch(`${API_URL}/api/courses/${course.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ page_content: blocks, cover_image: meta.coverImage || course.cover_image || "" }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error || "Save failed"); return; }
      setSavedMsg("Saved"); setSaved(true); setDirty(false);
      onSave(data);
      setTimeout(() => setSaved(false), 2200);
    } catch { setSaveError("Network error"); }
    finally { setSaving(false); }
  };

  const handlePull = async () => {
    setSaving(true); setSaveError("");
    try {
      const res = await fetch(`${API_URL}/api/courses/${course.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error || "Pull failed"); return; }
      // Load the raw HTML as a single HTML block
      setBlocks([{ id: "b" + Date.now(), type: "html", data: { code: data.content } }]);
      setSavedMsg("Loaded from VPS"); setSaved(true); setDirty(false);
      setTimeout(() => setSaved(false), 2200);
    } catch { setSaveError("Network error"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", background: "#F0EAD6", fontFamily: "Source Sans 3, Segoe UI, sans-serif" }}>
      <style>{`
        .blk-row:hover .blk-actions { opacity: 1 !important; }
        .lib-btn:hover { background: #1e2838 !important; border-color: #3a4a5c !important; color: #fff !important; }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 16px", height: 52, background: "#0B1D3A", borderBottom: "1px solid #1e2432", flexShrink: 0 }}>
        <button onClick={() => {
          if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
          onClose();
        }} style={{ background: "none", border: "none", color: "#C9A84C", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 15, padding: "4px 8px", borderRadius: 4 }}>
          ← Back
        </button>
        <div style={{ width: 1, height: 20, background: "#F0EAD6" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, overflow: "hidden" }}>
          <input value={meta.title} onChange={e => setMeta(m => ({ ...m, title: e.target.value }))}
            placeholder="Page Title"
            style={{ background: "none", border: "none", fontSize: 16, fontWeight: 700, color: "#FFFFFF", outline: "none", minWidth: 0, flex: "1 1 0", width: 0 }} />
          <span style={{ fontSize: 13, color: "#C9A84C", fontFamily: "monospace", background: "rgba(201,168,76,0.12)", padding: "2px 8px", borderRadius: 3, flexShrink: 0 }}>{meta.slug || "/"}</span>
          <span style={{ fontSize: 13, color: "#6B7B8D", flexShrink: 0 }}>{meta.site}</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {saveError && <span style={{ fontSize: 13, color: "#B91C1C" }}>{saveError}</span>}
          {saved && <span style={{ fontSize: 14, color: "#2D8B55", display: "flex", alignItems: "center", gap: 4 }}><Icon name="check" size={12} /> {savedMsg}</span>}
          {dirty && !saved && <span style={{ fontSize: 12, color: "#C9A84C", opacity: 0.8 }}>● Unsaved</span>}
          <button onClick={handlePull} disabled={saving}
            style={{ padding: "7px 14px", background: "transparent", border: "1px solid #C9A84C", borderRadius: 5, color: "#C9A84C", cursor: saving ? "not-allowed" : "pointer", fontSize: 14 }}>
            ↓ Load from VPS
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "7px 16px", background: saving ? "#8a7035" : "#C9A84C", border: "none", borderRadius: 5, color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 600 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* ── Three-panel body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Left: Block library / Templates ── */}
        <div style={{ width: 196, background: "#0B1D3A", borderRight: "1px solid #1e2432", flexShrink: 0, display: "flex", flexDirection: "column" }}>
          {/* Tab switcher */}
          <div style={{ display: "flex", borderBottom: "1px solid #1e2432", flexShrink: 0 }}>
            {["blocks","templates"].map(tab => (
              <button key={tab} onClick={() => setLibTab(tab)}
                style={{ flex: 1, padding: "9px 4px", border: "none", borderBottom: libTab === tab ? "2px solid #C9A84C" : "2px solid transparent", background: "transparent", color: libTab === tab ? "#C9A84C" : "#8DA4BE", fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize", letterSpacing: "0.05em", transition: "all 0.12s" }}>
                {tab === "blocks" ? "Blocks" : "Templates"}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "12px 10px" }}>
            {libTab === "blocks" ? (
              <>
                {BLOCK_LIBRARY.map(cat => (
                  <div key={cat.category} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, color: "#D4CFC0", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, paddingLeft: 4 }}>{cat.category}</div>
                    {cat.blocks.map(b => (
                      <button key={b.type} className="lib-btn" onClick={() => addBlock(b.type)} title={b.desc}
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 8px", marginBottom: 3, background: "transparent", border: "1px solid transparent", borderRadius: 5, color: "#C4D0DE", cursor: "pointer", textAlign: "left", fontSize: 14, transition: "all 0.12s" }}>
                        <span style={{ width: 22, height: 22, background: "rgba(201,168,76,0.15)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, fontFamily: "monospace" }}>{b.icon}</span>
                        <span>{b.label}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, color: "#8DA4BE", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10, paddingLeft: 2 }}>Course Templates</div>
                {COURSE_TEMPLATES.map(tpl => (
                  <button key={tpl.id} onClick={() => loadTemplate(tpl)} className="lib-btn"
                    style={{ display: "flex", alignItems: "flex-start", gap: 8, width: "100%", padding: "8px 8px", marginBottom: 5, background: "transparent", border: "1px solid #1e2432", borderRadius: 6, color: "#C4D0DE", cursor: "pointer", textAlign: "left", fontSize: 13, transition: "all 0.12s" }}>
                    <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{tpl.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: "#E8E4DC" }}>{tpl.label}</div>
                      <div style={{ fontSize: 11, color: "#8DA4BE", lineHeight: 1.35 }}>{tpl.desc}</div>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Center: Canvas ── */}
        <div style={{ flex: 1, overflow: "auto", background: "#FAF6EE", padding: "28px 40px" }} onClick={() => setSelectedId(null)}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "80px 20px", color: "#D4CFC0", fontSize: 15 }}>Loading content…</div>
          ) : blocks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 20px", color: "#D4CFC0", border: "2px dashed #1a2030", borderRadius: 10 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>+</div>
              <div style={{ fontSize: 15 }}>Click a block type on the left to start building</div>
            </div>
          ) : null}
          {blocks.map((block, idx) => (
            <div key={block.id} className="blk-row"
              style={{ position: "relative", marginBottom: 6, borderRadius: 6, border: selectedId === block.id ? "2px solid #C9A84C" : "2px solid transparent", transition: "border-color 0.12s", cursor: "pointer" }}
              onClick={e => { e.stopPropagation(); setSelectedId(block.id); }}>

              {/* Block actions (hover reveal) */}
              <div className="blk-actions" style={{ position: "absolute", top: -14, right: 8, display: "flex", gap: 3, opacity: 0, transition: "opacity 0.15s", zIndex: 10 }}>
                {idx > 0 && <button onClick={e => { e.stopPropagation(); moveBlock(idx, -1); }}
                  style={{ padding: "2px 7px", background: "#F0EAD6", border: "1px solid #2a3848", borderRadius: 3, color: "#1A3668", cursor: "pointer", fontSize: 13 }}>↑</button>}
                {idx < blocks.length-1 && <button onClick={e => { e.stopPropagation(); moveBlock(idx, 1); }}
                  style={{ padding: "2px 7px", background: "#F0EAD6", border: "1px solid #2a3848", borderRadius: 3, color: "#1A3668", cursor: "pointer", fontSize: 13 }}>↓</button>}
                <button onClick={e => { e.stopPropagation(); duplicateBlock(block); }}
                  style={{ padding: "2px 8px", background: "#F0EAD6", border: "1px solid #2a3848", borderRadius: 3, color: "#1A3668", cursor: "pointer", fontSize: 13 }} title="Duplicate">⎘</button>
                <button onClick={e => { e.stopPropagation(); deleteBlock(block.id); }}
                  style={{ padding: "2px 7px", background: "#FEE2E2", border: "1px solid #4a2020", borderRadius: 3, color: "#B91C1C", cursor: "pointer", fontSize: 13 }} title="Delete">✕</button>
              </div>

              {/* Block type badge */}
              {selectedId === block.id && (
                <div style={{ position: "absolute", top: -13, left: 8, fontSize: 12, color: "#C9A84C", background: "#0B1D3A", border: "1px solid rgba(201,168,76,0.27)", padding: "1px 7px", borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{block.type}</div>
              )}

              <div style={{ padding: "4px 6px" }}>
                <BlockPreview block={block} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Right: Properties inspector ── */}
        <div style={{ width: 260, background: "#0B1D3A", borderLeft: "1px solid #1e2432", overflow: "auto", flexShrink: 0, padding: "16px 16px" }}>
          {selectedBlock ? (
            <BlockProperties
              block={selectedBlock}
              onChange={(data) => updateBlockData(selectedBlock.id, data)}
              token={token}
            />
          ) : (
            <div style={{ textAlign: "center", padding: "48px 16px", color: "#D4CFC0" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>☰</div>
              <div style={{ fontSize: 14 }}>Click a block on the canvas to edit its properties</div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}




// ── FacultyCalendar ────────────────────────────────────────────────────────
function FacultyCalendar({ courses }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [events, setEvents] = useState([]);
  const [expandedDay, setExpandedDay] = useState(null);

  useEffect(() => {
    if (!courses.length) return;
    Promise.all(courses.map(c =>
      fetch("https://api.lexcommons.org/api/assignments?course_id=" + c.id, {
        headers: { "Authorization": "Bearer " + (JSON.parse(localStorage.getItem("lc_user") || "{}").token || "") }
      }).then(r => r.json()).then(a => (Array.isArray(a) ? a : []).map(x => ({ ...x, courseTitle: c.title || c.name, courseCode: c.code, color: ["#0B1D3A","#2D5A8B","#5A3060","#2D6B4A","#6B3020"][c.id % 5] })))
      .catch(() => [])
    )).then(all => setEvents(all.flat().filter(e => e.due_date)));
  }, [courses.length]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAYS = ["S","M","T","W","T","F","S"];

  const eventsForDay = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    return events.filter(e => {
      const ed = new Date(e.due_date);
      return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth() && ed.getDate() === d.getDate();
    });
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); setExpandedDay(null); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); setExpandedDay(null); };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (day) => day && today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear;
  const expandedEvents = expandedDay ? eventsForDay(expandedDay) : [];

  return (
    <div style={{ background:"#fff", border:"1px solid " + C.border, borderRadius:10, padding:"14px 16px", marginBottom:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.text }}>📅 Calendar</div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <button onClick={prevMonth} style={{ background:"none", border:"1px solid " + C.border, borderRadius:5, padding:"2px 8px", cursor:"pointer", color:C.text, fontSize:12 }}>‹</button>
          <div style={{ fontSize:12, fontWeight:600, color:C.text, minWidth:110, textAlign:"center" }}>{MONTHS[viewMonth]} {viewYear}</div>
          <button onClick={nextMonth} style={{ background:"none", border:"1px solid " + C.border, borderRadius:5, padding:"2px 8px", cursor:"pointer", color:C.text, fontSize:12 }}>›</button>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1, marginBottom:2 }}>
        {DAYS.map((d,i) => <div key={i} style={{ fontSize:10, fontWeight:700, color:C.muted, textAlign:"center", padding:"2px 0" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1 }}>
        {cells.map((day, i) => {
          const dayEvents = day ? eventsForDay(day) : [];
          const expanded = expandedDay === day;
          return (
            <div key={i} onClick={() => day && setExpandedDay(expanded ? null : day)}
              style={{ height:32, padding:"2px 3px", borderRadius:4, background: isToday(day) ? C.navy : expanded ? "#EFF6FF" : day ? "#fafafa" : "transparent", border:"1px solid " + (day ? (expanded ? C.navy : C.border) : "transparent"), cursor: day ? "pointer" : "default" }}>
              {day && <>
                <div style={{ fontSize:10, fontWeight: isToday(day) ? 700 : 400, color: isToday(day) ? "#fff" : C.text }}>{day}</div>
                <div style={{ display:"flex", gap:1, flexWrap:"wrap" }}>
                  {dayEvents.slice(0,3).map((e,j) => <div key={j} style={{ width:4, height:4, borderRadius:"50%", background: e.color || C.navy }} />)}
                </div>
              </>}
            </div>
          );
        })}
      </div>
      {expandedDay && (
        <div style={{ marginTop:10, borderTop:"1px solid " + C.border, paddingTop:10 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:6 }}>
            {MONTHS[viewMonth]} {expandedDay} — {expandedEvents.length === 0 ? "No events" : expandedEvents.length + " event" + (expandedEvents.length !== 1 ? "s" : "")}
          </div>
          {expandedEvents.length === 0
            ? <div style={{ fontSize:12, color:C.muted }}>Nothing due.</div>
            : expandedEvents.map((e,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:"#f8f9fa", borderRadius:6, borderLeft:"3px solid " + (e.color || C.navy), marginBottom:4 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{e.title}</div>
                    <div style={{ fontSize:11, color:C.muted }}>{e.courseCode ? e.courseCode + " · " : ""}{e.courseTitle} · {e.points}pts</div>
                  </div>
                  <div style={{ fontSize:10, color:C.muted }}>{e.type || "Assignment"}</div>
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}

function Dashboard({ user, courses, onSelectCourse }) {
  const DEFAULT_WIDGETS = [
    { id: "stats",    label: "Stats",        visible: true },
    { id: "quicklinks", label: "Quick Links", visible: true },
    { id: "calendar",  label: "Calendar",    visible: true },
    { id: "courses",   label: "Your Courses", visible: true },
  ];

  const [editing, setEditing] = useState(false);
  const [widgets, setWidgets] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("lc_user") || "{}");
      const saved = u.preferences?.dashboard_layout;
      if (saved && Array.isArray(saved)) return saved;
    } catch(e) {}
    return DEFAULT_WIDGETS;
  });

  const saveLayout = async (newWidgets) => {
    setWidgets(newWidgets);
    try {
      const u = JSON.parse(localStorage.getItem("lc_user") || "{}");
      if (!u.id || !u.token) return;
      await fetch("https://api.lexcommons.org/api/users/" + u.id + "/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + u.token },
        body: JSON.stringify({ dashboard_layout: newWidgets })
      });
    } catch(e) {}
  };

  const toggleWidget = (id) => {
    const updated = widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
    saveLayout(updated);
  };

  const moveWidget = (id, dir) => {
    const idx = widgets.findIndex(w => w.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= widgets.length) return;
    const updated = [...widgets];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    saveLayout(updated);
  };

  const isVisible = (id) => widgets.find(w => w.id === id)?.visible !== false;

  const QUICK_LINKS = [
    { icon:"👥", label:"HR", desc:"People & payroll", href:"#" },
    { icon:"🛠", label:"Service", desc:"IT & facilities", href:"#" },
    { icon:"📋", label:"Submit a Request", desc:"Forms & approvals", href:"#" },
  ];

  const WIDGET_RENDERERS = {
    stats: () => isVisible("stats") && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[{ label: "Active Courses", value: courses.length, color: C.navy }, { label: "Total Students", value: "--", color: C.blue }, { label: "Pending Grades", value: "--", color: "#8B4558" }].map(s => (
          <Card key={s.label} style={{ padding: 16 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>
    ),
    quicklinks: () => isVisible("quicklinks") && (
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
        {QUICK_LINKS.map(card => (
          <a key={card.label} href={card.href} style={{ textDecoration:"none" }}>
            <Card style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", cursor:"pointer" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
              <div style={{ fontSize:22 }}>{card.icon}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{card.label}</div>
                <div style={{ fontSize:11, color:C.muted }}>{card.desc}</div>
              </div>
            </Card>
          </a>
        ))}
      </div>
    ),
    calendar: () => isVisible("calendar") && <FacultyCalendar courses={courses} />,
    courses: () => isVisible("courses") && (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 12 }}>Your Courses</div>
        {courses.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 40, color: C.muted }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No courses yet</div>
            <div style={{ fontSize: 13 }}>Go to My Courses to create your first course.</div>
          </Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {courses.map(c => { const colors = ["#0B1D3A","#2D5A8B","#5A3060","#2D6B4A","#6B3020"]; const color = colors[c.id % colors.length]; return (
              <Card key={c.id} as="button" style={{ padding: 0, overflow: "hidden", cursor: "pointer", width: "100%", textAlign: "left", background: C.surface, border: "1px solid " + C.border, borderRadius: 10, position: "relative", minHeight: 110 }} onClick={() => onSelectCourse && onSelectCourse(c)}>
                {c.cover_image && <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${c.cover_image})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.15, borderRadius: 10 }} />}
                <div style={{ height: 6, background: color, position: "relative" }} />
                <div style={{ padding: 16, position: "relative" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{c.code || "COURSE"}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: c.description ? 5 : 0 }}>{c.title || c.name}</div>
                  {c.description && <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{c.description}</div>}
                </div>
              </Card>
            ); })}
          </div>
        )}
      </div>
    ),
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Welcome, {user.name.split(" ")[0]}</div>
          <div style={{ color: C.muted, fontSize: 14, marginTop: 2 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
        </div>
        <button onClick={() => setEditing(e => !e)} style={{ padding:"6px 14px", background: editing ? C.navy : "#fff", color: editing ? "#fff" : C.text, border:"1px solid " + C.border, borderRadius:7, fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
          {editing ? "✓ Done" : "✏️ Edit Dashboard"}
        </button>
      </div>

      {/* Edit mode panel */}
      {editing && (
        <Card style={{ marginBottom:16, background:C.linen, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:12 }}>Customize Dashboard</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {widgets.map((w, i) => (
              <div key={w.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"#fff", borderRadius:8, border:"1px solid " + C.border }}>
                <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                  <button onClick={() => moveWidget(w.id, -1)} disabled={i === 0} style={{ background:"none", border:"none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? C.border : C.muted, fontSize:11, padding:0, lineHeight:1 }}>▲</button>
                  <button onClick={() => moveWidget(w.id, 1)} disabled={i === widgets.length - 1} style={{ background:"none", border:"none", cursor: i === widgets.length - 1 ? "default" : "pointer", color: i === widgets.length - 1 ? C.border : C.muted, fontSize:11, padding:0, lineHeight:1 }}>▼</button>
                </div>
                <div style={{ flex:1, fontSize:13, fontWeight:600, color:C.text }}>{w.label}</div>
                <button onClick={() => toggleWidget(w.id)} style={{ padding:"4px 12px", background: w.visible ? C.navy : "#fff", color: w.visible ? "#fff" : C.muted, border:"1px solid " + (w.visible ? C.navy : C.border), borderRadius:6, fontSize:12, cursor:"pointer", fontWeight:600 }}>
                  {w.visible ? "Visible" : "Hidden"}
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Widgets rendered in order */}
      {widgets.map(w => (
        <div key={w.id}>
          {WIDGET_RENDERERS[w.id] && WIDGET_RENDERERS[w.id]()}
        </div>
      ))}
    </div>
  );
}


// ── AssignmentCardList ─────────────────────────────────────────────────────
function AssignmentCardList({ assignments, onSelect, onOpenSettings, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const TYPE_LABELS = {
    assignment: "Assignment", quiz: "Quiz", essay: "Essay",
    memo: "Memo", trial_memo: "Trial Memo", appellate_brief: "Appellate Brief",
    contract: "Contract", draft: "Draft", research: "Research",
    video_presentation: "Video Presentation", collaboration: "Collaboration",
    poll: "Poll", survey: "Survey"
  };

  const TYPE_EMOJI = {
    assignment: "Assignment", quiz: "Quiz", essay: "Essay",
    memo: "Memo", trial_memo: "Trial Memo", appellate_brief: "Brief",
    contract: "Contract", draft: "Draft", research: "Research",
    video_presentation: "Video", collaboration: "Collaboration",
    poll: "Poll", survey: "Survey"
  };

  const startEdit = (e, a) => {
    e.stopPropagation();
    setEditingId(a.id);
    setEditForm({
      title: a.title,
      description: a.description || "",
      due_date: a.due_date ? a.due_date.slice(0, 16) : "",
      points: a.points,
      type: a.type || "assignment"
    });
  };

  const cancelEdit = (e) => {
    if (e) e.stopPropagation();
    setEditingId(null);
  };

  const deleteAssignment = async (e, a) => {
    e.stopPropagation();
    if (!window.confirm('Delete "' + a.title + '"? This will also delete all submissions.')) return;
    try {
      await api("/api/assignments/" + a.id, { method: "DELETE" });
      if (typeof onDelete === 'function') onDelete(a.id);
    } catch (err) { alert(err.message); }
  };

  const saveEdit = async (e, a) => {
    e.stopPropagation();
    setSaving(true);
    try {
      await api("/api/assignments/" + a.id, {
        method: "PUT",
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          due_date: editForm.due_date || null,
          points: parseInt(editForm.points) || 100,
          type: editForm.type
        })
      });
      Object.assign(a, {
        title: editForm.title,
        description: editForm.description,
        due_date: editForm.due_date || null,
        points: parseInt(editForm.points) || 100,
        type: editForm.type
      });
      setEditingId(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {assignments.map(a => {
        const isEditing = editingId === a.id;
        const typeBadge = a.type && a.type !== "assignment" ? (TYPE_EMOJI[a.type] || a.type) : null;
        return (
          <Card key={a.id} style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{ padding: 14, cursor: isEditing ? "default" : "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
              onClick={() => !isEditing && onSelect(a)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{a.title}</span>
                  {typeBadge && (
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: "#f0f4ff", color: C.navy, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {typeBadge}
                    </span>
                  )}
                </div>
                {a.due_date && !isEditing && (
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    Due {new Date(a.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                )}
                {a.description && !isEditing && (
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{a.description}</div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 12, flexShrink: 0 }}>
                <Badge label={a.points + " pts"} color={C.navy} />
                <button
                  onClick={(e) => isEditing ? cancelEdit(e) : startEdit(e, a)}
                  title={isEditing ? "Cancel" : "Edit assignment"}
                  style={{ padding: "4px 8px", background: "none", border: "1px solid " + C.border, borderRadius: 6, cursor: "pointer", fontSize: 12, color: C.muted, lineHeight: 1 }}
                >
                  {isEditing ? "x" : "Edit"}
                </button>
                {!isEditing && (
                  <button
                    onClick={(e) => deleteAssignment(e, a)}
                    title="Delete assignment"
                    style={{ padding: "4px 8px", background: "none", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "#B91C1C", lineHeight: 1 }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            {isEditing && (
              <div
                style={{ borderTop: "1px solid " + C.border, background: "#fafaf8", padding: 16 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Title</label>
                    <input
                      value={editForm.title}
                      onChange={(e) => setEditForm(p => ({ ...p, title: e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Type</label>
                    <select
                      value={editForm.type}
                      onChange={(e) => setEditForm(p => ({ ...p, type: e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13, fontFamily: "inherit" }}
                    >
                      {Object.entries(TYPE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Points</label>
                    <input
                      type="number"
                      value={editForm.points}
                      onChange={(e) => setEditForm(p => ({ ...p, points: e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Due Date</label>
                    <input
                      type="datetime-local"
                      value={editForm.due_date}
                      onChange={(e) => setEditForm(p => ({ ...p, due_date: e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm(p => ({ ...p, description: e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13, minHeight: 72, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={(e) => saveEdit(e, a)}
                      disabled={saving || !editForm.title.trim()}
                      style={{ padding: "6px 16px", background: C.gold, color: C.navy, border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{ padding: "6px 12px", background: "#eee", color: C.muted, border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingId(null); onOpenSettings(a); }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.navy, textDecoration: "underline" }}
                  >
                    Advanced Settings
                  </button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ── AssignmentDetail ───────────────────────────────────────────────────────
function AssignmentDetail({ assignment, courseId, courseOutcomes = [], students, user, onBack, defaultTab }) {
  const [tab, setTab] = useState(defaultTab || "submissions");
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState(null);
  const [gradeVal, setGradeVal] = useState("");
  const [feedbackVal, setFeedbackVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ title: assignment.title, description: assignment.description || "", due_date: assignment.due_date ? assignment.due_date.slice(0,16) : "", points: assignment.points, type: assignment.type || "assignment" });
  const [outcomes, setOutcomes] = useState([]);
  const [quizQuestions, setQuizQuestions] = useState(Array.isArray(assignment.questions) ? assignment.questions : []);

  useEffect(() => {
    setLoading(true);
    api("/api/assignments/" + assignment.id + "/submissions")
      .then(r => setSubmissions(Array.isArray(r) ? r : []))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
    api("/api/assignments/" + assignment.id + "/outcomes")
      .then(r => setOutcomes(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, [assignment.id]);

  const getSubForStudent = (sid) => submissions.find(s => s.student_id === sid || s.user_id === sid);

  const saveGrade = async (subId) => {
    setSaving(true);
    try {
      await api("/api/submissions/" + subId + "/grade", {
        method: "PUT",
        body: JSON.stringify({ grade: parseFloat(gradeVal), feedback: feedbackVal })
      });
      setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, grade: parseFloat(gradeVal), feedback: feedbackVal } : s));
      setGradingId(null);
    } catch(e) { alert(e.message); } finally { setSaving(false); }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api("/api/assignments/" + assignment.id, {
        method: "PUT",
        body: JSON.stringify({ title: form.title, description: form.description, due_date: form.due_date || null, points: parseInt(form.points) || 100, type: form.type, questions: form.type === "quiz" ? quizQuestions : undefined })
      });
      Object.assign(assignment, { title: form.title, description: form.description, due_date: form.due_date, points: parseInt(form.points) || 100, type: form.type });
      setEditMode(false);
    } catch(e) { alert(e.message); } finally { setSaving(false); }
  };

  const addOutcome = async (co) => {
    try {
      const o = await api("/api/assignments/" + assignment.id + "/outcomes", { method: "POST", body: JSON.stringify({ outcome_id: co.id }) });
      setOutcomes(prev => [...prev, o]);
    } catch (e) { alert(e.message); }
  };

  const removeOutcome = async (outcomeId) => {
    try {
      await api("/api/assignments/" + assignment.id + "/outcomes/" + outcomeId, { method: "DELETE" });
      setOutcomes(prev => prev.filter(o => o.id !== outcomeId));
    } catch (e) { alert(e.message); }
  };

  const submitted = submissions.length;
  const graded = submissions.filter(s => s.grade != null).length;
  const avg = graded > 0 ? Math.round(submissions.filter(s => s.grade != null).reduce((a,s) => a + s.grade, 0) / graded) : null;

  const TABS = [
    { id: "submissions", label: "Submissions (" + submitted + ")" },
    { id: "settings",    label: "Settings" },
    { id: "outcomes",    label: "Outcomes (" + outcomes.length + ")" },
  ];

  const statusBadge = (sub) => {
    if (!sub) return <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:4, fontSize:11, fontWeight:700, background:"#f0f0f0", color:C.muted, letterSpacing:"0.04em" }}>NOT SUBMITTED</span>;
    if (sub.grade != null) return <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:4, fontSize:11, fontWeight:700, background:"#e6f4ea", color:"#2d6b4a", letterSpacing:"0.04em" }}>GRADED</span>;
    return <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:4, fontSize:11, fontWeight:700, background:"#fff3cd", color:"#856404", letterSpacing:"0.04em" }}>SUBMITTED</span>;
  };

  return (
    <div>
      <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, fontSize:13, marginBottom:16, padding:0 }}>
        ‹ Back to Assignments
      </button>
      <div style={{ background:"#fff", border:"1px solid " + C.border, borderRadius:10, marginBottom:20, overflow:"hidden" }}>
        <div style={{ background:C.navy, padding:"20px 24px" }}>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.6)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Assignment</div>
          <div style={{ fontSize:22, fontWeight:700, color:"#fff", marginBottom:8 }}>{form.title || assignment.title}</div>
          <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
            {assignment.due_date && (
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.75)" }}>📅 Due {new Date(assignment.due_date).toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" })}</div>
            )}
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.75)" }}>🎯 {assignment.points} pts</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.75)" }}>📬 {submitted} submitted · {graded} graded{avg != null ? " · Avg " + avg + "%" : ""}</div>
          </div>
        </div>
        <div style={{ display:"flex", borderBottom:"1px solid " + C.border, background:"#fafafa" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:"12px 20px", background:"none", border:"none", borderBottom: tab===t.id ? "2px solid " + C.navy : "2px solid transparent", color: tab===t.id ? C.navy : C.muted, fontSize:13, fontWeight: tab===t.id ? 700 : 400, cursor:"pointer", marginBottom:-1 }}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab === "submissions" && (
        <div style={{ background:"#fff", border:"1px solid " + C.border, borderRadius:10, overflow:"hidden" }}>
          {loading ? (
            <div style={{ padding:40, textAlign:"center", color:C.muted }}>Loading submissions...</div>
          ) : students.length === 0 ? (
            <div style={{ padding:40, textAlign:"center", color:C.muted }}>No students enrolled yet.</div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#f7f7f5" }}>
                  {["Student","Status","Action"].map(h => (
                    <th key={h} style={{ padding:"10px 16px", textAlign: h==="Grade"||h==="Action" ? "center" : "left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1px solid " + C.border }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s, si) => {
                  const sub = getSubForStudent(s.id);
                  const isGrading = gradingId === sub?.id;
                  return (
                    <React.Fragment key={s.id}>
                      <tr style={{ background: si%2===0?"#fff":"#fafaf8", borderBottom: isGrading ? "none" : "1px solid " + C.border }}>
                        <td style={{ padding:"12px 16px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <div style={{ width:32, height:32, borderRadius:"50%", background:C.navy, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13 }}>
                              {s.first_name?.[0]}{s.last_name?.[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight:600, color:C.text }}>{s.first_name} {s.last_name}</div>
                              <div style={{ fontSize:11, color:C.muted }}>{s.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:"12px 16px" }}>
                          {statusBadge(sub)}
                          {sub?.grade != null && (
                            <span style={{ marginLeft:8, fontSize:12, fontWeight:700, color:C.green }}>{sub.grade}/{assignment.points}</span>
                          )}
                        </td>
                        <td style={{ padding:"12px 16px", textAlign:"center" }}>
                          {sub ? (
                            <button onClick={() => {
                              if (isGrading) { setGradingId(null); }
                              else { setGradingId(sub.id); setGradeVal(sub.grade ?? ""); setFeedbackVal(sub.feedback ?? ""); }
                            }} style={{ padding:"5px 14px", borderRadius:6, border:"1px solid " + C.border, background: isGrading ? C.navy : "#fff", color: isGrading ? "#fff" : C.navy, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                              {isGrading ? "✕ Close" : sub.grade != null ? "✏️ Re-grade" : "📝 Grade"}
                            </button>
                          ) : <span style={{ fontSize:12, color:C.border }}>—</span>}
                        </td>
                      </tr>
                      {isGrading && sub && (
                        <tr style={{ borderBottom:"1px solid " + C.border }}>
                          <td colSpan={3} style={{ padding:"0 16px 16px" }}>
                            <GradingFeedbackPanel
                              submission={{ ...sub, content: sub.content || sub.text || sub.response || "" }}
                              assignmentTitle={assignment.title}
                              gradeVal={gradeVal}
                              feedbackVal={feedbackVal}
                              setGradeVal={setGradeVal}
                              setFeedbackVal={setFeedbackVal}
                              saving={saving}
                              onSave={() => saveGrade(sub.id)}
                              onCancel={() => setGradingId(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div style={{ background:"#fff", border:"1px solid " + C.border, borderRadius:10, padding:24 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.text }}>Assignment Settings</div>
            {!editMode && <button onClick={() => setEditMode(true)} style={{ padding:"6px 16px", background:C.gold, color:C.navy, border:"none", borderRadius:6, fontSize:13, fontWeight:700, cursor:"pointer" }}>Edit</button>}
          </div>
          {editMode ? (
            <div>
              <div style={{ marginBottom:14 }}><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Title</label><input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} style={{ width:"100%", padding:"9px 12px", border:"1px solid "+C.border, borderRadius:6, fontSize:14, boxSizing:"border-box" }} /></div>
              <div style={{ marginBottom:14 }}><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Description / Instructions</label><textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} style={{ width:"100%", padding:"9px 12px", border:"1px solid "+C.border, borderRadius:6, fontSize:14, minHeight:100, resize:"vertical", boxSizing:"border-box", fontFamily:"inherit" }} /></div>
              {form.type === "quiz" && (
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>Quiz Questions</label>
                <QuizBuilder questions={quizQuestions} setQuestions={setQuizQuestions} />
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
                <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Due Date</label><input type="datetime-local" value={form.due_date} onChange={e=>setForm(p=>({...p,due_date:e.target.value}))} style={{ width:"100%", padding:"9px 12px", border:"1px solid "+C.border, borderRadius:6, fontSize:14, boxSizing:"border-box" }} /></div>
                <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Points</label><input type="number" value={form.points} onChange={e=>setForm(p=>({...p,points:e.target.value}))} style={{ width:"100%", padding:"9px 12px", border:"1px solid "+C.border, borderRadius:6, fontSize:14, boxSizing:"border-box" }} /></div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={saveSettings} disabled={saving} style={{ padding:"8px 20px", background:C.gold, color:C.navy, border:"none", borderRadius:6, fontSize:13, fontWeight:700, cursor:"pointer" }}>{saving?"Saving...":"Save Changes"}</button>
                <button onClick={() => setEditMode(false)} style={{ padding:"8px 16px", background:"#eee", color:C.muted, border:"none", borderRadius:6, fontSize:13, cursor:"pointer" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display:"grid", gap:0 }}>
              {[["Title", form.title || assignment.title], ["Description", assignment.description || "—"], ["Due Date", assignment.due_date ? new Date(assignment.due_date).toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" }) : "No due date"], ["Points", assignment.points + " pts"],
              ...(form.type === "quiz" ? [["Questions", quizQuestions.length + " question" + (quizQuestions.length !== 1 ? "s" : "")]] : [])].map(([label, val]) => (
                <div key={label} style={{ display:"grid", gridTemplateColumns:"160px 1fr", gap:8, padding:"12px 0", borderBottom:"1px solid " + C.border }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.06em", paddingTop:2 }}>{label}</div>
                  <div style={{ fontSize:14, color:C.text, whiteSpace:"pre-wrap" }}>{val}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "outcomes" && (
        <div style={{ background:"#fff", border:"1px solid " + C.border, borderRadius:10, overflow:"hidden" }}>
          {courseOutcomes.length === 0 ? (
            <div style={{ padding:40, textAlign:"center", color:C.muted }}><div style={{ fontWeight:600, marginBottom:4 }}>No course outcomes</div><div style={{ fontSize:13 }}>Add outcomes to this course first from the course Outcomes tab.</div></div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr style={{ background:"#f7f7f5" }}>{["Outcome","ABA Standard","Category",""].map(h => <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1px solid "+C.border }}>{h}</th>)}</tr></thead>
              <tbody>{courseOutcomes.map((co, i) => {
                const mapped = outcomes.some(o => o.id === co.id);
                return (
                  <tr key={co.id} style={{ background:i%2===0?"#fff":"#fafaf8", borderBottom:"1px solid "+C.border }}>
                    <td style={{ padding:"12px 16px", color:C.text }}>{co.text}</td>
                    <td style={{ padding:"12px 16px" }}>{co.aba_standard ? <span style={{ background:"#e8edf5", color:C.navy, padding:"2px 8px", borderRadius:4, fontSize:11, fontWeight:700 }}>{co.aba_standard}</span> : <span style={{ color:C.border }}>—</span>}</td>
                    <td style={{ padding:"12px 16px", color:C.muted, fontSize:12 }}>{co.category || "—"}</td>
                    <td style={{ padding:"12px 16px", textAlign:"right" }}>
                      {mapped
                        ? <button onClick={() => removeOutcome(co.id)} style={{ padding:"4px 10px", background:"none", border:"1px solid #fca5a5", borderRadius:6, fontSize:12, color:"#B91C1C", cursor:"pointer" }}>Remove</button>
                        : <button onClick={() => addOutcome(co)} style={{ padding:"4px 10px", background:C.navy, border:"none", borderRadius:6, fontSize:12, color:"#fff", cursor:"pointer" }}>+ Map</button>
                      }
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── QuizBuilder ───────────────────────────────────────────────────────────


function GradingFeedbackPanel({submission, assignmentTitle, gradeVal, feedbackVal, setGradeVal, setFeedbackVal, saving, onSave, onCancel}) {
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function getAiFeedback() {
    setLoadingAi(true);
    setAiSuggestion(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a law professor grading a student submission. Assignment: "${assignmentTitle}". Student answer: "${submission.content || submission.text || "(no text content)"}". Grade given: ${gradeVal || "not yet graded"}/100. Write brief, constructive grading feedback (3-5 sentences) focused on legal reasoning quality, citation accuracy, and writing clarity. Be encouraging but honest.`
          }]
        })
      });
      const data = await res.json();
      const suggestion = data.content?.[0]?.text || "Could not generate suggestion.";
      setAiSuggestion(suggestion);
    } catch(e) {
      setAiSuggestion("Error generating AI feedback. Check API connection.");
    }
    setLoadingAi(false);
  }

  function acceptAiSuggestion() {
    setFeedbackVal(aiSuggestion);
    setConfirmed(true);
    setAiSuggestion(null);
  }

  function editAiSuggestion() {
    setFeedbackVal(aiSuggestion);
    setAiSuggestion(null);
  }

  const C2 = {navy:"#0b1d3a", gold:"#c9a84c", border:"#e2e4e9", muted:"#6b7280"};

  return (
    <div style={{border:"1px solid "+C2.border,borderRadius:8,padding:16,marginTop:12,background:"#fafafa"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontSize:13,fontWeight:700,color:C2.navy}}>📝 Grade & Feedback</span>
        {confirmed&&<span style={{fontSize:11,color:"#065f46",background:"#d1fae5",padding:"2px 8px",borderRadius:10,fontWeight:700}}>✓ AI feedback accepted</span>}
      </div>

      {/* Grade input */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <label style={{fontSize:12,color:C2.muted,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap"}}>Grade</label>
        <input type="number" min="0" max="100" value={gradeVal} onChange={e=>setGradeVal(e.target.value)}
          style={{width:70,padding:"6px 10px",border:"1px solid "+C2.border,borderRadius:6,fontSize:14,fontWeight:700,textAlign:"center"}}/>
        <span style={{fontSize:13,color:C2.muted}}> / 100</span>
      </div>

      {/* Professor feedback textarea */}
      <div style={{marginBottom:10}}>
        <label style={{fontSize:12,color:C2.muted,textTransform:"uppercase",letterSpacing:"0.05em",display:"block",marginBottom:5}}>Feedback to Student</label>
        <textarea value={feedbackVal} onChange={e=>{setFeedbackVal(e.target.value);setConfirmed(false);}} rows={4}
          placeholder="Write feedback for the student..."
          style={{width:"100%",padding:"8px 10px",border:"1px solid "+C2.border,borderRadius:6,fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
      </div>

      {/* AI suggestion panel */}
      {aiSuggestion&&(
        <div style={{border:"1px solid #c9a84c",borderRadius:8,padding:12,marginBottom:10,background:"#fffbf0"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
            <span style={{fontSize:12,fontWeight:700,color:"#92400e"}}>✨ AI Suggested Feedback</span>
            <span style={{fontSize:11,color:"#92400e",opacity:0.7}}>(review before using)</span>
          </div>
          <p style={{fontSize:13,lineHeight:1.6,color:"#1f2937",margin:"0 0 10px",whiteSpace:"pre-wrap"}}>{aiSuggestion}</p>
          <div style={{display:"flex",gap:8}}>
            <button type="button" onClick={acceptAiSuggestion}
              style={{padding:"5px 14px",borderRadius:6,border:"none",background:C2.navy,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              ✓ Use This
            </button>
            <button type="button" onClick={editAiSuggestion}
              style={{padding:"5px 14px",borderRadius:6,border:"1px solid "+C2.border,background:"#fff",fontSize:12,cursor:"pointer"}}>
              ✏️ Edit First
            </button>
            <button type="button" onClick={()=>setAiSuggestion(null)}
              style={{padding:"5px 14px",borderRadius:6,border:"1px solid "+C2.border,background:"#fff",fontSize:12,cursor:"pointer",color:C2.muted}}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button type="button" onClick={onSave} disabled={saving}
          style={{padding:"7px 18px",borderRadius:6,border:"none",background:C2.navy,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          Save Grade & Feedback
        </button>
        <button type="button" onClick={getAiFeedback} disabled={loadingAi}
          style={{padding:"7px 14px",borderRadius:6,border:"1px solid "+C2.gold,background:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",color:C2.navy,opacity:loadingAi?0.6:1,display:"flex",alignItems:"center",gap:5}}>
          {loadingAi?"⏳ Thinking...":"✨ Get AI Feedback Suggestion"}
        </button>
      </div>
    </div>
  );
}

function MediaRecorderWidget({qId, recorded, onSave}) {
  const [stream, setStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const [chunks, setChunks] = useState([]);
  const [blobUrl, setBlobUrl] = useState(recorded||null);
  const [mediaType, setMediaType] = useState("video"); // video or audio
  const [error, setError] = useState(null);
  const videoRef = React.useRef(null);
  const recorderRef = React.useRef(null);

  async function startRecording() {
    try {
      setError(null);
      const constraints = mediaType === "video"
        ? {video:true, audio:true}
        : {audio:true};
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(s);
      if (videoRef.current && mediaType === "video") {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }
      const rec = new MediaRecorder(s);
      const localChunks = [];
      rec.ondataavailable = e => { if(e.data.size>0) localChunks.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(localChunks, {type: mediaType==="video"?"video/webm":"audio/webm"});
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        onSave(url);
        s.getTracks().forEach(t=>t.stop());
        setStream(null);
        if(videoRef.current) videoRef.current.srcObject = null;
      };
      recorderRef.current = rec;
      setChunks(localChunks);
      rec.start();
      setRecording(true);
    } catch(err) {
      setError("Camera/mic access denied. Please allow access in browser settings.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function clearRecording() {
    setBlobUrl(null);
    onSave(null);
  }

  return (
    <div style={{marginBottom:8}}>
      {/* Type selector */}
      <div style={{display:"flex",gap:8,marginBottom:8}}>
        {[["video","📹 Camera + Mic"],["audio","🎙️ Audio Only"]].map(([t,label])=>(
          <label key={t} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,cursor:"pointer",padding:"3px 8px",borderRadius:6,border:"1px solid "+(mediaType===t?"#0b1d3a":"#ddd"),background:mediaType===t?"#eef1f8":"#fff",fontWeight:mediaType===t?700:400}}>
            <input type="radio" checked={mediaType===t} onChange={()=>setMediaType(t)} style={{display:"none"}}/>
            {label}
          </label>
        ))}
      </div>
      {/* Live preview while recording */}
      {recording&&mediaType==="video"&&(
        <video ref={videoRef} muted style={{width:"100%",maxHeight:180,borderRadius:6,border:"2px solid #ef4444",marginBottom:6,background:"#000"}}/>
      )}
      {recording&&mediaType==="audio"&&(
        <div style={{padding:12,borderRadius:6,border:"2px solid #ef4444",marginBottom:6,background:"#fff5f5",textAlign:"center",fontSize:13,color:"#ef4444",fontWeight:700}}>
          🔴 Recording audio...
        </div>
      )}
      {/* Playback of saved recording */}
      {blobUrl&&!recording&&(
        <div style={{marginBottom:8}}>
          {mediaType==="video"
            ? <video src={blobUrl} controls style={{width:"100%",maxHeight:180,borderRadius:6,border:"1px solid #ddd"}}/>
            : <audio src={blobUrl} controls style={{width:"100%"}}/>
          }
        </div>
      )}
      {error&&<p style={{fontSize:12,color:"#ef4444",margin:"0 0 6px"}}>{error}</p>}
      {/* Controls */}
      <div style={{display:"flex",gap:8}}>
        {!recording&&!blobUrl&&(
          <button type="button" onClick={startRecording} style={{padding:"6px 14px",borderRadius:6,border:"none",background:"#ef4444",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>
            🔴 Start Recording
          </button>
        )}
        {recording&&(
          <button type="button" onClick={stopRecording} style={{padding:"6px 14px",borderRadius:6,border:"none",background:"#0b1d3a",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>
            ⏹ Stop
          </button>
        )}
        {blobUrl&&!recording&&(
          <>
            <button type="button" onClick={startRecording} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #ddd",background:"#fff",fontSize:12,cursor:"pointer"}}>
              🔄 Re-record
            </button>
            <button type="button" onClick={clearRecording} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #ddd",background:"#fff",fontSize:12,cursor:"pointer",color:"#999"}}>
              🗑 Clear
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function QuizBuilder({questions,setQuestions}){
  const C={ navy: "#0B1D3A", gold: "#C9A84C", linen: "#F4F0E8", surface: "#FFFFFF", border: "#E2DDD4", text: "#1A1A2E", muted: "#6B7B8D", green: "#2D8B55", red: "#B91C1C", blue: "#1A66CC" };
  const TYPE_LABELS={mc:"Multiple Choice",multi:"Multiple Response (Select All)",tf:"True / False",sa:"Short Answer",numerical:"Numerical / Formula",matching:"Matching",sequence:"Drag & Drop / Sequence",hotspot:"Hotspot",media:"Image / Video",youtube:"YouTube"};
  const TYPE_ICONS={mc:"🔘",multi:"☑️",tf:"⚖️",sa:"✏️",numerical:"🔢",matching:"🔗",sequence:"↕️",hotspot:"🎯",media:"🖼️",youtube:"▶️"};
  function makeQ(type){
    const base={id:Date.now()+Math.random(),type,text:"",points:10,required:true};
    if(type==="mc")return{...base,options:["","","",""],correct:0};
    if(type==="multi")return{...base,options:["","","",""],correct:[]};
    if(type==="tf")return{...base,correct:true};
    if(type==="sa")return{...base,sample:""};
    if(type==="numerical")return{...base,answer:"",tolerance:""};
    if(type==="matching")return{...base,pairs:[{left:"",right:""},{left:"",right:""}]};
    if(type==="sequence")return{...base,items:["","","",""]};
    if(type==="hotspot")return{...base,imageUrl:"",coords:null};
    if(type==="media")return{...base,mediaUrl:"",mediaType:"image"};
    if(type==="youtube")return{...base,videoUrl:"",startAt:""};
    return base;
  }
  function addQ(type){setQuestions(qs=>[...qs,makeQ(type)]);}
  function removeQ(id){setQuestions(qs=>qs.filter(q=>q.id!==id));}
  function updateQ(id,field,val){setQuestions(qs=>qs.map(q=>q.id===id?{...q,[field]:val}:q));}
  function updateOption(id,idx,val){setQuestions(qs=>qs.map(q=>{if(q.id!==id)return q;const options=[...q.options];options[idx]=val;return{...q,options};}));}
  function updatePair(id,pIdx,side,val){setQuestions(qs=>qs.map(q=>{if(q.id!==id)return q;const pairs=q.pairs.map((p,i)=>i===pIdx?{...p,[side]:val}:p);return{...q,pairs};}));}
  function addPair(id){setQuestions(qs=>qs.map(q=>q.id===id?{...q,pairs:[...q.pairs,{left:"",right:""}]}:q));}
  function updateItem(id,idx,val){setQuestions(qs=>qs.map(q=>{if(q.id!==id)return q;const items=[...q.items];items[idx]=val;return{...q,items};}));}
  function addItem(id){setQuestions(qs=>qs.map(q=>q.id===id?{...q,items:[...q.items,""]}:q));}
  function toggleMulti(id,idx){setQuestions(qs=>qs.map(q=>{if(q.id!==id)return q;const correct=(q.correct||[]).includes(idx)?q.correct.filter(i=>i!==idx):[...q.correct,idx];return{...q,correct};}));}
  const totalPts=questions.reduce((s,q)=>s+(Number(q.points)||0),0);
  const fs={width:"100%",padding:"7px 10px",border:"1px solid "+C.border,borderRadius:6,fontSize:13,fontFamily:"inherit",boxSizing:"border-box"};
  const pill=(active,label,onClick)=>(
    <button onClick={onClick} style={{padding:"3px 10px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,transition:"all 0.15s",background:active?"#d1fae5":"#f3f4f6",color:active?"#065f46":"#6b7280"}}>{label}</button>
  );
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Quiz Questions</span>
        <span style={{fontSize:12,color:totalPts===100?"#065f46":C.muted,fontWeight:700}}>{totalPts} / 100 pts</span>
      </div>
      {questions.map((q,qi)=>(
        <div key={q.id} style={{border:"1px solid "+C.border,borderRadius:8,padding:14,marginBottom:10,background:"#fafafa"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
            <span style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{TYPE_ICONS[q.type]} Q{qi+1} · {TYPE_LABELS[q.type]}</span>
            <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
              {pill(q.required!==false,q.required!==false?"✓ Required":"Optional",()=>updateQ(q.id,"required",!q.required))}
              <input type="number" value={q.points} onChange={e=>updateQ(q.id,"points",+e.target.value)} style={{width:60,padding:"4px 8px",border:"1px solid "+C.border,borderRadius:6,fontSize:13,textAlign:"center"}}/>
              <span style={{fontSize:11,color:C.muted}}>pts</span>
              <button onClick={()=>removeQ(q.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:18,lineHeight:1}}>×</button>
            </div>
          </div>
          {!["media","youtube","hotspot"].includes(q.type)&&(
            <textarea value={q.text} onChange={e=>updateQ(q.id,"text",e.target.value)} placeholder="Question text..." rows={2} style={{...fs,resize:"vertical",marginBottom:10}}/>
          )}
          {q.type==="mc"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {q.options.map((opt,oi)=>(
                <div key={oi} style={{display:"flex",alignItems:"center",gap:6}}>
                  <input type="radio" name={"mc-"+q.id} checked={q.correct===oi} onChange={()=>updateQ(q.id,"correct",oi)}/>
                  <input value={opt} onChange={e=>updateOption(q.id,oi,e.target.value)} placeholder={"Option "+(oi+1)} style={{...fs,flex:1}}/>
                </div>
              ))}
            </div>
          )}
          {q.type==="multi"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {q.options.map((opt,oi)=>(
                <div key={oi} style={{display:"flex",alignItems:"center",gap:6}}>
                  <input type="checkbox" checked={(q.correct||[]).includes(oi)} onChange={()=>toggleMulti(q.id,oi)}/>
                  <input value={opt} onChange={e=>updateOption(q.id,oi,e.target.value)} placeholder={"Option "+(oi+1)} style={{...fs,flex:1}}/>
                </div>
              ))}
              <p style={{fontSize:11,color:C.muted,gridColumn:"1/-1",margin:"4px 0 0"}}>☑ Check all correct answers</p>
            </div>
          )}
          {q.type==="tf"&&(
            <div style={{display:"flex",gap:12,marginTop:4}}>
              {[true,false].map(val=>(
                <label key={String(val)} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13}}>
                  <input type="radio" name={"tf-"+q.id} checked={q.correct===val} onChange={()=>updateQ(q.id,"correct",val)}/>
                  {val?"✅ True":"❌ False"}
                </label>
              ))}
            </div>
          )}
          {q.type==="sa"&&(
            <input value={q.sample} onChange={e=>updateQ(q.id,"sample",e.target.value)} placeholder="Sample / model answer (faculty only)..." style={fs}/>
          )}
          {q.type==="numerical"&&(
            <div style={{display:"flex",gap:8}}>
              <input value={q.answer} onChange={e=>updateQ(q.id,"answer",e.target.value)} placeholder="Correct answer (e.g. 3.14)" style={{...fs,flex:2}}/>
              <input value={q.tolerance} onChange={e=>updateQ(q.id,"tolerance",e.target.value)} placeholder="± tolerance" style={{...fs,flex:1}}/>
            </div>
          )}
          {q.type==="matching"&&(
            <div>
              {q.pairs.map((pair,pi)=>(
                <div key={pi} style={{display:"flex",gap:8,marginBottom:6,alignItems:"center"}}>
                  <input value={pair.left} onChange={e=>updatePair(q.id,pi,"left",e.target.value)} placeholder={"Term "+(pi+1)} style={{...fs,flex:1}}/>
                  <span style={{color:C.muted,fontSize:16}}>↔</span>
                  <input value={pair.right} onChange={e=>updatePair(q.id,pi,"right",e.target.value)} placeholder={"Definition "+(pi+1)} style={{...fs,flex:1}}/>
                </div>
              ))}
              <button onClick={()=>addPair(q.id)} style={{fontSize:12,color:C.navy,background:"none",border:"none",cursor:"pointer",padding:0}}>+ Add pair</button>
            </div>
          )}
          {q.type==="sequence"&&(
            <div>
              <p style={{fontSize:11,color:C.muted,margin:"0 0 6px"}}>Enter items in correct order — students will drag to arrange</p>
              {q.items.map((item,ii)=>(
                <div key={ii} style={{display:"flex",gap:8,marginBottom:6,alignItems:"center"}}>
                  <span style={{fontSize:12,color:C.muted,width:20,textAlign:"right"}}>{ii+1}.</span>
                  <input value={item} onChange={e=>updateItem(q.id,ii,e.target.value)} placeholder={"Step / item "+(ii+1)} style={{...fs,flex:1}}/>
                </div>
              ))}
              <button onClick={()=>addItem(q.id)} style={{fontSize:12,color:C.navy,background:"none",border:"none",cursor:"pointer",padding:0}}>+ Add item</button>
            </div>
          )}
          {q.type==="hotspot"&&(
            <div>
              <textarea value={q.text} onChange={e=>updateQ(q.id,"text",e.target.value)} placeholder="Question (e.g. Click the area of the contract that constitutes acceptance)" rows={2} style={{...fs,resize:"vertical",marginBottom:8}}/>
              <input value={q.imageUrl} onChange={e=>updateQ(q.id,"imageUrl",e.target.value)} placeholder="Image URL" style={{...fs,marginBottom:6}}/>
              {q.imageUrl&&<div style={{marginTop:6,fontSize:11,color:C.muted}}>🎯 Hotspot coordinates are defined after saving in the assignment editor.</div>}
            </div>
          )}
          {q.type==="media"&&(
            <div>
              {/* Media type selector */}
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                {[["image","🖼️ Image"],["video","🎬 Video"],["record","🔴 Record"]].map(([t,label])=>(
                  <label key={t} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:13,padding:"4px 10px",borderRadius:6,border:"1px solid "+(q.mediaType===t?"#0b1d3a":"#ddd"),background:q.mediaType===t?"#eef1f8":"#fff",fontWeight:q.mediaType===t?700:400}}>
                    <input type="radio" name={"media-"+q.id} checked={q.mediaType===t} onChange={()=>updateQ(q.id,"mediaType",t)} style={{display:"none"}}/>
                    {label}
                  </label>
                ))}
              </div>
              {/* Image: URL input + preview */}
              {q.mediaType==="image"&&(
                <div style={{marginBottom:8}}>
                  <input value={q.mediaUrl||""} onChange={e=>updateQ(q.id,"mediaUrl",e.target.value)} placeholder="Paste image URL..." style={{...fs,marginBottom:6}}/>
                  {q.mediaUrl&&<img src={q.mediaUrl} alt="preview" style={{maxWidth:"100%",maxHeight:200,borderRadius:6,border:"1px solid #ddd",objectFit:"contain"}} onError={e=>{e.target.style.display="none"}}/>}
                </div>
              )}
              {/* Video: URL input + inline player */}
              {q.mediaType==="video"&&(
                <div style={{marginBottom:8}}>
                  <input value={q.mediaUrl||""} onChange={e=>updateQ(q.id,"mediaUrl",e.target.value)} placeholder="Paste video URL (mp4, webm, or YouTube)..." style={{...fs,marginBottom:6}}/>
                  {q.mediaUrl&&(q.mediaUrl.includes("youtube")||q.mediaUrl.includes("youtu.be"))&&(
                    <iframe src={"https://www.youtube.com/embed/"+(q.mediaUrl.split("v=")[1]||q.mediaUrl.split("/").pop()).split("&")[0]} style={{width:"100%",height:200,borderRadius:6,border:"none"}} allowFullScreen/>
                  )}
                  {q.mediaUrl&&!q.mediaUrl.includes("youtube")&&!q.mediaUrl.includes("youtu.be")&&(
                    <video src={q.mediaUrl} controls style={{width:"100%",maxHeight:200,borderRadius:6,border:"1px solid #ddd"}}/>
                  )}
                </div>
              )}
              {/* Recorder: camera/mic capture */}
              {q.mediaType==="record"&&(
                <MediaRecorderWidget qId={q.id} recorded={q.recordedUrl||null} onSave={url=>updateQ(q.id,"recordedUrl",url)}/>
              )}
              <textarea value={q.text||""} onChange={e=>updateQ(q.id,"text",e.target.value)} placeholder="Question about the media above..." rows={2} style={{...fs,resize:"vertical",marginTop:8}}/>
            </div>
          )}
          {q.type==="youtube"&&(
            <div>
              <input value={q.videoUrl} onChange={e=>updateQ(q.id,"videoUrl",e.target.value)} placeholder="YouTube URL (https://youtube.com/watch?v=...)" style={{...fs,marginBottom:8}}/>
              <input value={q.startAt} onChange={e=>updateQ(q.id,"startAt",e.target.value)} placeholder="Start at (optional, e.g. 1:45)" style={{...fs,marginBottom:8}}/>
              <textarea value={q.text} onChange={e=>updateQ(q.id,"text",e.target.value)} placeholder="Question about the video..." rows={2} style={{...fs,resize:"vertical"}}/>
            </div>
          )}
        </div>
      ))}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
        {Object.entries(TYPE_LABELS).map(([type,label])=>(
          <button key={type} onClick={()=>addQ(type)} style={{padding:"5px 11px",borderRadius:6,border:"1px dashed "+C.border,background:"#fff",cursor:"pointer",fontSize:12,color:C.navy,display:"flex",alignItems:"center",gap:4}}>{TYPE_ICONS[type]} + {label}</button>
        ))}
      </div>
    </div>
  );
}

function CourseDetail({ course, user, onBack }) {
  const [tab, setTab] = useState("page");
  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [outcomes, setOutcomes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [meetingUrl, setMeetingUrl] = useState(course.meeting_url || "");
  const [meetingProvider, setMeetingProvider] = useState(course.meeting_provider || "zoom");
  const [editTitle, setEditTitle] = useState(course.title || course.name || "");
  const [editCode, setEditCode] = useState(course.code || "");
  const [editDescription, setEditDescription] = useState(course.description || "");
  const [editCredits, setEditCredits] = useState(course.credits || "");
  const [editIsGraded, setEditIsGraded] = useState(course.is_graded !== false);
  const [editCountsGpa, setEditCountsGpa] = useState(course.counts_gpa !== false);
  const [editCurveApplies, setEditCurveApplies] = useState(!!course.curve_applies);
  const [editAnonymousGrading, setEditAnonymousGrading] = useState(!!course.anonymous_grading);
  const [editExperiential, setEditExperiential] = useState(!!course.experiential_learning);
  const [editScholarly, setEditScholarly] = useState(!!course.scholarly_writing);
  const [editMidtermProctored, setEditMidtermProctored] = useState(!!course.midterm_proctored);
  const [editFinalProctored, setEditFinalProctored] = useState(!!course.final_proctored);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [editingCoursePage, setEditingCoursePage] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState(course?.title || course?.name || "");
  const [pageBlocks, setPageBlocks] = useState(() => {
    try { return Array.isArray(course.page_content) ? course.page_content : JSON.parse(course.page_content || "[]"); }
    catch { return []; }
  });
  const [showNew, setShowNew] = useState(false);
  const [aTitle, setATitle] = useState("");
  const [aDesc, setADesc] = useState("");
  const [aDue, setADue] = useState("");
  const [aPoints, setAPoints] = useState("100");
  const [saving, setSaving] = useState(false);
  const [abTemplateId, setAbTemplateId] = useState('');
  const [abTemplates, setAbTemplates] = useState([]);
  const [assignmentType, setAssignmentType] = useState("assignment");
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [detailDefaultTab, setDetailDefaultTab] = useState("submissions");
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api("/api/assignments?course_id=" + course.id).catch(() => []),
      api("/api/courses/" + course.id + "/students").catch(() => []),
      api("/api/courses/" + course.id + "/outcomes").catch(() => []),
      api("/api/academic-alerts").catch(() => [])
    ]).then(([a, s, o, al]) => {
      setAssignments(Array.isArray(a) ? a : []);
      setStudents(Array.isArray(s) ? s : []);
      setOutcomes(Array.isArray(o) ? o : []);
      setAlerts(Array.isArray(al) ? al.filter(x => x.course_id === course.id) : []);
    }).finally(() => setLoading(false));
  }, [course.id]);
  const saveCourseDetails = async () => {
    setSavingDetails(true);
    try {
      const updated = await api("/api/courses/" + course.id, {
        method: "PUT",
        body: JSON.stringify({
          title: editTitle.trim(),
          code: editCode.trim(),
          description: editDescription.trim(),
          credits: editCredits ? parseInt(editCredits) : null,
          is_graded: editIsGraded,
          counts_gpa: editCountsGpa,
          curve_applies: editCurveApplies,
          anonymous_grading: editAnonymousGrading,
          experiential_learning: editExperiential,
          scholarly_writing: editScholarly,
          midterm_proctored: editMidtermProctored,
          final_proctored: editFinalProctored,
        })
      });
      // Update course object in place
      Object.assign(course, updated);
      alert("Course details saved.");
    } catch (e) { alert("Failed to save: " + e.message); }
    finally { setSavingDetails(false); }
  };
  const saveCourseTitle = async () => {
    if (!newTitle.trim() || newTitle.trim() === (course.title || course.name)) {
      setEditingTitle(false); return;
    }
    try {
      const updated = await api("/api/courses/" + course.id, { method: "PUT", body: JSON.stringify({ title: newTitle.trim() }) });
      course.title = updated.title || newTitle.trim();
      setEditingTitle(false);
    } catch (e) { alert("Failed to save: " + e.message); }
  };
  const createAssignment = async () => {
    if (!aTitle.trim()) return; setSaving(true);
    try {
      const a = await api("/api/assignments", { method: "POST", body: JSON.stringify({ course_id: course.id, title: aTitle, description: aDesc, due_date: aDue || null, points: parseInt(aPoints) || 100, type: assignmentType }) });
      setAssignments(prev => [...prev, a]); setATitle(""); setADesc(""); setADue(""); setAPoints("100"); setShowNew(false); setAssignmentType("assignment"); setQuizQuestions([]);
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };
  const openAlerts = alerts.filter(a => a.status === "open" || a.status === "in_progress").length;
  const TABS = [{ id: "page", label: "📄 Course Page" }, { id: "assignments", label: "Assignments" }, { id: "students", label: "Students (" + students.length + ")" }, { id: "grades", label: "Gradebook" }, { id: "materials", label: "Materials" }, { id: "outcomes", label: "Outcomes (" + outcomes.length + ")" }, { id: "documents", label: "Documents" }, { id: "alerts", label: "Alerts" + (openAlerts > 0 ? " (" + openAlerts + ")" : "") }, { id: "settings", label: "⚙️ Settings" }];
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 13, marginBottom: 16, padding: 0 }}>Back to Courses</button>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{course.code}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {editingTitle ? (
            <>
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveCourseTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                autoFocus
                style={{ fontSize: 22, fontWeight: 700, color: C.text, border: "1px solid " + C.gold, borderRadius: 6, padding: "2px 8px", fontFamily: "inherit", background: C.linen, width: "100%", maxWidth: 420 }}
              />
              <button onClick={saveCourseTitle} style={{ background: C.navy, color: C.gold, border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
              <button onClick={() => { setEditingTitle(false); setNewTitle(course.title || course.name || ""); }} style={{ background: "none", border: "1px solid " + C.border, borderRadius: 6, padding: "4px 10px", fontSize: 13, cursor: "pointer", color: C.muted }}>Cancel</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{course.title || course.name}</div>
              <button onClick={() => { setNewTitle(course.title || course.name || ""); setEditingTitle(true); }} title="Edit title" style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, padding: "2px 4px", borderRadius: 4 }}>✏️</button>
            </>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid " + C.border }}>
        {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 14px", background: "none", border: "none", borderBottom: tab === t.id ? "2px solid " + C.navy : "2px solid transparent", color: tab === t.id ? C.navy : C.muted, fontSize: 13, fontWeight: tab === t.id ? 700 : 400, cursor: "pointer", marginBottom: -1 }}>{t.label}</button>)}
      </div>
      {loading ? <div style={{ color: C.muted, padding: 40, textAlign: "center" }}>Loading...</div> : (<>
        {tab === "assignments" && (<div>{selectedAssignment ? <AssignmentDetail assignment={selectedAssignment} courseId={course.id} courseOutcomes={outcomes} students={students} user={user} onBack={() => { setSelectedAssignment(null); setDetailDefaultTab("submissions"); }} defaultTab={detailDefaultTab} /> : <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}><Btn onClick={() => setShowNew(!showNew)} variant="gold">+ New Assignment</Btn></div>
          {showNew && (<Card style={{ marginBottom: 16, background: C.linen }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: C.text }}>New Assignment</div>
            <div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Type</label><select value={assignmentType} onChange={e => setAssignmentType(e.target.value)} style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, fontFamily: "inherit" }}><option value="assignment">📝 Assignment</option><option value="quiz">🧠 Quiz</option><option value="essay">✍️ Essay</option><option value="memo">📄 Memo</option><option value="trial_memo">⚖️ Trial Memo</option><option value="appellate_brief">📋 Appellate Brief</option><option value="contract">📜 Contract</option><option value="draft">🖊️ Draft</option><option value="research">🔍 Research</option><option value="video_presentation">🎥 Video Presentation</option><option value="collaboration">🤝 Collaboration</option><option value="poll">📊 Poll</option><option value="survey">📋 Survey</option></select></div>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Title</label><input value={aTitle} onChange={e => setATitle(e.target.value)} placeholder="Assignment title" style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} /></div>
            <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</label>{assignmentType !== "quiz" && <textarea value={aDesc} onChange={e => setADesc(e.target.value)} placeholder="Instructions..." style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, minHeight: 80, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />}</div>
          {assignmentType === "quiz" && <QuizBuilder questions={quizQuestions} setQuestions={setQuizQuestions} />}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Due Date</label><input type="datetime-local" value={aDue} onChange={e => setADue(e.target.value)} style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} /></div>
              <div><label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Points</label><input type="number" value={aPoints} onChange={e => setAPoints(e.target.value)} style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} /></div>
            </div>
            <div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Andragogy Bank Template (optional)</label><select value={abTemplateId} onChange={e => setAbTemplateId(e.target.value)} style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, fontFamily: "inherit" }}><option value="">— No template —</option>{abTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div style={{ display: "flex", gap: 8 }}><Btn onClick={createAssignment} disabled={saving || !aTitle.trim()} variant="gold">{saving ? "Saving..." : "Create"}</Btn><Btn onClick={() => setShowNew(false)} variant="ghost">Cancel</Btn></div>
          </Card>)}
          {assignments.length === 0 ? <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>No assignments yet.</div> :
            <AssignmentCardList assignments={assignments} onSelect={(a) => setSelectedAssignment(a)} onOpenSettings={(a) => { setDetailDefaultTab("settings"); setSelectedAssignment(a); }} onDelete={(id) => setAssignments(prev => prev.filter(x => x.id !== id))} />}
        </div>}</div>)}
        {tab === "students" && (<div>
          {students.length === 0 ? <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>No students enrolled yet.</div> :
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{students.map(s => (<Card key={s.id} style={{ padding: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 36, height: 36, borderRadius: "50%", background: C.navy, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>{(s.first_name || "?")[0].toUpperCase()}</div><div><div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{s.first_name} {s.last_name}</div><div style={{ fontSize: 12, color: C.muted }}>{s.email}</div></div></div></Card>))}</div>}
        </div>)}
        {tab === "grades" && <GradebookTab assignments={assignments} students={students} />}
        {tab === "outcomes" && <OutcomesTab courseId={course.id} outcomes={outcomes} setOutcomes={setOutcomes} assignments={assignments} students={students} />}
        {tab === "page" && (
          editingCoursePage
            ? <CourseBlockEditor
                course={course}
onSave={(updated) => { setEditingCoursePage(false); if (updated?.page_content) { const pc = Array.isArray(updated.page_content) ? updated.page_content : pageBlocks; setPageBlocks(pc); } }}                onClose={() => setEditingCoursePage(false)}
              />
            : <div style={{ padding: "24px 0" }}>
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
      <button
        onClick={() => setEditingCoursePage(true)}
        style={{ background: "#0B1D3A", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
      >
        ✏️ Edit Course Page
      </button>
    </div>
    {pageBlocks.length > 0
      ? <div>{pageBlocks.map(block => <div key={block.id} style={{ marginBottom: 8 }}><BlockPreview block={block} /></div>)}</div>
      : <div style={{ textAlign: "center", color: "#aaa", padding: "60px 20px", border: "2px dashed #ddd", borderRadius: 8 }}>No content yet — click Edit Course Page to start building</div>
    }
  </div>
        )}
        {tab === "materials" && <MaterialsTab courseId={course.id} user={user} />}
        {tab === "settings" && (
          <div style={{ maxWidth: 560 }}>
            <div style={{ background:"#fff", border:"1px solid " + C.border, borderRadius:10, padding:24, marginBottom:16 }}>
              <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:4 }}>Virtual Office Hours</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>Paste a Zoom, Teams, or Google Meet link. Students will see a Join button in their course view.</div>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>Platform</label>
                <select value={meetingProvider} onChange={e => setMeetingProvider(e.target.value)} style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, fontFamily:"inherit" }}>
                  <option value="zoom">Zoom</option>
                  <option value="teams">Microsoft Teams</option>
                  <option value="meet">Google Meet</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>Meeting Link</label>
                <input value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} placeholder="https://zoom.us/j/..." style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box" }} />
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <Btn onClick={async () => {
                  setSavingMeeting(true);
                  try {
                    await api("/api/courses/" + course.id, { method:"PUT", body:JSON.stringify({ meeting_url: meetingUrl, meeting_provider: meetingProvider }) });
                    alert("Meeting link saved!");
                  } catch(e) { alert(e.message); } finally { setSavingMeeting(false); }
                }} variant="gold" disabled={savingMeeting}>{savingMeeting ? "Saving..." : "Save"}</Btn>
                {meetingUrl && <a href={meetingUrl} target="_blank" rel="noreferrer" style={{ fontSize:13, color:C.navy }}>Test link ↗</a>}
              </div>
            </div>
          </div>
        )}
        {tab === "documents" && <DocumentsTab courseId={course.id} user={user} />}
        {tab === "alerts" && <AlertsTab courseId={course.id} students={students} alerts={alerts} setAlerts={setAlerts} />}

      </>)}
    </div>
  );
}

function MaterialsTab({ courseId, user }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | page object
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [videos, setVideos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  const uploadVideo = async (file) => {
    if (!file) return;
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) { setUploadError('File too large (max 500MB)'); return; }
    setUploading(true); setUploadProgress(0); setUploadError('');
    try {
      // 1. Get presigned URL from API
      const { uploadUrl, fileUrl } = await api('/api/upload/presign', {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, contentType: file.type, folder: 'videos' })
      });
      // 2. Upload directly to S3 using XHR for progress tracking
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100)); };
        xhr.onload = () => xhr.status === 200 ? resolve() : reject(new Error('Upload failed: ' + xhr.status));
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
      // 3. Save video record as a page with video content type
      const p = await api('/api/pages', { method: 'POST', body: JSON.stringify({
        title: file.name.replace(/\.[^.]+$/, ''),
        content: JSON.stringify({ type: 'video', url: fileUrl, filename: file.name }),
        course_id: courseId, site: 'lawschoolcommons',
        filename: 'video-' + Date.now(),
      })});
      setVideos(prev => [{ ...p, video_url: fileUrl }, ...prev]);
      setUploadProgress(100);
    } catch (e) { setUploadError(e.message); } finally { setUploading(false); }
  };

  useEffect(() => {
    api('/api/pages?course_id=' + courseId)
      .then(r => setPages(Array.isArray(r) ? r : (r.pages || [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  const openNew = () => { setTitle(''); setContent(''); setEditing('new'); };
  const openEdit = (p) => { setTitle(p.title); setContent(typeof p.content === 'string' ? p.content : JSON.stringify(p.content || '')); setEditing(p); };
  const cancel = () => setEditing(null);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (editing === 'new') {
        const p = await api('/api/pages', { method: 'POST', body: JSON.stringify({
          title: title.trim(), content, course_id: courseId,
          site: 'lawschoolcommons', filename: title.trim().toLowerCase().replace(/\s+/g, '-'),
        })});
        setPages(prev => [p, ...prev]);
      } else {
        const p = await api('/api/pages/' + editing.id, { method: 'PUT', body: JSON.stringify({
          title: title.trim(), content,
          filename: editing.filename, site: editing.site,
        })});
        setPages(prev => prev.map(x => x.id === p.id ? p : x));
      }
      setEditing(null);
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  const remove = async (p) => {
    if (!confirm('Delete "' + p.title + '"? Students will no longer see this page.')) return;
    try {
      await api('/api/pages/' + p.id, { method: 'DELETE' });
      setPages(prev => prev.filter(x => x.id !== p.id));
    } catch (e) { alert(e.message); }
  };

  // Separate videos from text pages
  const videoPagesIds = new Set(videos.map(v => v.id));
  const textPages = pages.filter(p => { try { const c = JSON.parse(p.content); return c?.type !== 'video'; } catch { return true; } });
  const videoPages = [...videos, ...pages.filter(p => { try { const c = JSON.parse(p.content); return c?.type === 'video'; } catch { return false; } }).filter(p => !videoPagesIds.has(p.id))];

  if (loading) return <div style={{ color: C.muted, padding: 40, textAlign: 'center' }}>Loading...</div>;

  if (editing) return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>
        {editing === 'new' ? 'New Material Page' : 'Edit: ' + editing.title}
      </div>
      <Card style={{ background: C.linen }}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Page title"
            style={{ width: '100%', padding: '9px 12px', background: '#fff', border: '1px solid ' + C.border, borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Content</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={12} placeholder="Page content (HTML supported)..."
            style={{ width: '100%', padding: '9px 12px', background: '#fff', border: '1px solid ' + C.border, borderRadius: 6, fontSize: 14, resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box', fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={save} disabled={saving || !title.trim()} variant="gold">{saving ? 'Saving...' : 'Save Page'}</Btn>
          <Btn onClick={cancel} variant="ghost">Cancel</Btn>
        </div>
      </Card>
    </div>
  );

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Video Upload Section */}
      <div style={{ background:"#fff", border:"1px solid " + C.border, borderRadius:10, padding:20, marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.text }}>🎬 Course Videos</div>
          <label style={{ padding:"7px 16px", background:C.gold, color:"#fff", borderRadius:6, fontSize:13, fontWeight:600, cursor:"pointer", display:"inline-block" }}>
            {uploading ? `Uploading ${uploadProgress}%...` : '+ Upload Video'}
            <input type="file" accept="video/*" style={{ display:"none" }} disabled={uploading}
              onChange={e => { if (e.target.files[0]) uploadVideo(e.target.files[0]); e.target.value=''; }} />
          </label>
        </div>
        {uploadError && <div style={{ fontSize:12, color:"#dc2626", marginBottom:8 }}>{uploadError}</div>}
        {uploading && (
          <div style={{ marginBottom:12 }}>
            <div style={{ height:6, background:C.border, borderRadius:3, overflow:"hidden" }}>
              <div style={{ height:"100%", width:uploadProgress + "%", background:C.gold, transition:"width 0.3s", borderRadius:3 }} />
            </div>
            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{uploadProgress}% uploaded</div>
          </div>
        )}
        {videoPages.length === 0 && !uploading
          ? <div style={{ fontSize:13, color:C.muted, textAlign:"center", padding:"20px 0" }}>No videos yet. Upload MP4, MOV, or WebM files (max 500MB).</div>
          : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {videoPages.map(v => {
                let videoUrl = v.video_url;
                if (!videoUrl) { try { const c = JSON.parse(v.content); videoUrl = c.url; } catch(e) {} }
                return (
                  <div key={v.id} style={{ background:C.linen, borderRadius:8, padding:"10px 14px", display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:20 }}>🎬</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.title}</div>
                      {videoUrl && <a href={videoUrl} target="_blank" rel="noreferrer" style={{ fontSize:11, color:C.navy }}>View ↗</a>}
                    </div>
                    <button onClick={() => remove(v)} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, fontSize:16 }}>🗑</button>
                  </div>
                );
              })}
            </div>
        }
      </div>
      {/* Text Pages Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.muted }}>{textPages.length} page{textPages.length !== 1 ? 's' : ''} — visible to enrolled students</div>
        <Btn onClick={openNew} variant="gold">+ New Page</Btn>
      </div>
      {pages.length === 0
        ? <div style={{ textAlign: 'center', color: C.muted, padding: 40, border: '2px dashed ' + C.border, borderRadius: 8 }}>
            No material pages yet. Click New Page to create one.
          </div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pages.map(p => (
              <Card key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    Updated {new Date(p.last_modified || p.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <Btn onClick={() => openEdit(p)} variant="ghost">Edit</Btn>
                  <button onClick={() => remove(p)}
                    style={{ padding: '6px 12px', background: '#FEE2E2', border: '1px solid #fca5a5', borderRadius: 6, color: '#B91C1C', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Delete
                  </button>
                </div>
              </Card>
            ))}
          </div>
      }
    </div>
  );
}

function GradebookTab({ assignments, students }) {
  const [grades, setGrades] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [gradeVal, setGradeVal] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!assignments.length || !students.length) { setLoading(false); return; }
    Promise.all(assignments.map(a => api("/api/assignments/" + a.id + "/submissions").then(subs => ({ [a.id]: subs })).catch(() => ({ [a.id]: [] }))))
      .then(results => setGrades(Object.assign({}, ...results))).finally(() => setLoading(false));
  }, [assignments, students]);
  const getSub = (aId, sId) => (grades[aId] || []).find(s => s.student_id === sId);
  const saveGrade = async (aId, sId) => {
    setSaving(true);
    try {
      await api("/api/assignments/" + aId + "/grade/" + sId, { method: "PUT", body: JSON.stringify({ grade: parseFloat(gradeVal), feedback }) });
      setGrades(prev => ({ ...prev, [aId]: (prev[aId] || []).map(s => s.student_id === sId ? { ...s, grade: parseFloat(gradeVal), feedback } : s) }));
      setEditing(null); setGradeVal(""); setFeedback("");
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };
  if (loading) return <div style={{ color: C.muted, padding: 40, textAlign: "center" }}>Loading gradebook...</div>;
  if (!assignments.length) return <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>No assignments yet.</div>;
  if (!students.length) return <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>No students enrolled yet.</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ background: C.navy, color: "#fff" }}>
          <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600 }}>Student</th>
          {assignments.map(a => <th key={a.id} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, minWidth: 100 }}>{a.title.slice(0, 20)}<div style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>{a.points} pts</div></th>)}
          <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600 }}>Avg</th>
        </tr></thead>
        <tbody>{students.map((s, si) => {
          const graded = assignments.map(a => getSub(a.id, s.id)).filter(g => g?.grade != null);
          const avg = graded.length ? Math.round(graded.reduce((acc, g) => acc + g.grade, 0) / graded.length) : null;
          return (<tr key={s.id} style={{ background: si % 2 === 0 ? "#fff" : C.linen }}>
            <td style={{ padding: "10px 14px", fontWeight: 600, color: C.text }}>{s.first_name} {s.last_name}</td>
            {assignments.map(a => { const sub = getSub(a.id, s.id); const key = a.id + "-" + s.id; const isEditing = editing === key; return (
              <td key={a.id} style={{ padding: "8px 14px", textAlign: "center" }}>
                {isEditing ? (<div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                  <input type="number" value={gradeVal} onChange={e => setGradeVal(e.target.value)} placeholder="Grade" style={{ width: 60, padding: "4px 6px", border: "1px solid " + C.border, borderRadius: 4, fontSize: 12, textAlign: "center" }} />
                  <input value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Feedback" style={{ width: 80, padding: "4px 6px", border: "1px solid " + C.border, borderRadius: 4, fontSize: 11 }} />
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => saveGrade(a.id, s.id)} disabled={saving} style={{ padding: "3px 8px", background: C.green, color: "#fff", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditing(null)} style={{ padding: "3px 8px", background: C.muted, color: "#fff", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>X</button>
                  </div>
                </div>) : sub ? (
                  <div onClick={() => { setEditing(key); setGradeVal(sub.grade != null ? sub.grade : ""); setFeedback(sub.feedback || ""); }} style={{ cursor: "pointer" }}>
                    {sub.grade != null ? <span style={{ color: C.green, fontWeight: 700 }}>{sub.grade}/{a.points}</span> : <Badge label="Submitted" color={C.blue} />}
                  </div>
                ) : <span style={{ color: C.border }}>-</span>}
              </td>
            ); })}
            <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: avg != null ? C.green : C.muted }}>{avg != null ? avg + "%" : "--"}</td>
          </tr>);
        })}</tbody>
      </table>
    </div>
  );
}
function CoursesPage({ courses, setCourses, user, initialCourse, onClearSelected }) {
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [credits, setCredits] = useState('');
  const [experiential, setExperiential] = useState(false);
  const [scholarly, setScholarly] = useState(false);
  const [isGraded, setIsGraded] = useState(true);
  const [countsGpa, setCountsGpa] = useState(true);
  const [curveApplies, setCurveApplies] = useState(false);
  const [anonymousGrading, setAnonymousGrading] = useState(false);
  const [midtermProctored, setMidtermProctored] = useState(false);
  const [finalProctored, setFinalProctored] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(initialCourse || null);
  useEffect(() => { if (initialCourse) { setSelectedCourse(initialCourse); if (onClearSelected) onClearSelected(); } }, [initialCourse]);
  const createCourse = async () => {
    if (!title.trim()) return; setSaving(true);
    try {
      const c = await api("/api/courses", { method: "POST", body: JSON.stringify({ title, code, description, faculty_id: user.id, credits: credits ? parseInt(credits) : null, experiential_learning: experiential, scholarly_writing: scholarly, is_graded: isGraded, counts_gpa: countsGpa, curve_applies: curveApplies, anonymous_grading: anonymousGrading, midterm_proctored: midtermProctored, final_proctored: finalProctored }) });
      setCourses(prev => [...prev, c]); setTitle(""); setCode(""); setDescription(""); setCredits(""); setExperiential(false); setScholarly(false); setIsGraded(true); setCountsGpa(true); setCurveApplies(false); setAnonymousGrading(false); setMidtermProctored(false); setFinalProctored(false); setShowNew(false);
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };
  if (selectedCourse) return <CourseDetail course={selectedCourse} user={user} onBack={() => setSelectedCourse(null)} />;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>My Courses</div>
        <Btn onClick={() => setShowNew(s => !s)} variant="gold">+ New Course</Btn>
      </div>
      {showNew && (
        <Card style={{ marginBottom: 20, background: C.linen }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Create New Course</div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div><label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Course Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Constitutional Law I" style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} /></div>
            <div><label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Course Code</label><input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. LAW-301" style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} /></div>
          </div>
          <div style={{ marginTop: 12 }}><label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief course description..." style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, minHeight: 80, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} /></div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Credit Hours</label>
            <input type="number" min="1" max="20" value={credits} onChange={e => setCredits(e.target.value)} placeholder="e.g. 3" style={{ width: 120, padding: "9px 12px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Course Settings</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={experiential} onChange={e => setExperiential(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.navy }} /><span style={{ fontSize: 13, color: C.text, userSelect: "none" }}>Satisfies experiential learning requirement</span></label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={scholarly} onChange={e => setScholarly(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.navy }} /><span style={{ fontSize: 13, color: C.text, userSelect: "none" }}>Satisfies scholarly writing requirement</span></label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={isGraded} onChange={e => setIsGraded(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.navy }} /><span style={{ fontSize: 13, color: C.text, userSelect: "none" }}>Graded (uncheck for pass/fail)</span></label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={countsGpa} onChange={e => setCountsGpa(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.navy }} /><span style={{ fontSize: 13, color: C.text, userSelect: "none" }}>Counts toward GPA</span></label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={curveApplies} onChange={e => setCurveApplies(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.navy }} /><span style={{ fontSize: 13, color: C.text, userSelect: "none" }}>Curve applies</span></label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={anonymousGrading} onChange={e => setAnonymousGrading(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.navy }} /><span style={{ fontSize: 13, color: C.text, userSelect: "none" }}>Anonymous grading</span></label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={midtermProctored} onChange={e => setMidtermProctored(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.navy }} /><span style={{ fontSize: 13, color: C.text, userSelect: "none" }}>Midterm requires proctoring</span></label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={finalProctored} onChange={e => setFinalProctored(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: C.navy }} /><span style={{ fontSize: 13, color: C.text, userSelect: "none" }}>Final requires proctoring</span></label>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Btn onClick={createCourse} disabled={saving || !title.trim()} variant="gold">{saving ? "Creating..." : "Create Course"}</Btn>
            <Btn onClick={() => setShowNew(false)} variant="ghost">Cancel</Btn>
          </div>
        </Card>
      )}
      {courses.length === 0 && !showNew ? (
        <Card style={{ textAlign: "center", padding: 40, color: C.muted }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No courses yet</div>
          <Btn onClick={() => setShowNew(true)} variant="gold">+ New Course</Btn>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {courses.map(c => { const colors = ["#0B1D3A","#2D5A8B","#5A3060","#2D6B4A","#6B3020"]; const color = colors[c.id % colors.length]; return (
            <Card key={c.id} as="button" style={{ cursor: "pointer", padding: 0, overflow: "hidden", width: "100%", textAlign: "left", background: C.surface, border: "1px solid " + C.border, borderRadius: 10 }} onClick={() => setSelectedCourse(c)}>
              <div style={{ display: "flex", alignItems: "stretch" }}>
                <div style={{ width: 6, background: color, flexShrink: 0 }} />
                <div style={{ padding: "14px 16px", flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{c.code || "COURSE"}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{c.title || c.name}</div>
                    {c.description && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{c.description.slice(0, 80)}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!window.confirm('Delete "' + (c.title || c.name) + '"? This will also delete all assignments and enrollments.')) return;
                        try {
                          await api("/api/courses/" + c.id, { method: "DELETE" });
                          setCourses(prev => prev.filter(x => x.id !== c.id));
                        } catch (err) { alert(err.message); }
                      }}
                      style={{ padding: "4px 10px", background: "none", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "#B91C1C", fontWeight: 600 }}
                    >
                      Delete
                    </button>
                    <span style={{ color: C.muted, fontSize: 18 }}>›</span>
                  </div>
                </div>
              </div>
            </Card>
          ); })}
        </div>
      )}
    </div>
  );
}
function StudentsPage({ courses }) {
  const [selectedCourse, setSelectedCourse] = useState(courses[0]?.id || null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    if (!selectedCourse) return; setLoading(true);
    api("/api/courses/" + selectedCourse + "/students").then(s => setStudents(Array.isArray(s) ? s : [])).catch(() => setStudents([])).finally(() => setLoading(false));
  }, [selectedCourse]);
  const addStudent = async () => {
    if (!email.trim()) return; setAdding(true);
    try {
      await api("/api/courses/" + selectedCourse + "/enroll", { method: "POST", body: JSON.stringify({ email }) });
      const s = await api("/api/courses/" + selectedCourse + "/students");
      setStudents(Array.isArray(s) ? s : []); setEmail("");
    } catch (e) { alert(e.message); } finally { setAdding(false); }
  };
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 20 }}>Students</div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Select Course</label>
        <select value={selectedCourse || ""} onChange={e => setSelectedCourse(parseInt(e.target.value))} style={{ padding: "8px 12px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, background: "#fff" }}>
          {courses.map(c => <option key={c.id} value={c.id}>{c.code ? c.code + " - " : ""}{c.title || c.name}</option>)}
        </select>
      </div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Enroll Student by Email</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="student@school.edu" onKeyDown={e => e.key === "Enter" && addStudent()} style={{ flex: 1, padding: "9px 12px", background: C.linen, border: "1px solid " + C.border, borderRadius: 6, fontSize: 14 }} />
          <Btn onClick={addStudent} disabled={adding || !email.trim()} variant="gold">{adding ? "Adding..." : "Enroll"}</Btn>
        </div>
      </Card>
      {loading ? <div style={{ color: C.muted, padding: 20 }}>Loading...</div> : students.length === 0 ? (
        <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>No students enrolled in this course yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{students.map(s => (<Card key={s.id} style={{ padding: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 36, height: 36, borderRadius: "50%", background: C.navy, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>{(s.first_name || "?")[0].toUpperCase()}</div><div><div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{s.first_name} {s.last_name}</div><div style={{ fontSize: 12, color: C.muted }}>{s.email}</div></div></div></Card>))}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTCOMES TAB — drag-and-drop library + course outcomes
// ─────────────────────────────────────────────────────────────────────────────
function OutcomesTab({ courseId, outcomes, setOutcomes, assignments, students }) {
  const [library, setLibrary] = useState([]);
  const [view, setView] = useState("list");
  const [addText, setAddText] = useState("");
  const [addCat, setAddCat] = useState("Custom");
  const [addAba, setAddAba] = useState("");
  const [showAddLib, setShowAddLib] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragItem, setDragItem] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  useEffect(() => {
    api("/api/program-outcomes").then(r => setLibrary(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const addToLibrary = async () => {
    if (!addText.trim()) return; setSaving(true);
    try {
      const o = await api("/api/program-outcomes", { method: "POST", body: JSON.stringify({ text: addText.trim(), category: addCat, aba_standard: addAba || null }) });
      setLibrary(prev => [...prev, o]);
      setAddText(""); setAddAba(""); setShowAddLib(false);
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  const dropOntoCourse = async (po) => {
    try {
      const o = await api("/api/courses/" + courseId + "/outcomes", { method: "POST", body: JSON.stringify({ text: po.text, aba_standard: po.aba_standard, category: po.category, from_program_outcome_id: po.id }) });
      setOutcomes(prev => [...prev, o]);
    } catch (e) { alert(e.message); }
  };

  const removeFromCourse = async (id) => {
    if (!confirm("Remove this outcome from the course?")) return;
    try { await api("/api/courses/" + courseId + "/outcomes/" + id, { method: "DELETE" }); setOutcomes(prev => prev.filter(o => o.id !== id)); }
    catch (e) { alert(e.message); }
  };

  const onDragStart = (e, item) => { setDragItem(item); e.dataTransfer.effectAllowed = "copy"; };
  const onDragEnd = () => { setDragItem(null); setDragOver(null); };

  const onDropZone = async (e) => {
    e.preventDefault(); setDragOver(null);
    if (dragItem && dragItem.source === "library") await dropOntoCourse(dragItem.outcome);
  };

  const onReorderDrop = async (e, targetIdx) => {
    e.preventDefault(); setDragOver(null);
    if (!dragItem || dragItem.source !== "course") return;
    const fromIdx = outcomes.findIndex(o => o.id === dragItem.id);
    if (fromIdx === targetIdx) return;
    const reordered = [...outcomes];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    const withOrder = reordered.map((o, i) => ({ ...o, sort_order: i }));
    setOutcomes(withOrder);
    await api("/api/courses/" + courseId + "/outcomes/reorder", { method: "PUT", body: JSON.stringify({ order: withOrder.map(o => ({ id: o.id, sort_order: o.sort_order })) }) }).catch(() => {});
  };

  const ABA_STANDARDS = ["301(a)", "301(b)", "302(a)", "302(b)", "302(c)", "302(d)", "303(a)", "303(b)", "314", "Other"];
  const CATEGORIES = ["Knowledge", "Skills", "Values & Competencies", "Experiential", "Custom"];
  const catBg = { "Knowledge": "#dbeafe", "Skills": "#dcfce7", "Values & Competencies": "#fef3c7", "Experiential": "#f3e8ff", "Custom": C.linen };
  const catFg = { "Knowledge": "#1e40af", "Skills": "#166534", "Values & Competencies": "#92400e", "Experiential": "#6b21a8", "Custom": C.muted };
  const alreadyAdded = (pid) => outcomes.some(o => o.template_outcome_id === pid);

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <button onClick={() => setView("list")} style={{ padding: "6px 14px", background: view === "list" ? C.navy : "none", color: view === "list" ? "#fff" : C.muted, border: "1px solid " + C.border, borderRadius: 6, cursor: "pointer", fontSize: 13 }}>Drag & Drop</button>
        <button onClick={() => setView("matrix")} style={{ padding: "6px 14px", background: view === "matrix" ? C.navy : "none", color: view === "matrix" ? "#fff" : C.muted, border: "1px solid " + C.border, borderRadius: 6, cursor: "pointer", fontSize: 13 }}>Student Matrix</button>
      </div>
      {view === "list" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Outcome Library</div>
              <button onClick={() => setShowAddLib(s => !s)} style={{ fontSize: 12, padding: "4px 10px", background: C.navy, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>+ Add Custom</button>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Drag any outcome to the right panel to add it to this course.</div>
            {showAddLib && (
              <Card style={{ marginBottom: 12, background: C.linen, padding: 14 }}>
                <textarea value={addText} onChange={e => setAddText(e.target.value)} placeholder="Outcome statement..." style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid " + C.border, borderRadius: 5, minHeight: 60, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 8 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <select value={addCat} onChange={e => setAddCat(e.target.value)} style={{ padding: "7px 10px", fontSize: 13, border: "1px solid " + C.border, borderRadius: 5 }}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                  <select value={addAba} onChange={e => setAddAba(e.target.value)} style={{ padding: "7px 10px", fontSize: 13, border: "1px solid " + C.border, borderRadius: 5 }}><option value="">ABA Standard</option>{ABA_STANDARDS.map(s => <option key={s} value={s}>{s}</option>)}</select>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn onClick={addToLibrary} disabled={saving || !addText.trim()} variant="gold">{saving ? "Saving..." : "Add to Library"}</Btn>
                  <Btn onClick={() => setShowAddLib(false)} variant="ghost">Cancel</Btn>
                </div>
              </Card>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 520, overflowY: "auto" }}>
              {library.length === 0 && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 30 }}>No outcomes in library yet.</div>}
              {library.map(o => {
                const added = alreadyAdded(o.id);
                return (
                  <div key={o.id} draggable={!added} onDragStart={e => !added && onDragStart(e, { id: o.id, source: "library", outcome: o })} onDragEnd={onDragEnd}
                    style={{ padding: "10px 12px", background: added ? "#f9fafb" : "#fff", border: "1px solid " + (added ? "#e5e7eb" : C.border), borderRadius: 7, cursor: added ? "default" : "grab", opacity: added ? 0.55 : 1 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      {o.category && <span style={{ fontSize: 10, padding: "2px 7px", background: catBg[o.category] || C.linen, color: catFg[o.category] || C.muted, borderRadius: 8, fontWeight: 600 }}>{o.category}</span>}
                      {o.aba_standard && <span style={{ fontSize: 10, padding: "2px 7px", background: C.navy, color: "#fff", borderRadius: 8, fontWeight: 600 }}>ABA {o.aba_standard}</span>}
                      {added && <span style={{ fontSize: 10, padding: "2px 7px", background: "#dcfce7", color: "#166534", borderRadius: 8, fontWeight: 600 }}>Added</span>}
                    </div>
                    <div style={{ fontSize: 13, color: C.text, lineHeight: 1.4 }}>{o.text}</div>
                    {!added && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>drag to add to course</div>}
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Course Outcomes <span style={{ fontWeight: 400, color: C.muted }}>({outcomes.length})</span></div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Drop outcomes here. Drag within to reorder.</div>
            <div onDragOver={e => { e.preventDefault(); setDragOver("zone"); }} onDragLeave={() => setDragOver(null)} onDrop={onDropZone}
              style={{ minHeight: 200, border: "2px dashed " + (dragOver === "zone" ? C.gold : C.border), borderRadius: 8, padding: 12, background: dragOver === "zone" ? "#fffbeb" : C.linen, transition: "all 0.15s" }}>
              {outcomes.length === 0 && (
                <div style={{ textAlign: "center", color: dragOver === "zone" ? C.gold : C.muted, padding: 40 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
                  <div style={{ fontSize: 13, fontWeight: dragOver === "zone" ? 700 : 400 }}>{dragOver === "zone" ? "Drop to add" : "Drag outcomes from the library"}</div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {outcomes.map((o, idx) => (
                  <div key={o.id} draggable onDragStart={e => onDragStart(e, { id: o.id, source: "course", outcome: o })} onDragEnd={onDragEnd}
                    onDragOver={e => { e.preventDefault(); setDragOver("c" + idx); }} onDrop={e => onReorderDrop(e, idx)}
                    style={{ padding: "10px 12px", background: "#fff", border: "1px solid " + (dragOver === "c" + idx ? C.gold : C.border), borderRadius: 7, cursor: "grab", boxShadow: dragItem && dragItem.id === o.id ? "0 4px 12px rgba(0,0,0,0.12)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>#{idx + 1}</span>
                          {o.category && <span style={{ fontSize: 10, padding: "2px 7px", background: catBg[o.category] || C.linen, color: catFg[o.category] || C.muted, borderRadius: 8, fontWeight: 600 }}>{o.category}</span>}
                          {o.aba_standard && <span style={{ fontSize: 10, padding: "2px 7px", background: C.navy, color: "#fff", borderRadius: 8, fontWeight: 600 }}>ABA {o.aba_standard}</span>}
                        </div>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.4 }}>{o.text}</div>
                      </div>
                      <button onClick={() => removeFromCourse(o.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>x</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {view === "matrix" && <OutcomeMatrix courseId={courseId} outcomes={outcomes} students={students} />}
    </div>
  );
}

function OutcomeMatrix({ courseId, outcomes, students }) {
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    if (!outcomes.length || !students.length) { setLoading(false); return; }
    api("/api/courses/" + courseId + "/student-outcomes")
      .then(rows => {
        const m = {};
        (Array.isArray(rows) ? rows : []).forEach(r => {
          if (!m[r.student_id]) m[r.student_id] = {};
          m[r.student_id][r.outcome_id] = r.status;
        });
        setMatrix(m);
      }).catch(() => {}).finally(() => setLoading(false));
  }, [courseId, outcomes, students]);

  const STATUS_OPTS = [
    { value: "not_started", label: "—", color: C.muted },
    { value: "in_progress", label: "In Progress", color: "#d97706" },
    { value: "met", label: "Met", color: "#16a34a" },
    { value: "not_met", label: "Not Met", color: "#dc2626" },
  ];

  const cycleStatus = async (studentId, outcomeId) => {
    const current = matrix[studentId]?.[outcomeId] || "not_started";
    const idx = STATUS_OPTS.findIndex(s => s.value === current);
    const next = STATUS_OPTS[(idx + 1) % STATUS_OPTS.length].value;
    const key = studentId + "-" + outcomeId;
    setSaving(key);
    try {
      await api("/api/student-outcomes/" + studentId + "/" + outcomeId, { method: "PUT", body: JSON.stringify({ status: next }) });
      setMatrix(prev => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), [outcomeId]: next } }));
    } catch (e) { alert(e.message); } finally { setSaving(null); }
  };

  const getStatus = (sid, oid) => matrix[sid]?.[oid] || "not_started";
  const getOpt = (v) => STATUS_OPTS.find(s => s.value === v) || STATUS_OPTS[0];

  if (loading) return <div style={{ color: C.muted, padding: 40, textAlign: "center" }}>Loading matrix...</div>;
  if (!outcomes.length) return <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Add outcomes first to use the matrix view.</div>;
  if (!students.length) return <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>No students enrolled yet.</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Click any cell to cycle: — → In Progress → Met → Not Met. Changes save instantly.</div>
      <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "100%" }}>
        <thead>
          <tr>
            <th style={{ padding: "10px 14px", textAlign: "left", background: C.navy, color: "#fff", fontWeight: 600, fontSize: 12, position: "sticky", left: 0, zIndex: 2, minWidth: 160 }}>Student</th>
            {outcomes.map((o, i) => (
              <th key={o.id} style={{ padding: "8px 10px", textAlign: "center", background: C.navy, color: "#fff", fontWeight: 600, fontSize: 11, minWidth: 90 }}>
                <div style={{ fontWeight: 700 }}>#{i + 1}</div>
                {o.aba_standard && <div style={{ fontSize: 10, opacity: 0.8 }}>ABA {o.aba_standard}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s, si) => (
            <tr key={s.id} style={{ background: si % 2 === 0 ? "#fff" : C.linen }}>
              <td style={{ padding: "10px 14px", fontWeight: 600, color: C.text, position: "sticky", left: 0, background: si % 2 === 0 ? "#fff" : C.linen, zIndex: 1, borderRight: "1px solid " + C.border }}>
                {s.first_name} {s.last_name}
              </td>
              {outcomes.map(o => {
                const status = getStatus(s.id, o.id);
                const opt = getOpt(status);
                const key = s.id + "-" + o.id;
                return (
                  <td key={o.id} style={{ padding: "6px 10px", textAlign: "center", borderBottom: "1px solid " + C.border }}>
                    <button onClick={() => cycleStatus(s.id, o.id)} disabled={saving === key}
                      style={{ padding: "3px 8px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                        background: status === "met" ? "#dcfce7" : status === "not_met" ? "#fee2e2" : status === "in_progress" ? "#fef3c7" : C.linen,
                        color: opt.color, minWidth: 72, opacity: saving === key ? 0.5 : 1 }}>
                      {saving === key ? "..." : opt.label}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERTS TAB (inside CourseDetail)
// ─────────────────────────────────────────────────────────────────────────────
function AlertsTab({ courseId, students, alerts, setAlerts }) {
  const [showForm, setShowForm] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [alertType, setAlertType] = useState("academic_progress");
  const [severity, setSeverity] = useState("warning");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [intervention, setIntervention] = useState({ action_type: "meeting", notes: "", next_steps: "", follow_up_date: "" });
  const [addingIntervention, setAddingIntervention] = useState(false);
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolving, setResolving] = useState(false);

  const ALERT_TYPES = [
    { value: "academic_progress", label: "Academic Progress" },
    { value: "bar_risk", label: "Bar Passage Risk" },
    { value: "attendance", label: "Attendance" },
    { value: "conduct", label: "Professional Conduct" },
  ];
  const ACTION_TYPES = ["meeting", "referral", "plan", "follow_up", "bar_prep", "tutoring", "other"];
  const SEVERITY = [
    { value: "warning", label: "Warning", color: "#d97706", bg: "#fef3c7" },
    { value: "serious", label: "Serious", color: "#b45309", bg: "#fde68a" },
    { value: "critical", label: "Critical", color: "#dc2626", bg: "#fee2e2" },
  ];
  const getSev = (v) => SEVERITY.find(s => s.value === v) || SEVERITY[0];
  const statusColor = { open: { color: "#dc2626", bg: "#fee2e2" }, in_progress: { color: "#d97706", bg: "#fef3c7" }, resolved: { color: "#16a34a", bg: "#dcfce7" } };
  const sc = (s) => statusColor[s] || statusColor.open;

  const createAlert = async () => {
    if (!studentId || !description.trim()) return; setSaving(true);
    try {
      const a = await api("/api/academic-alerts", { method: "POST", body: JSON.stringify({ student_id: parseInt(studentId), course_id: courseId, alert_type: alertType, severity, description }) });
      setAlerts(prev => [a, ...prev]);
      setShowForm(false); setStudentId(""); setDescription(""); setSeverity("warning");
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  const logIntervention = async () => {
    if (!intervention.notes.trim()) return; setAddingIntervention(true);
    try {
      const i = await api("/api/academic-alerts/" + selected.id + "/interventions", { method: "POST", body: JSON.stringify(intervention) });
      setSelected(prev => ({ ...prev, status: prev.status === "open" ? "in_progress" : prev.status, interventions: [...(prev.interventions || []), i] }));
      setAlerts(prev => prev.map(a => a.id === selected.id ? { ...a, status: a.status === "open" ? "in_progress" : a.status, intervention_count: (a.intervention_count || 0) + 1 } : a));
      setIntervention({ action_type: "meeting", notes: "", next_steps: "", follow_up_date: "" });
    } catch (e) { alert(e.message); } finally { setAddingIntervention(false); }
  };

  const resolveAlert = async () => {
    setResolving(true);
    try {
      await api("/api/academic-alerts/" + selected.id + "/resolve", { method: "POST", body: JSON.stringify({ resolution_notes: resolveNotes }) });
      setAlerts(prev => prev.map(a => a.id === selected.id ? { ...a, status: "resolved" } : a));
      setSelected(prev => ({ ...prev, status: "resolved", resolution_notes: resolveNotes }));
      setResolveNotes("");
    } catch (e) { alert(e.message); } finally { setResolving(false); }
  };

  const openAlert = async (a) => {
    try { const full = await api("/api/academic-alerts/" + a.id); setSelected(full); }
    catch { setSelected(a); }
  };

  if (selected) return (
    <div>
      <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 13, marginBottom: 16, padding: 0 }}>← Back to Alerts</button>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: getSev(selected.severity).bg, color: getSev(selected.severity).color }}>{getSev(selected.severity).label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: sc(selected.status).bg, color: sc(selected.status).color }}>{selected.status?.replace("_", " ").toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{selected.student_first} {selected.student_last}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{selected.student_email}</div>
          </div>
          <div style={{ fontSize: 12, color: C.muted, textAlign: "right" }}>
            <div>Raised by {selected.creator_first} {selected.creator_last}</div>
            <div>{selected.created_at && new Date(selected.created_at).toLocaleDateString()}</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: C.text, background: C.linen, borderRadius: 6, padding: "10px 12px", marginBottom: 12 }}>{selected.description}</div>
        {selected.resolution_notes && <div style={{ padding: "8px 12px", background: "#dcfce7", borderRadius: 6, fontSize: 13, color: "#166534", marginBottom: 12 }}>✓ Resolved: {selected.resolution_notes}</div>}
        {selected.status !== "resolved" && (
          <div style={{ borderTop: "1px solid " + C.border, paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Resolve Alert</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="Resolution notes (optional)..." style={{ flex: 1, padding: "8px 12px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13 }} />
              <Btn onClick={resolveAlert} disabled={resolving} variant="primary">{resolving ? "Resolving..." : "Mark Resolved"}</Btn>
            </div>
          </div>
        )}
      </Card>

      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Intervention Log ({(selected.interventions || []).length})</div>
      {(selected.interventions || []).map((iv, idx) => (
        <Card key={idx} style={{ marginBottom: 8, padding: 14, borderLeft: "3px solid " + C.gold }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.navy, textTransform: "capitalize" }}>{iv.action_type?.replace("_", " ")}</span>
            <span style={{ fontSize: 11, color: C.muted }}>{iv.logger_first} {iv.logger_last} · {iv.created_at && new Date(iv.created_at).toLocaleDateString()}</span>
          </div>
          <div style={{ fontSize: 13, color: C.text }}>{iv.notes}</div>
          {iv.next_steps && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Next steps: {iv.next_steps}</div>}
          {iv.follow_up_date && <div style={{ fontSize: 12, color: C.blue, marginTop: 2 }}>Follow-up: {new Date(iv.follow_up_date).toLocaleDateString()}</div>}
        </Card>
      ))}

      {selected.status !== "resolved" && (
        <Card style={{ marginTop: 16, background: C.linen }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Log Intervention</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Action Type</label>
              <select value={intervention.action_type} onChange={e => setIntervention(p => ({ ...p, action_type: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13, background: "#fff" }}>
                {ACTION_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Follow-up Date</label>
              <input type="date" value={intervention.follow_up_date} onChange={e => setIntervention(p => ({ ...p, follow_up_date: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes *</label>
            <textarea value={intervention.notes} onChange={e => setIntervention(p => ({ ...p, notes: e.target.value }))} placeholder="What was done or discussed..." style={{ width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13, minHeight: 70, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", background: "#fff" }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Next Steps</label>
            <input value={intervention.next_steps} onChange={e => setIntervention(p => ({ ...p, next_steps: e.target.value }))} placeholder="What the student should do next..." style={{ width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <Btn onClick={logIntervention} disabled={addingIntervention || !intervention.notes.trim()} variant="gold">{addingIntervention ? "Logging..." : "Log Intervention"}</Btn>
        </Card>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.muted }}>{alerts.filter(a => a.status === "open" || a.status === "in_progress").length} open · {alerts.filter(a => a.status === "resolved").length} resolved</div>
        <Btn onClick={() => setShowForm(!showForm)} variant="gold">+ New Alert</Btn>
      </div>

      {showForm && (
        <Card style={{ marginBottom: 16, background: C.linen }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Flag Student for Academic Support</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Student *</label>
              <select value={studentId} onChange={e => setStudentId(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13, background: "#fff" }}>
                <option value="">Select student...</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Type</label>
              <select value={alertType} onChange={e => setAlertType(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13, background: "#fff" }}>
                {ALERT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Severity</label>
              <select value={severity} onChange={e => setSeverity(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13, background: "#fff" }}>
                {SEVERITY.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Description *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the concern and what adequate progress looks like..." style={{ width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13, minHeight: 80, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={createAlert} disabled={saving || !studentId || !description.trim()} variant="gold">{saving ? "Saving..." : "Create Alert"}</Btn>
            <Btn onClick={() => setShowForm(false)} variant="ghost">Cancel</Btn>
          </div>
        </Card>
      )}

      {alerts.length === 0 && !showForm ? (
        <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No academic alerts</div>
          <div style={{ fontSize: 13 }}>Flag students who are not making adequate progress toward learning outcomes.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {alerts.map(a => {
            const sev = getSev(a.severity); const s = sc(a.status);
            return (
              <Card key={a.id} as="button" style={{ padding: 14, cursor: "pointer", textAlign: "left", width: "100%" }} onClick={() => openAlert(a)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 8, background: sev.bg, color: sev.color }}>{sev.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 8, background: s.bg, color: s.color }}>{a.status?.replace("_", " ")}</span>
                      {a.intervention_count > 0 && <span style={{ fontSize: 11, color: C.muted }}>{a.intervention_count} intervention{a.intervention_count > 1 ? "s" : ""}</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{a.student_first} {a.student_last}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{a.description?.slice(0, 100)}{a.description?.length > 100 ? "..." : ""}</div>
                  </div>
                  <span style={{ color: C.muted, fontSize: 16, marginLeft: 8 }}>›</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRAM OUTCOMES PAGE (top-level nav)
// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS TAB
function DocumentsTab({ courseId, user }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [docType, setDocType] = useState("syllabus");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const DOC_TYPES = [
    { id: "syllabus", label: "Syllabus", icon: "S", color: "#dbeafe", text: "#1e40af" },
    { id: "rubric", label: "Rubric", icon: "R", color: "#dcfce7", text: "#166534" },
    { id: "reading_list", label: "Reading List", icon: "L", color: "#fef3c7", text: "#92400e" },
    { id: "course_schedule", label: "Course Schedule", icon: "C", color: "#f3e8ff", text: "#6b21a8" },
    { id: "custom", label: "Custom", icon: "+", color: C.linen, text: C.muted },
  ];
  const typeInfo = (id) => DOC_TYPES.find(t => t.id === id) || DOC_TYPES[4];
  useEffect(() => {
    api("/api/courses/" + courseId + "/documents").then(r => setDocs(Array.isArray(r) ? r : [])).catch(() => {}).finally(() => setLoading(false));
  }, [courseId]);
  const addDoc = async () => {
    if (!url.trim()) return; setSaving(true);
    try {
      const d = await api("/api/courses/" + courseId + "/documents", { method: "POST", body: JSON.stringify({ doc_type: docType, label: label || typeInfo(docType).label, url: url.trim() }) });
      setDocs(prev => [...prev, d]); setLabel(""); setUrl(""); setDocType("syllabus"); setShowForm(false);
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };
  const removeDoc = async (id) => {
    if (!confirm("Remove this document?")) return;
    try { await api("/api/courses/" + courseId + "/documents/" + id, { method: "DELETE" }); setDocs(prev => prev.filter(d => d.id !== id)); }
    catch (e) { alert(e.message); }
  };
  const grouped = DOC_TYPES.map(t => ({ ...t, items: docs.filter(d => d.doc_type === t.id) })).filter(g => g.items.length > 0);
  if (loading) return <div style={{ color: C.muted, padding: 40, textAlign: "center" }}>Loading...</div>;
  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.muted }}>{docs.length} document{docs.length !== 1 ? "s" : ""} attached</div>
        <Btn onClick={() => setShowForm(s => !s)} variant="gold">+ Add Document</Btn>
      </div>
      {showForm && (
        <Card style={{ marginBottom: 20, background: C.linen }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Add Document</div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Document Type</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DOC_TYPES.map(t => (
                <button key={t.id} onClick={() => setDocType(t.id)} style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid " + (docType === t.id ? C.navy : C.border), background: docType === t.id ? C.navy : "#fff", color: docType === t.id ? "#fff" : C.text, cursor: "pointer", fontSize: 13, fontWeight: docType === t.id ? 700 : 400 }}>{t.label}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Label (optional)</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder={"e.g. " + typeInfo(docType).label + " Fall 2026"} style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>URL / Link *</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://docs.google.com/... or any link" style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>File upload (S3) coming Sprint 4. Paste a Google Drive or direct link for now.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={addDoc} disabled={saving || !url.trim()} variant="gold">{saving ? "Saving..." : "Add Document"}</Btn>
            <Btn onClick={() => setShowForm(false)} variant="ghost">Cancel</Btn>
          </div>
        </Card>
      )}
      {docs.length === 0 && !showForm && (
        <Card style={{ textAlign: "center", padding: 48, color: C.muted }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>F</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No documents yet</div>
          <div style={{ fontSize: 13 }}>Add a syllabus, rubric, reading list, or other course materials.</div>
        </Card>
      )}
      {grouped.map(group => (
        <div key={group.id} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{group.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {group.items.map(doc => (
              <Card key={doc.id} style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, padding: "2px 8px", background: group.color, color: group.text, borderRadius: 8, fontWeight: 600 }}>{group.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.label || group.label}</span>
                    </div>
                    {doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.navy, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.url}</a>}
                  </div>
                  <button onClick={() => removeDoc(doc.id)} style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 5, padding: "4px 10px", fontSize: 12, color: "#dc2626", cursor: "pointer", flexShrink: 0 }}>Remove</button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}



// ── ScholarshipPage ────────────────────────────────────────────────────────
function ScholarshipPage({ user }) {
  const [tab, setTab] = useState("publications");
  const [publications, setPublications] = useState([]);
  const [presentations, setPresentations] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Publication form
  const PUB_EMPTY = { type:"article", title:"", co_authors:"", publication:"", volume:"", pages:"", year:"", url:"", abstract:"", status:"published" };
  const [pubForm, setPubForm] = useState(PUB_EMPTY);
  const [showPubForm, setShowPubForm] = useState(false);
  const [editPubId, setEditPubId] = useState(null);

  // Presentation form
  const PRES_EMPTY = { type:"conference", title:"", event:"", location:"", date:"", url:"", description:"" };
  const [presForm, setPresForm] = useState(PRES_EMPTY);
  const [showPresForm, setShowPresForm] = useState(false);

  // Grant form
  const GRANT_EMPTY = { title:"", funder:"", amount:"", status:"received", start_date:"", end_date:"", description:"" };
  const [grantForm, setGrantForm] = useState(GRANT_EMPTY);
  const [showGrantForm, setShowGrantForm] = useState(false);

  useEffect(() => {
    setLoading(true);
    const fetches = {
      publications: () => api("/api/scholarship/publications").catch(() => []),
      presentations: () => api("/api/scholarship/presentations").catch(() => []),
      grants: () => api("/api/scholarship/grants").catch(() => []),
    };
    fetches[tab]().then(data => {
      if (tab === "publications") setPublications(Array.isArray(data) ? data : []);
      if (tab === "presentations") setPresentations(Array.isArray(data) ? data : []);
      if (tab === "grants") setGrants(Array.isArray(data) ? data : []);
    }).finally(() => setLoading(false));
  }, [tab]);

  const PUB_TYPES = { article:"Journal Article", book:"Book", book_chapter:"Book Chapter", law_review:"Law Review", essay:"Essay", other:"Other" };
  const PUB_STATUS = { published:"Published", forthcoming:"Forthcoming", in_progress:"In Progress" };
  const STATUS_COLORS = { published:"#D1FAE5", forthcoming:"#FEF3C7", in_progress:"#DBEAFE" };
  const STATUS_TEXT = { published:"#065F46", forthcoming:"#92400E", in_progress:"#1E40AF" };
  const PRES_TYPES = { conference:"Conference", lecture:"Lecture", keynote:"Keynote", panel:"Panel", workshop:"Workshop", other:"Other" };
  const GRANT_STATUS = { received:"Received", applied:"Applied", pending:"Pending", declined:"Declined" };
  const GRANT_STATUS_COLORS = { received:"#D1FAE5", applied:"#DBEAFE", pending:"#FEF3C7", declined:"#FEE2E2" };
  const GRANT_STATUS_TEXT = { received:"#065F46", applied:"#1E40AF", pending:"#92400E", declined:"#B91C1C" };

  const savePub = async () => {
    if (!pubForm.title.trim()) return;
    setSaving(true);
    try {
      const body = { ...pubForm, year: pubForm.year ? parseInt(pubForm.year) : null };
      if (editPubId) {
        const u = await api("/api/scholarship/publications/" + editPubId, { method:"PUT", body:JSON.stringify(body) });
        setPublications(prev => prev.map(p => p.id === editPubId ? u : p));
      } else {
        const n = await api("/api/scholarship/publications", { method:"POST", body:JSON.stringify(body) });
        setPublications(prev => [n, ...prev]);
      }
      setPubForm(PUB_EMPTY); setShowPubForm(false); setEditPubId(null);
    } catch(e) { alert(e.message); } finally { setSaving(false); }
  };

  const deletePub = async (id) => {
    if (!confirm("Delete this publication?")) return;
    await api("/api/scholarship/publications/" + id, { method:"DELETE" });
    setPublications(prev => prev.filter(p => p.id !== id));
  };

  const savePresentation = async () => {
    if (!presForm.title.trim()) return;
    setSaving(true);
    try {
      const n = await api("/api/scholarship/presentations", { method:"POST", body:JSON.stringify(presForm) });
      setPresentations(prev => [n, ...prev]);
      setPresForm(PRES_EMPTY); setShowPresForm(false);
    } catch(e) { alert(e.message); } finally { setSaving(false); }
  };

  const deletePresentation = async (id) => {
    if (!confirm("Delete this presentation?")) return;
    await api("/api/scholarship/presentations/" + id, { method:"DELETE" });
    setPresentations(prev => prev.filter(p => p.id !== id));
  };

  const saveGrant = async () => {
    if (!grantForm.title.trim()) return;
    setSaving(true);
    try {
      const body = { ...grantForm, amount: grantForm.amount ? parseFloat(grantForm.amount) : null };
      const n = await api("/api/scholarship/grants", { method:"POST", body:JSON.stringify(body) });
      setGrants(prev => [n, ...prev]);
      setGrantForm(GRANT_EMPTY); setShowGrantForm(false);
    } catch(e) { alert(e.message); } finally { setSaving(false); }
  };

  const deleteGrant = async (id) => {
    if (!confirm("Delete this grant?")) return;
    await api("/api/scholarship/grants/" + id, { method:"DELETE" });
    setGrants(prev => prev.filter(g => g.id !== id));
  };

  const TABS = [
    { id:"publications",  label:"📄 Publications" },
    { id:"presentations", label:"🎤 Presentations" },
    { id:"grants",        label:"💰 Grants & Funding" },
  ];

  const InputRow = ({ label, children }) => (
    <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</label>{children}</div>
  );
  const inp = { width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box" };

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:20, fontWeight:700, color:C.text, marginBottom:4 }}>Scholarship</div>
        <div style={{ fontSize:13, color:C.muted }}>Publications, presentations, and grants & funding.</div>
      </div>

      <div style={{ display:"flex", gap:4, borderBottom:"1px solid " + C.border, marginBottom:20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setShowPubForm(false); setShowPresForm(false); setShowGrantForm(false); }}
            style={{ padding:"8px 16px", background:"none", border:"none", borderBottom: tab === t.id ? "2px solid " + C.navy : "2px solid transparent", color: tab === t.id ? C.navy : C.muted, fontWeight: tab === t.id ? 700 : 400, fontSize:13, cursor:"pointer", marginBottom:-1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Publications */}
      {tab === "publications" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:13, color:C.muted }}>{publications.length} publication{publications.length !== 1 ? "s" : ""}</div>
            <Btn onClick={() => { setPubForm(PUB_EMPTY); setEditPubId(null); setShowPubForm(s => !s); }} variant="gold">+ Add Publication</Btn>
          </div>
          {showPubForm && (
            <Card style={{ marginBottom:16, background:C.linen, padding:18 }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:14 }}>{editPubId ? "Edit Publication" : "New Publication"}</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                <InputRow label="Type">
                  <select value={pubForm.type} onChange={e => setPubForm(f => ({...f, type:e.target.value}))} style={inp}>
                    {Object.entries(PUB_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </InputRow>
                <InputRow label="Status">
                  <select value={pubForm.status} onChange={e => setPubForm(f => ({...f, status:e.target.value}))} style={inp}>
                    {Object.entries(PUB_STATUS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </InputRow>
                <InputRow label="Year">
                  <input type="number" value={pubForm.year} onChange={e => setPubForm(f => ({...f, year:e.target.value}))} placeholder="2024" style={inp} />
                </InputRow>
              </div>
              <div style={{ marginBottom:12 }}>
                <InputRow label="Title *">
                  <input value={pubForm.title} onChange={e => setPubForm(f => ({...f, title:e.target.value}))} placeholder="Article or book title" style={inp} />
                </InputRow>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12, marginBottom:12 }}>
                <InputRow label="Journal / Publisher">
                  <input value={pubForm.publication} onChange={e => setPubForm(f => ({...f, publication:e.target.value}))} placeholder="e.g. Harvard Law Review" style={inp} />
                </InputRow>
                <InputRow label="Volume / Pages">
                  <input value={pubForm.volume} onChange={e => setPubForm(f => ({...f, volume:e.target.value}))} placeholder="Vol. 42, pp. 1–30" style={inp} />
                </InputRow>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12, marginBottom:12 }}>
                <InputRow label="Co-Authors">
                  <input value={pubForm.co_authors} onChange={e => setPubForm(f => ({...f, co_authors:e.target.value}))} placeholder="e.g. Smith, J.; Doe, A." style={inp} />
                </InputRow>
                <InputRow label="URL / DOI">
                  <input value={pubForm.url} onChange={e => setPubForm(f => ({...f, url:e.target.value}))} placeholder="https://..." style={inp} />
                </InputRow>
              </div>
              <div style={{ marginBottom:14 }}>
                <InputRow label="Abstract">
                  <textarea value={pubForm.abstract} onChange={e => setPubForm(f => ({...f, abstract:e.target.value}))} rows={3} style={{ ...inp, resize:"vertical" }} />
                </InputRow>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn onClick={savePub} variant="gold" disabled={saving || !pubForm.title.trim()}>{saving ? "Saving..." : editPubId ? "Update" : "Save"}</Btn>
                <Btn onClick={() => { setShowPubForm(false); setEditPubId(null); }} variant="ghost">Cancel</Btn>
              </div>
            </Card>
          )}
          {loading ? <div style={{ color:C.muted, padding:40, textAlign:"center" }}>Loading...</div>
            : publications.length === 0
              ? <Card style={{ textAlign:"center", padding:40, color:C.muted }}><div style={{ fontSize:32, marginBottom:8 }}>📄</div><div style={{ fontWeight:600 }}>No publications yet</div></Card>
              : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {publications.map(p => (
                    <Card key={p.id} style={{ padding:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                            <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{p.title}</div>
                            <span style={{ fontSize:11, background:STATUS_COLORS[p.status]||"#f3f4f6", color:STATUS_TEXT[p.status]||C.muted, padding:"2px 8px", borderRadius:4, fontWeight:600, whiteSpace:"nowrap" }}>{PUB_STATUS[p.status]||p.status}</span>
                          </div>
                          <div style={{ fontSize:12, color:C.muted, marginBottom:2 }}>{PUB_TYPES[p.type]||p.type}{p.year ? " · " + p.year : ""}</div>
                          {p.publication && <div style={{ fontSize:12, color:C.muted, marginBottom:2 }}>📖 {p.publication}{p.volume ? " · " + p.volume : ""}</div>}
                          {p.co_authors && <div style={{ fontSize:12, color:C.muted, marginBottom:2 }}>👥 {p.co_authors}</div>}
                          {p.url && <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:C.navy }}>🔗 View</a>}
                        </div>
                        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                          <button onClick={() => { setPubForm({ type:p.type, title:p.title, co_authors:p.co_authors||"", publication:p.publication||"", volume:p.volume||"", pages:p.pages||"", year:p.year||"", url:p.url||"", abstract:p.abstract||"", status:p.status }); setEditPubId(p.id); setShowPubForm(true); }} style={{ padding:"5px 12px", background:"#fff", border:"1px solid " + C.border, borderRadius:6, fontSize:12, cursor:"pointer" }}>Edit</button>
                          <button onClick={() => deletePub(p.id)} style={{ padding:"5px 12px", background:"#FEE2E2", border:"1px solid #fca5a5", borderRadius:6, fontSize:12, cursor:"pointer", color:"#B91C1C" }}>Delete</button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
          }
        </div>
      )}

      {/* Presentations */}
      {tab === "presentations" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:13, color:C.muted }}>{presentations.length} presentation{presentations.length !== 1 ? "s" : ""}</div>
            <Btn onClick={() => setShowPresForm(s => !s)} variant="gold">+ Add Presentation</Btn>
          </div>
          {showPresForm && (
            <Card style={{ marginBottom:16, background:C.linen, padding:18 }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:14 }}>New Presentation</div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12, marginBottom:12 }}>
                <InputRow label="Title *"><input value={presForm.title} onChange={e => setPresForm(f => ({...f, title:e.target.value}))} placeholder="Presentation title" style={inp} /></InputRow>
                <InputRow label="Type">
                  <select value={presForm.type} onChange={e => setPresForm(f => ({...f, type:e.target.value}))} style={inp}>
                    {Object.entries(PRES_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </InputRow>
                <InputRow label="Date"><input type="date" value={presForm.date} onChange={e => setPresForm(f => ({...f, date:e.target.value}))} style={inp} /></InputRow>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12, marginBottom:12 }}>
                <InputRow label="Event / Conference"><input value={presForm.event} onChange={e => setPresForm(f => ({...f, event:e.target.value}))} placeholder="e.g. AALS Annual Meeting" style={inp} /></InputRow>
                <InputRow label="Location"><input value={presForm.location} onChange={e => setPresForm(f => ({...f, location:e.target.value}))} placeholder="e.g. San Francisco, CA" style={inp} /></InputRow>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12, marginBottom:14 }}>
                <InputRow label="Description"><textarea value={presForm.description} onChange={e => setPresForm(f => ({...f, description:e.target.value}))} rows={2} style={{ ...inp, resize:"vertical" }} /></InputRow>
                <InputRow label="URL"><input value={presForm.url} onChange={e => setPresForm(f => ({...f, url:e.target.value}))} placeholder="https://..." style={inp} /></InputRow>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn onClick={savePresentation} variant="gold" disabled={saving || !presForm.title.trim()}>{saving ? "Saving..." : "Save"}</Btn>
                <Btn onClick={() => setShowPresForm(false)} variant="ghost">Cancel</Btn>
              </div>
            </Card>
          )}
          {loading ? <div style={{ color:C.muted, padding:40, textAlign:"center" }}>Loading...</div>
            : presentations.length === 0
              ? <Card style={{ textAlign:"center", padding:40, color:C.muted }}><div style={{ fontSize:32, marginBottom:8 }}>🎤</div><div style={{ fontWeight:600 }}>No presentations yet</div></Card>
              : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {presentations.map(p => (
                    <Card key={p.id} style={{ padding:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:3 }}>{p.title}</div>
                          <div style={{ fontSize:12, color:C.muted, marginBottom:2 }}>{PRES_TYPES[p.type]||p.type}{p.date ? " · " + new Date(p.date).toLocaleDateString() : ""}</div>
                          {p.event && <div style={{ fontSize:12, color:C.muted, marginBottom:2 }}>🎪 {p.event}{p.location ? " · " + p.location : ""}</div>}
                          {p.url && <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:C.navy }}>🔗 View</a>}
                          {p.description && <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{p.description}</div>}
                        </div>
                        <button onClick={() => deletePresentation(p.id)} style={{ padding:"5px 12px", background:"#FEE2E2", border:"1px solid #fca5a5", borderRadius:6, fontSize:12, cursor:"pointer", color:"#B91C1C", flexShrink:0 }}>Delete</button>
                      </div>
                    </Card>
                  ))}
                </div>
          }
        </div>
      )}

      {/* Grants */}
      {tab === "grants" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:13, color:C.muted }}>{grants.length} grant{grants.length !== 1 ? "s" : ""}</div>
            <Btn onClick={() => setShowGrantForm(s => !s)} variant="gold">+ Add Grant</Btn>
          </div>
          {showGrantForm && (
            <Card style={{ marginBottom:16, background:C.linen, padding:18 }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:14 }}>New Grant / Funding</div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12, marginBottom:12 }}>
                <InputRow label="Title *"><input value={grantForm.title} onChange={e => setGrantForm(f => ({...f, title:e.target.value}))} placeholder="Grant title" style={inp} /></InputRow>
                <InputRow label="Status">
                  <select value={grantForm.status} onChange={e => setGrantForm(f => ({...f, status:e.target.value}))} style={inp}>
                    {Object.entries(GRANT_STATUS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </InputRow>
                <InputRow label="Amount ($)"><input type="number" value={grantForm.amount} onChange={e => setGrantForm(f => ({...f, amount:e.target.value}))} placeholder="0.00" style={inp} /></InputRow>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12, marginBottom:12 }}>
                <InputRow label="Funder / Agency"><input value={grantForm.funder} onChange={e => setGrantForm(f => ({...f, funder:e.target.value}))} placeholder="e.g. National Science Foundation" style={inp} /></InputRow>
                <InputRow label="Start Date"><input type="date" value={grantForm.start_date} onChange={e => setGrantForm(f => ({...f, start_date:e.target.value}))} style={inp} /></InputRow>
                <InputRow label="End Date"><input type="date" value={grantForm.end_date} onChange={e => setGrantForm(f => ({...f, end_date:e.target.value}))} style={inp} /></InputRow>
              </div>
              <div style={{ marginBottom:14 }}>
                <InputRow label="Description"><textarea value={grantForm.description} onChange={e => setGrantForm(f => ({...f, description:e.target.value}))} rows={2} style={{ ...inp, resize:"vertical" }} /></InputRow>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn onClick={saveGrant} variant="gold" disabled={saving || !grantForm.title.trim()}>{saving ? "Saving..." : "Save"}</Btn>
                <Btn onClick={() => setShowGrantForm(false)} variant="ghost">Cancel</Btn>
              </div>
            </Card>
          )}
          {loading ? <div style={{ color:C.muted, padding:40, textAlign:"center" }}>Loading...</div>
            : grants.length === 0
              ? <Card style={{ textAlign:"center", padding:40, color:C.muted }}><div style={{ fontSize:32, marginBottom:8 }}>💰</div><div style={{ fontWeight:600 }}>No grants yet</div></Card>
              : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {grants.map(g => (
                    <Card key={g.id} style={{ padding:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                            <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{g.title}</div>
                            <span style={{ fontSize:11, background:GRANT_STATUS_COLORS[g.status]||"#f3f4f6", color:GRANT_STATUS_TEXT[g.status]||C.muted, padding:"2px 8px", borderRadius:4, fontWeight:600 }}>{GRANT_STATUS[g.status]||g.status}</span>
                          </div>
                          {g.funder && <div style={{ fontSize:12, color:C.muted, marginBottom:2 }}>🏛 {g.funder}</div>}
                          {g.amount && <div style={{ fontSize:12, color:C.muted, marginBottom:2 }}>💵 ${parseFloat(g.amount).toLocaleString()}</div>}
                          {(g.start_date || g.end_date) && <div style={{ fontSize:12, color:C.muted }}>📅 {g.start_date ? new Date(g.start_date).toLocaleDateString() : "?"} → {g.end_date ? new Date(g.end_date).toLocaleDateString() : "Present"}</div>}
                          {g.description && <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{g.description}</div>}
                        </div>
                        <button onClick={() => deleteGrant(g.id)} style={{ padding:"5px 12px", background:"#FEE2E2", border:"1px solid #fca5a5", borderRadius:6, fontSize:12, cursor:"pointer", color:"#B91C1C", flexShrink:0 }}>Delete</button>
                      </div>
                    </Card>
                  ))}
                </div>
          }
        </div>
      )}
    </div>
  );
}



// ── FacultyServicePage ─────────────────────────────────────────────────────
function FacultyServicePage({ user }) {
  const [tab, setTab] = useState("volunteer");
  const [entries, setEntries] = useState([]);
  const [committees, setCommittees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:"", organization:"", description:"", hours:"", service_date:"" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [awards, setAwards] = useState([]);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(true);
  const [orgForm, setOrgForm] = useState({ name:"", website:"", role:"", office:"", start_date:"", end_date:"", is_leadership:false, notes:"" });
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [editOrgId, setEditOrgId] = useState(null);
  const [awardForm, setAwardForm] = useState({ title:"", organization:"", award_date:"", description:"" });
  const [showAwardForm, setShowAwardForm] = useState(false);

  useEffect(() => {
    setLoading(true);
    const fetches = [];
    if (tab === "volunteer" || tab === "probono") {
      fetches.push(api("/api/faculty-service?type=" + tab).catch(() => []));
      fetches.push(Promise.resolve([]));
    } else if (tab === "committees") {
      fetches.push(Promise.resolve([]));
      fetches.push(api("/api/faculty-service/committees").catch(() => []));
    } else if (tab === "orgs") {
      fetches.push(api("/api/faculty-service/orgs").catch(() => []));
      fetches.push(Promise.resolve([]));
    } else if (tab === "awards") {
      fetches.push(api("/api/faculty-service/awards").catch(() => []));
      fetches.push(Promise.resolve([]));
    } else if (tab === "notes") {
      api("/api/faculty-service/notes").then(r => setNotes(r?.content || "")).catch(() => {});
      fetches.push(Promise.resolve([]));
      fetches.push(Promise.resolve([]));
    } else {
      fetches.push(Promise.resolve([]));
      fetches.push(Promise.resolve([]));
    }
    Promise.all(fetches).then(([a, b]) => {
      if (tab === "volunteer" || tab === "probono") { setEntries(Array.isArray(a) ? a : []); }
      else if (tab === "committees") { setCommittees(Array.isArray(b) ? b : []); }
      else if (tab === "orgs") { setOrgs(Array.isArray(a) ? a : []); }
      else if (tab === "awards") { setAwards(Array.isArray(a) ? a : []); }
    }).finally(() => setLoading(false));
  }, [tab]);

  const saveNotes = async () => {
    try { await api("/api/faculty-service/notes", { method:"PUT", body:JSON.stringify({ content: notes }) }); setNotesSaved(true); } catch(e) {}
  };

  const saveOrg = async () => {
    if (!orgForm.name.trim()) return;
    setSaving(true);
    try {
      if (editOrgId) {
        const u = await api("/api/faculty-service/orgs/" + editOrgId, { method:"PUT", body:JSON.stringify(orgForm) });
        setOrgs(prev => prev.map(o => o.id === editOrgId ? u : o));
      } else {
        const n = await api("/api/faculty-service/orgs", { method:"POST", body:JSON.stringify(orgForm) });
        setOrgs(prev => [n, ...prev]);
      }
      setOrgForm({ name:"", website:"", role:"", office:"", start_date:"", end_date:"", is_leadership:false, notes:"" });
      setShowOrgForm(false); setEditOrgId(null);
    } catch(e) { alert(e.message); } finally { setSaving(false); }
  };

  const deleteOrg = async (id) => {
    if (!confirm("Delete this organization?")) return;
    await api("/api/faculty-service/orgs/" + id, { method:"DELETE" });
    setOrgs(prev => prev.filter(o => o.id !== id));
  };

  const saveAward = async () => {
    if (!awardForm.title.trim()) return;
    setSaving(true);
    try {
      const n = await api("/api/faculty-service/awards", { method:"POST", body:JSON.stringify(awardForm) });
      setAwards(prev => [n, ...prev]);
      setAwardForm({ title:"", organization:"", award_date:"", description:"" });
      setShowAwardForm(false);
    } catch(e) { alert(e.message); } finally { setSaving(false); }
  };

  const deleteAward = async (id) => {
    if (!confirm("Delete this award?")) return;
    await api("/api/faculty-service/awards/" + id, { method:"DELETE" });
    setAwards(prev => prev.filter(a => a.id !== id));
  };

  const resetForm = () => { setForm({ title:"", organization:"", description:"", hours:"", service_date:"" }); setShowForm(false); setEditId(null); };

  const openEdit = (e) => {
    setForm({ title: e.title, organization: e.organization || "", description: e.description || "", hours: e.hours || "", service_date: e.service_date ? e.service_date.slice(0,10) : "" });
    setEditId(e.id); setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body = { ...form, type: tab, hours: form.hours ? parseFloat(form.hours) : null };
      if (editId) {
        const u = await api("/api/faculty-service/" + editId, { method: "PUT", body: JSON.stringify(body) });
        setEntries(prev => prev.map(e => e.id === editId ? u : e));
      } else {
        const n = await api("/api/faculty-service", { method: "POST", body: JSON.stringify(body) });
        setEntries(prev => [n, ...prev]);
      }
      resetForm();
    } catch(e) { alert(e.message); } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this entry?")) return;
    try {
      await api("/api/faculty-service/" + id, { method: "DELETE" });
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch(e) { alert(e.message); }
  };

  const TABS = [
    { id: "volunteer",    label: "🌱 Volunteer Work" },
    { id: "probono",      label: "⚖️ Pro Bono Services" },
    { id: "orgs",         label: "🏢 Professional Orgs" },
    { id: "awards",       label: "🏆 Awards" },
    { id: "committees",   label: "🏛 Committee Service" },
    { id: "notes",        label: "📝 Notes" },
  ];

  const totalHours = entries.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>Service</div>
        <div style={{ fontSize: 13, color: C.muted }}>Volunteer work, pro bono legal services, and faculty committee assignments.</div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, borderBottom:"1px solid " + C.border, marginBottom:20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setShowForm(false); }}
            style={{ padding:"8px 16px", background:"none", border:"none", borderBottom: tab === t.id ? "2px solid " + C.navy : "2px solid transparent", color: tab === t.id ? C.navy : C.muted, fontWeight: tab === t.id ? 700 : 400, fontSize:13, cursor:"pointer", marginBottom:-1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Professional Orgs tab */}
      {tab === "orgs" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:13, color:C.muted }}>{orgs.length} organization{orgs.length !== 1 ? "s" : ""}</div>
            <Btn onClick={() => { setOrgForm({ name:"", website:"", role:"", office:"", start_date:"", end_date:"", is_leadership:false, notes:"" }); setEditOrgId(null); setShowOrgForm(s => !s); }} variant="gold">+ Add Organization</Btn>
          </div>
          {showOrgForm && (
            <Card style={{ marginBottom:16, background:C.linen, padding:18 }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:14 }}>{editOrgId ? "Edit Organization" : "New Organization"}</div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12, marginBottom:12 }}>
                <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Organization Name *</label>
                  <input value={orgForm.name} onChange={e => setOrgForm(f => ({...f, name:e.target.value}))} placeholder="e.g. American Bar Association" style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box" }} /></div>
                <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Website</label>
                  <input value={orgForm.website} onChange={e => setOrgForm(f => ({...f, website:e.target.value}))} placeholder="https://" style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box" }} /></div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Role / Title</label>
                  <input value={orgForm.role} onChange={e => setOrgForm(f => ({...f, role:e.target.value}))} placeholder="e.g. Member, Chair" style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box" }} /></div>
                <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Office Held</label>
                  <input value={orgForm.office} onChange={e => setOrgForm(f => ({...f, office:e.target.value}))} placeholder="e.g. President, Secretary" style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box" }} /></div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Start Date</label>
                  <input type="date" value={orgForm.start_date} onChange={e => setOrgForm(f => ({...f, start_date:e.target.value}))} style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box" }} /></div>
                <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>End Date</label>
                  <input type="date" value={orgForm.end_date} onChange={e => setOrgForm(f => ({...f, end_date:e.target.value}))} style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box" }} /></div>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13, color:C.text }}>
                  <input type="checkbox" checked={orgForm.is_leadership} onChange={e => setOrgForm(f => ({...f, is_leadership:e.target.checked}))} />
                  Leadership role
                </label>
              </div>
              <div style={{ marginBottom:14 }}><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Notes</label>
                <textarea value={orgForm.notes} onChange={e => setOrgForm(f => ({...f, notes:e.target.value}))} placeholder="Additional notes..." rows={2} style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box", resize:"vertical" }} /></div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn onClick={saveOrg} variant="gold" disabled={saving || !orgForm.name.trim()}>{saving ? "Saving..." : editOrgId ? "Update" : "Save"}</Btn>
                <Btn onClick={() => { setShowOrgForm(false); setEditOrgId(null); }} variant="ghost">Cancel</Btn>
              </div>
            </Card>
          )}
          {loading ? <div style={{ color:C.muted, padding:40, textAlign:"center" }}>Loading...</div>
            : orgs.length === 0 ? <Card style={{ textAlign:"center", padding:40, color:C.muted }}><div style={{ fontSize:32, marginBottom:8 }}>🏢</div><div style={{ fontWeight:600 }}>No organizations yet</div></Card>
            : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {orgs.map(o => (
                  <Card key={o.id} style={{ padding:16 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{o.name}</div>
                          {o.is_leadership && <span style={{ fontSize:11, background:"#FEF3C7", color:"#92400E", padding:"2px 8px", borderRadius:4, fontWeight:600 }}>Leadership</span>}
                        </div>
                        {(o.role || o.office) && <div style={{ fontSize:12, color:C.muted, marginBottom:3 }}>{[o.role, o.office].filter(Boolean).join(" · ")}</div>}
                        {(o.start_date || o.end_date) && <div style={{ fontSize:12, color:C.muted, marginBottom:3 }}>📅 {o.start_date ? new Date(o.start_date).toLocaleDateString() : "?"} → {o.end_date ? new Date(o.end_date).toLocaleDateString() : "Present"}</div>}
                        {o.website && <a href={o.website} target="_blank" rel="noreferrer" style={{ fontSize:12, color:C.navy }}>🌐 {o.website}</a>}
                        {o.notes && <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{o.notes}</div>}
                      </div>
                      <div style={{ display:"flex", gap:6 }}>
                        <button onClick={() => { setOrgForm({ name:o.name, website:o.website||"", role:o.role||"", office:o.office||"", start_date:o.start_date?o.start_date.slice(0,10):"", end_date:o.end_date?o.end_date.slice(0,10):"", is_leadership:o.is_leadership||false, notes:o.notes||"" }); setEditOrgId(o.id); setShowOrgForm(true); }} style={{ padding:"5px 12px", background:"#fff", border:"1px solid " + C.border, borderRadius:6, fontSize:12, cursor:"pointer" }}>Edit</button>
                        <button onClick={() => deleteOrg(o.id)} style={{ padding:"5px 12px", background:"#FEE2E2", border:"1px solid #fca5a5", borderRadius:6, fontSize:12, cursor:"pointer", color:"#B91C1C" }}>Delete</button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
          }
        </div>
      )}

      {/* Awards tab */}
      {tab === "awards" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:13, color:C.muted }}>{awards.length} award{awards.length !== 1 ? "s" : ""}</div>
            <Btn onClick={() => setShowAwardForm(s => !s)} variant="gold">+ Add Award</Btn>
          </div>
          {showAwardForm && (
            <Card style={{ marginBottom:16, background:C.linen, padding:18 }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:14 }}>New Award</div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12, marginBottom:12 }}>
                <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Award Title *</label>
                  <input value={awardForm.title} onChange={e => setAwardForm(f => ({...f, title:e.target.value}))} placeholder="e.g. Distinguished Teaching Award" style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box" }} /></div>
                <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Date</label>
                  <input type="date" value={awardForm.award_date} onChange={e => setAwardForm(f => ({...f, award_date:e.target.value}))} style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box" }} /></div>
              </div>
              <div style={{ marginBottom:12 }}><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Awarding Organization</label>
                <input value={awardForm.organization} onChange={e => setAwardForm(f => ({...f, organization:e.target.value}))} placeholder="e.g. California Bar Association" style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box" }} /></div>
              <div style={{ marginBottom:14 }}><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Description</label>
                <textarea value={awardForm.description} onChange={e => setAwardForm(f => ({...f, description:e.target.value}))} rows={2} style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box", resize:"vertical" }} /></div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn onClick={saveAward} variant="gold" disabled={saving || !awardForm.title.trim()}>{saving ? "Saving..." : "Save"}</Btn>
                <Btn onClick={() => setShowAwardForm(false)} variant="ghost">Cancel</Btn>
              </div>
            </Card>
          )}
          {loading ? <div style={{ color:C.muted, padding:40, textAlign:"center" }}>Loading...</div>
            : awards.length === 0 ? <Card style={{ textAlign:"center", padding:40, color:C.muted }}><div style={{ fontSize:32, marginBottom:8 }}>🏆</div><div style={{ fontWeight:600 }}>No awards yet</div></Card>
            : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {awards.map(a => (
                  <Card key={a.id} style={{ padding:16 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:3 }}>🏆 {a.title}</div>
                        {a.organization && <div style={{ fontSize:12, color:C.muted, marginBottom:2 }}>🏢 {a.organization}</div>}
                        {a.award_date && <div style={{ fontSize:12, color:C.muted, marginBottom:2 }}>📅 {new Date(a.award_date).toLocaleDateString()}</div>}
                        {a.description && <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{a.description}</div>}
                      </div>
                      <button onClick={() => deleteAward(a.id)} style={{ padding:"5px 12px", background:"#FEE2E2", border:"1px solid #fca5a5", borderRadius:6, fontSize:12, cursor:"pointer", color:"#B91C1C" }}>Delete</button>
                    </div>
                  </Card>
                ))}
              </div>
          }
        </div>
      )}

      {/* Notes tab */}
      {tab === "notes" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:13, color:C.muted }}>Working notes — visible only to you. Update anytime.</div>
            <Btn onClick={saveNotes} variant="gold" disabled={notesSaved}>{notesSaved ? "Saved ✓" : "Save Notes"}</Btn>
          </div>
          <textarea value={notes} onChange={e => { setNotes(e.target.value); setNotesSaved(false); }}
            placeholder="What are you working on? Current projects, ideas, goals, upcoming deadlines..."
            rows={16} style={{ width:"100%", padding:"12px 14px", border:"1px solid " + C.border, borderRadius:8, fontSize:14, lineHeight:1.7, boxSizing:"border-box", resize:"vertical", fontFamily:"inherit" }} />
        </div>
      )}

      {/* Committee tab — read only */}
      {tab === "committees" && (
        <div>
          {loading
            ? <div style={{ color:C.muted, padding:40, textAlign:"center" }}>Loading...</div>
            : committees.length === 0
              ? <Card style={{ textAlign:"center", padding:40, color:C.muted }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>🏛</div>
                  <div style={{ fontWeight:600, marginBottom:4 }}>No committee assignments yet</div>
                  <div style={{ fontSize:13 }}>Committee assignments are entered by the Vice Dean or Administrator.</div>
                </Card>
              : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {committees.map(c => (
                    <Card key={c.id} style={{ padding:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div>
                          <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:4 }}>{c.name}</div>
                          {c.description && <div style={{ fontSize:13, color:C.muted, marginBottom:6 }}>{c.description}</div>}
                          <div style={{ display:"flex", gap:10, fontSize:12, color:C.muted }}>
                            <span style={{ background:"#EFF6FF", color:"#1D4ED8", padding:"2px 8px", borderRadius:4, fontWeight:600 }}>{c.role || "Member"}</span>
                            {c.term_start && <span>📅 {new Date(c.term_start).toLocaleDateString()} {c.term_end ? "→ " + new Date(c.term_end).toLocaleDateString() : ""}</span>}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
          }
        </div>
      )}

      {/* Volunteer / Pro Bono tabs */}
      {tab !== "committees" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:13, color:C.muted }}>
              {entries.length} {tab === "volunteer" ? "volunteer" : "pro bono"} {entries.length !== 1 ? "entries" : "entry"}
              {totalHours > 0 && <span> · <strong>{totalHours.toFixed(1)} hrs</strong> total</span>}
            </div>
            <Btn onClick={() => { resetForm(); setShowForm(s => !s); }} variant="gold">+ Log {tab === "volunteer" ? "Volunteer" : "Pro Bono"}</Btn>
          </div>

          {/* Entry form */}
          {showForm && (
            <Card style={{ marginBottom:16, background:C.linen, padding:18 }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:14 }}>{editId ? "Edit Entry" : "New " + (tab === "volunteer" ? "Volunteer" : "Pro Bono") + " Entry"}</div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Title *</label>
                  <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder={tab === "volunteer" ? "e.g. Legal Aid Clinic" : "e.g. Smith v. Jones — housing dispute"}
                    style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Hours</label>
                  <input type="number" min="0" step="0.5" value={form.hours} onChange={e => setForm(f => ({...f, hours: e.target.value}))} placeholder="0.0"
                    style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box" }} />
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Organization</label>
                  <input value={form.organization} onChange={e => setForm(f => ({...f, organization: e.target.value}))} placeholder="Organization or client name"
                    style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Date</label>
                  <input type="date" value={form.service_date} onChange={e => setForm(f => ({...f, service_date: e.target.value}))}
                    style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box" }} />
                </div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Brief description of the work..." rows={3}
                  style={{ width:"100%", padding:"8px 10px", border:"1px solid " + C.border, borderRadius:6, fontSize:13, boxSizing:"border-box", resize:"vertical" }} />
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn onClick={save} variant="gold" disabled={saving || !form.title.trim()}>{saving ? "Saving..." : editId ? "Update" : "Save"}</Btn>
                <Btn onClick={resetForm} variant="ghost">Cancel</Btn>
              </div>
            </Card>
          )}

          {/* Entries list */}
          {loading
            ? <div style={{ color:C.muted, padding:40, textAlign:"center" }}>Loading...</div>
            : entries.length === 0
              ? <Card style={{ textAlign:"center", padding:40, color:C.muted }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>{tab === "volunteer" ? "🌱" : "⚖️"}</div>
                  <div style={{ fontWeight:600, marginBottom:4 }}>No entries yet</div>
                  <div style={{ fontSize:13 }}>Click "+ Log" to add your first {tab === "volunteer" ? "volunteer" : "pro bono"} entry.</div>
                </Card>
              : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {entries.map(e => (
                    <Card key={e.id} style={{ padding:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:3 }}>{e.title}</div>
                          {e.organization && <div style={{ fontSize:12, color:C.muted, marginBottom:3 }}>🏢 {e.organization}</div>}
                          {e.description && <div style={{ fontSize:12, color:C.muted, marginBottom:3 }}>{e.description}</div>}
                          <div style={{ display:"flex", gap:10, fontSize:12, color:C.muted, marginTop:4 }}>
                            {e.hours && <span>⏱ {parseFloat(e.hours).toFixed(1)} hrs</span>}
                            {e.service_date && <span>📅 {new Date(e.service_date).toLocaleDateString()}</span>}
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                          <button onClick={() => openEdit(e)} style={{ padding:"5px 12px", background:"#fff", border:"1px solid " + C.border, borderRadius:6, fontSize:12, cursor:"pointer", color:C.text }}>Edit</button>
                          <button onClick={() => remove(e.id)} style={{ padding:"5px 12px", background:"#FEE2E2", border:"1px solid #fca5a5", borderRadius:6, fontSize:12, cursor:"pointer", color:"#B91C1C" }}>Delete</button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
          }
        </div>
      )}
    </div>
  );
}


function ProgramOutcomesPage({ courses }) {
  const [outcomes, setOutcomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("outcomes");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ text: "", aba_standard: "", category: "", is_required: true, bar_subject: "" });
  const [saving, setSaving] = useState(false);
  const [abTemplateId, setAbTemplateId] = useState('');
  const [abTemplates, setAbTemplates] = useState([]);
  const [coverage, setCoverage] = useState([]);
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [templates, setTemplates] = useState({});
  const [templateCode, setTemplateCode] = useState("");
  const [templateForm, setTemplateForm] = useState({ text: "", aba_standard: "", category: "", program_outcome_id: "" });
  const [savingTemplate, setSavingTemplate] = useState(false);

  const ABA_STANDARDS = ["302(a)", "302(b)", "302(c)", "302(d)", "303(a)", "303(b)", "314", "315", "301(a)", "Other"];
  const CATEGORIES = ["Knowledge", "Skills", "Values & Competencies", "Experiential", "Other"];
  const BAR_SUBJECTS = ["Contracts", "Torts", "Civil Procedure", "Constitutional Law", "Criminal Law", "Evidence", "Property", "Business Associations", "Family Law", "Wills & Trusts", "Professional Responsibility", "MPT Skills", "Other"];

  useEffect(() => {
    api("/api/program-outcomes").then(r => setOutcomes(Array.isArray(r) ? r : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadCoverage = () => {
    setLoadingCoverage(true);
    api("/api/program-outcomes/coverage").then(r => setCoverage(Array.isArray(r) ? r : [])).catch(() => {}).finally(() => setLoadingCoverage(false));
  };

  const loadTemplates = (code) => {
    if (!code) return;
    api("/api/course-templates/" + code + "/outcomes").then(r => {
      setTemplates(prev => ({ ...prev, [code]: Array.isArray(r) ? r : [] }));
    }).catch(() => {});
  };

  const openNew = () => { setEditId(null); setForm({ text: "", aba_standard: "", category: "", is_required: true, bar_subject: "" }); setShowForm(true); };
  const openEdit = (o) => { setEditId(o.id); setForm({ text: o.text, aba_standard: o.aba_standard || "", category: o.category || "", is_required: o.is_required ?? true, bar_subject: o.bar_subject || "" }); setShowForm(true); };
  const cancel = () => { setShowForm(false); setEditId(null); };

  const save = async () => {
    if (!form.text.trim()) return; setSaving(true);
    try {
      if (editId) {
        const u = await api("/api/program-outcomes/" + editId, { method: "PUT", body: JSON.stringify(form) });
        setOutcomes(prev => prev.map(o => o.id === editId ? u : o));
      } else {
        const c = await api("/api/program-outcomes", { method: "POST", body: JSON.stringify(form) });
        setOutcomes(prev => [...prev, c]);
      }
      cancel();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this program outcome?")) return;
    try { await api("/api/program-outcomes/" + id, { method: "DELETE" }); setOutcomes(prev => prev.filter(o => o.id !== id)); }
    catch (e) { alert(e.message); }
  };

  const addTemplate = async () => {
    if (!templateCode || !templateForm.text.trim()) return; setSavingTemplate(true);
    try {
      const t = await api("/api/course-templates/" + templateCode + "/outcomes", { method: "POST", body: JSON.stringify(templateForm) });
      setTemplates(prev => ({ ...prev, [templateCode]: [...(prev[templateCode] || []), t] }));
      setTemplateForm({ text: "", aba_standard: "", category: "", program_outcome_id: "" });
    } catch (e) { alert(e.message); } finally { setSavingTemplate(false); }
  };

  const deleteTemplate = async (code, id) => {
    if (!confirm("Delete this template outcome?")) return;
    try { await api("/api/course-template-outcomes/" + id, { method: "DELETE" }); setTemplates(prev => ({ ...prev, [code]: prev[code].filter(t => t.id !== id) })); }
    catch (e) { alert(e.message); }
  };

  const courseCodes = [...new Set(courses.map(c => c.code).filter(Boolean))].sort();

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Program Learning Outcomes</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>ABA Standard 302 · School-level competencies all graduates must demonstrate</div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: "1px solid " + C.border }}>
        {[["outcomes", "Outcomes (" + outcomes.length + ")"], ["coverage", "Coverage Map"], ["templates", "Course Templates"]].map(([id, label]) => (
          <button key={id} onClick={() => { setView(id); if (id === "coverage") loadCoverage(); }} style={{ padding: "8px 14px", background: "none", border: "none", borderBottom: view === id ? "2px solid " + C.navy : "2px solid transparent", color: view === id ? C.navy : C.muted, fontSize: 13, fontWeight: view === id ? 700 : 400, cursor: "pointer", marginBottom: -1 }}>{label}</button>
        ))}
      </div>

      {view === "outcomes" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <Btn onClick={openNew} variant="gold">+ Add Program Outcome</Btn>
          </div>
          {showForm && (
            <Card style={{ marginBottom: 18, background: C.linen }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>{editId ? "Edit Program Outcome" : "New Program Outcome"}</div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Outcome Statement *</label>
                <textarea value={form.text} onChange={e => setForm(p => ({ ...p, text: e.target.value }))} autoFocus placeholder="Graduates will demonstrate..." style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, minHeight: 70, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>ABA Standard</label>
                  <select value={form.aba_standard} onChange={e => setForm(p => ({ ...p, aba_standard: e.target.value }))} style={{ width: "100%", padding: "8px 10px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13 }}>
                    <option value="">— None —</option>
                    {ABA_STANDARDS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Category</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ width: "100%", padding: "8px 10px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13 }}>
                    <option value="">— None —</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Bar Subject</label>
                  <select value={form.bar_subject} onChange={e => setForm(p => ({ ...p, bar_subject: e.target.value }))} style={{ width: "100%", padding: "8px 10px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13 }}>
                    <option value="">— None —</option>
                    {BAR_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.is_required} onChange={e => setForm(p => ({ ...p, is_required: e.target.checked }))} />
                  Required for graduation
                </label>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={save} disabled={saving || !form.text.trim()} variant="gold">{saving ? "Saving..." : editId ? "Update" : "Create"}</Btn>
                <Btn onClick={cancel} variant="ghost">Cancel</Btn>
              </div>
            </Card>
          )}
          {loading ? <div style={{ color: C.muted, padding: 40, textAlign: "center" }}>Loading...</div> :
            outcomes.length === 0 && !showForm ? (
              <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🎓</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No program outcomes yet</div>
                <div style={{ fontSize: 13 }}>Define the competencies all graduates must demonstrate (ABA Standard 302).</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {outcomes.map((o, i) => (
                  <Card key={o.id} style={{ padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                          {o.is_required && <span style={{ fontSize: 11, padding: "2px 8px", background: C.navy, color: "#fff", borderRadius: 10, fontWeight: 600 }}>Required</span>}
                          {o.aba_standard && <span style={{ fontSize: 11, padding: "2px 8px", background: "#dbeafe", color: "#1d4ed8", borderRadius: 10, fontWeight: 600 }}>ABA {o.aba_standard}</span>}
                          {o.category && <span style={{ fontSize: 11, padding: "2px 8px", background: C.linen, color: C.muted, borderRadius: 10, border: "1px solid " + C.border }}>{o.category}</span>}
                          {o.bar_subject && <span style={{ fontSize: 11, padding: "2px 8px", background: "#f0fdf4", color: "#166534", borderRadius: 10, border: "1px solid #bbf7d0" }}>Bar: {o.bar_subject}</span>}
                          {o.course_outcome_count > 0 && <span style={{ fontSize: 11, padding: "2px 8px", background: C.linen, color: C.muted, borderRadius: 10 }}>{o.course_outcome_count} course outcome{o.course_outcome_count > 1 ? "s" : ""}</span>}
                        </div>
                        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}><span style={{ fontWeight: 700, color: C.muted, marginRight: 8 }}>{i + 1}.</span>{o.text}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => openEdit(o)} style={{ background: "none", border: "1px solid " + C.border, borderRadius: 5, padding: "4px 10px", fontSize: 12, color: C.muted, cursor: "pointer" }}>Edit</button>
                        <button onClick={() => remove(o.id)} style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 5, padding: "4px 10px", fontSize: 12, color: "#dc2626", cursor: "pointer" }}>Delete</button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )
          }
        </>
      )}

      {view === "coverage" && (
        <div>
          {loadingCoverage ? <div style={{ color: C.muted, padding: 40, textAlign: "center" }}>Loading coverage map...</div> :
            coverage.length === 0 ? <div style={{ textAlign: "center", color: C.muted, padding: 40, fontSize: 13 }}>No coverage data yet. Add program outcomes and map course outcomes to them.</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {coverage.map((po, i) => (
                  <Card key={po.id} style={{ padding: 16 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      {po.is_required && <span style={{ fontSize: 11, padding: "2px 8px", background: C.navy, color: "#fff", borderRadius: 10, fontWeight: 600 }}>Required</span>}
                      {po.aba_standard && <span style={{ fontSize: 11, padding: "2px 8px", background: "#dbeafe", color: "#1d4ed8", borderRadius: 10, fontWeight: 600 }}>ABA {po.aba_standard}</span>}
                      <span style={{ fontSize: 11, padding: "2px 8px", background: po.courses.length > 0 ? "#dcfce7" : "#fee2e2", color: po.courses.length > 0 ? "#166534" : "#dc2626", borderRadius: 10, fontWeight: 600 }}>
                        {po.courses.length > 0 ? po.courses.length + " course(s) cover this" : "⚠ Not covered by any course"}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: po.courses.length ? 10 : 0 }}><span style={{ color: C.muted, marginRight: 6 }}>{i + 1}.</span>{po.text}</div>
                    {po.courses.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {[...new Map(po.courses.map(c => [c.course_id, c])).values()].map(c => (
                          <span key={c.course_id} style={{ fontSize: 12, padding: "3px 10px", background: C.linen, border: "1px solid " + C.border, borderRadius: 6, color: C.text }}>{c.course_code} · {c.course_title}</span>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )
          }
        </div>
      )}

      {view === "templates" && (
        <div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Template outcomes are the <strong>minimum required outcomes</strong> for all sections of a course code. Every instructor must cover them.</div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Select Course Code</label>
            <select value={templateCode} onChange={e => { setTemplateCode(e.target.value); loadTemplates(e.target.value); }} style={{ padding: "9px 12px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 14, background: "#fff", minWidth: 200 }}>
              <option value="">Select course code...</option>
              {courseCodes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {templateCode && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {(templates[templateCode] || []).length === 0 ? (
                  <div style={{ color: C.muted, fontSize: 13, padding: "12px 0" }}>No template outcomes for {templateCode} yet.</div>
                ) : (templates[templateCode] || []).map((t, i) => (
                  <Card key={t.id} style={{ padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                          {t.aba_standard && <span style={{ fontSize: 11, padding: "2px 7px", background: "#dbeafe", color: "#1d4ed8", borderRadius: 8, fontWeight: 600 }}>ABA {t.aba_standard}</span>}
                          {t.category && <span style={{ fontSize: 11, padding: "2px 7px", background: C.linen, color: C.muted, borderRadius: 8, border: "1px solid " + C.border }}>{t.category}</span>}
                        </div>
                        <div style={{ fontSize: 13, color: C.text }}><span style={{ color: C.muted, marginRight: 6 }}>{i + 1}.</span>{t.text}</div>
                      </div>
                      <button onClick={() => deleteTemplate(templateCode, t.id)} style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 5, padding: "4px 10px", fontSize: 12, color: "#dc2626", cursor: "pointer", flexShrink: 0, marginLeft: 8 }}>Delete</button>
                    </div>
                  </Card>
                ))}
              </div>
              <Card style={{ background: C.linen }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Add Required Outcome for {templateCode}</div>
                <textarea value={templateForm.text} onChange={e => setTemplateForm(p => ({ ...p, text: e.target.value }))} placeholder="All sections must ensure students can..." style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13, minHeight: 60, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 10 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>ABA Standard</label>
                    <select value={templateForm.aba_standard} onChange={e => setTemplateForm(p => ({ ...p, aba_standard: e.target.value }))} style={{ width: "100%", padding: "8px 10px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 12 }}>
                      <option value="">— None —</option>
                      {ABA_STANDARDS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Category</label>
                    <select value={templateForm.category} onChange={e => setTemplateForm(p => ({ ...p, category: e.target.value }))} style={{ width: "100%", padding: "8px 10px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 12 }}>
                      <option value="">— None —</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Maps to Program Outcome</label>
                    <select value={templateForm.program_outcome_id} onChange={e => setTemplateForm(p => ({ ...p, program_outcome_id: e.target.value }))} style={{ width: "100%", padding: "8px 10px", background: "#fff", border: "1px solid " + C.border, borderRadius: 6, fontSize: 12 }}>
                      <option value="">— None —</option>
                      {outcomes.map(o => <option key={o.id} value={o.id}>{o.text.slice(0, 50)}{o.text.length > 50 ? "..." : ""}</option>)}
                    </select>
                  </div>
                </div>
                <Btn onClick={addTemplate} disabled={savingTemplate || !templateForm.text.trim()} variant="gold">{savingTemplate ? "Adding..." : "Add Template Outcome"}</Btn>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERTS PAGE (top-level nav)
// ─────────────────────────────────────────────────────────────────────────────
function AlertsPage({ courses }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api("/api/academic-alerts").then(r => setAlerts(Array.isArray(r) ? r : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const sevColor = { warning: { color: "#d97706", bg: "#fef3c7" }, serious: { color: "#b45309", bg: "#fde68a" }, critical: { color: "#dc2626", bg: "#fee2e2" } };
  const statusColor = { open: { color: "#dc2626", bg: "#fee2e2" }, in_progress: { color: "#d97706", bg: "#fef3c7" }, resolved: { color: "#16a34a", bg: "#dcfce7" } };
  const sevOrder = { critical: 0, serious: 1, warning: 2 };

  const filtered = alerts
    .filter(a => filter === "all" ? true : filter === "open" ? ["open", "in_progress"].includes(a.status) : a.status === filter)
    .sort((a, b) => (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3));

  const openCount = alerts.filter(a => ["open", "in_progress"].includes(a.status)).length;
  const criticalCount = alerts.filter(a => a.severity === "critical" && a.status !== "resolved").length;

  const openAlert = async (a) => {
    try { const full = await api("/api/academic-alerts/" + a.id); setSelected(full); }
    catch { setSelected(a); }
  };

  if (selected) return (
    <div style={{ maxWidth: 720 }}>
      <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 13, marginBottom: 16, padding: 0 }}>← Back to Alerts</button>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>{selected.student_first} {selected.student_last}</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>{selected.course_code} · {selected.course_title}</div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: (sevColor[selected.severity] || sevColor.warning).bg, color: (sevColor[selected.severity] || sevColor.warning).color }}>{selected.severity}</span>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: (statusColor[selected.status] || statusColor.open).bg, color: (statusColor[selected.status] || statusColor.open).color }}>{selected.status?.replace("_", " ")}</span>
        </div>
        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6, marginBottom: 10 }}>{selected.description}</div>
        <div style={{ fontSize: 12, color: C.muted }}>Raised by {selected.creator_first} {selected.creator_last} · {selected.created_at && new Date(selected.created_at).toLocaleDateString()}</div>
        {selected.resolution_notes && <div style={{ marginTop: 10, padding: "10px 12px", background: "#dcfce7", borderRadius: 6, fontSize: 13, color: "#166534" }}>✓ {selected.resolution_notes}</div>}
      </Card>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>Interventions ({(selected.interventions || []).length})</div>
      {(selected.interventions || []).length === 0 ? <div style={{ color: C.muted, fontSize: 13 }}>No interventions logged yet.</div> :
        (selected.interventions || []).map((iv, idx) => (
          <Card key={idx} style={{ marginBottom: 8, padding: 14, borderLeft: "3px solid " + C.gold }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.navy, textTransform: "capitalize" }}>{iv.action_type?.replace("_", " ")}</span>
              <span style={{ fontSize: 11, color: C.muted }}>{iv.logger_first} {iv.logger_last} · {iv.created_at && new Date(iv.created_at).toLocaleDateString()}</span>
            </div>
            <div style={{ fontSize: 13, color: C.text }}>{iv.notes}</div>
            {iv.next_steps && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Next: {iv.next_steps}</div>}
            {iv.follow_up_date && <div style={{ fontSize: 12, color: C.blue, marginTop: 2 }}>Follow-up: {new Date(iv.follow_up_date).toLocaleDateString()}</div>}
          </Card>
        ))
      }
    </div>
  );

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Academic Alerts</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>ABA Standard 303(b) · Students not making adequate progress</div>
      </div>

      {(openCount > 0 || criticalCount > 0) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {criticalCount > 0 && <Card style={{ padding: "12px 16px", background: "#fee2e2", border: "1px solid #fca5a5", flex: 1 }}><div style={{ fontSize: 20, fontWeight: 700, color: "#dc2626" }}>{criticalCount}</div><div style={{ fontSize: 12, color: "#dc2626" }}>Critical</div></Card>}
          <Card style={{ padding: "12px 16px", background: C.linen, flex: 1 }}><div style={{ fontSize: 20, fontWeight: 700, color: C.navy }}>{openCount}</div><div style={{ fontSize: 12, color: C.muted }}>Open</div></Card>
          <Card style={{ padding: "12px 16px", background: C.linen, flex: 1 }}><div style={{ fontSize: 20, fontWeight: 700, color: C.navy }}>{alerts.filter(a => a.status === "resolved").length}</div><div style={{ fontSize: 12, color: C.muted }}>Resolved</div></Card>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[["open", "Open"], ["resolved", "Resolved"], ["all", "All"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ padding: "6px 14px", background: filter === v ? C.navy : "none", color: filter === v ? "#fff" : C.muted, border: "1px solid " + C.border, borderRadius: 6, cursor: "pointer", fontSize: 13 }}>{l}</button>
        ))}
      </div>

      {loading ? <div style={{ color: C.muted, padding: 40, textAlign: "center" }}>Loading...</div> :
        filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: C.muted, padding: 60 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>No {filter === "all" ? "" : filter} alerts</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(a => (
              <Card key={a.id} as="button" style={{ padding: 14, cursor: "pointer", textAlign: "left", width: "100%" }} onClick={() => openAlert(a)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 8, background: (sevColor[a.severity] || sevColor.warning).bg, color: (sevColor[a.severity] || sevColor.warning).color }}>{a.severity}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 8, background: (statusColor[a.status] || statusColor.open).bg, color: (statusColor[a.status] || statusColor.open).color }}>{a.status?.replace("_", " ")}</span>
                      {a.course_code && <span style={{ fontSize: 11, color: C.muted }}>{a.course_code}</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{a.student_first} {a.student_last}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{a.description?.slice(0, 100)}{a.description?.length > 100 ? "..." : ""}</div>
                  </div>
                  <span style={{ color: C.muted, fontSize: 16, marginLeft: 8 }}>›</span>
                </div>
              </Card>
            ))}
          </div>
        )
      }
    </div>
  );
}

// ── QuestionBankPage ───────────────────────────────────────────────────────
function QuestionBankPage({ user, courses }) {
  const [tab, setTab] = useState("mine");
  const [questions, setQuestions] = useState([]);
  const [shared, setShared] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newQ, setNewQ] = useState({ type: "sa", text: "", pts: 10, answer: "", topic: "", outcome_id: "" });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editQ, setEditQ] = useState({});

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api("/api/question-bank").catch(() => []),
      api("/api/question-bank/shared").catch(() => []),
    ]).then(([mine, sh]) => {
      setQuestions(Array.isArray(mine) ? mine : []);
      setShared(Array.isArray(sh) ? sh : []);
    }).finally(() => setLoading(false));
  }, []);

  const QTYPES = [
    { value: "sa", label: "Short Answer" },
    { value: "mc", label: "Multiple Choice" },
    { value: "tf", label: "True / False" },
    { value: "essay", label: "Essay" },
    { value: "numerical", label: "Numerical" },
    { value: "matching", label: "Matching" },
  ];

  const fieldStyle = { width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" };
  const labelStyle = { fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" };

  const createQuestion = async () => {
    if (!newQ.text.trim()) return;
    setSaving(true);
    try {
      const q = await api("/api/question-bank", { method: "POST", body: JSON.stringify(newQ) });
      setQuestions(prev => [q, ...prev]);
      setNewQ({ type: "sa", text: "", pts: 10, answer: "", topic: "", outcome_id: "" });
      setShowNew(false);
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  const deleteQuestion = async (id) => {
    if (!window.confirm("Delete this question?")) return;
    try {
      await api("/api/question-bank/" + id, { method: "DELETE" });
      setQuestions(prev => prev.filter(q => q.id !== id));
    } catch (e) { alert(e.message); }
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const updated = await api("/api/question-bank/" + editingId, { method: "PUT", body: JSON.stringify(editQ) });
      setQuestions(prev => prev.map(q => q.id === editingId ? updated : q));
      setEditingId(null);
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  const QuestionForm = ({ q, setQ, onSave, onCancel, saveLabel }) => (
    <div>
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Question Text</label>
        <textarea value={q.text || ""} onChange={e => setQ(p => ({ ...p, text: e.target.value }))} placeholder="Enter your question..." style={{ ...fieldStyle, minHeight: 80, resize: "vertical" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Type</label>
          <select value={q.type || "sa"} onChange={e => setQ(p => ({ ...p, type: e.target.value }))} style={fieldStyle}>
            {QTYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Points</label>
          <input type="number" value={q.pts || 10} onChange={e => setQ(p => ({ ...p, pts: e.target.value }))} style={fieldStyle} />
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Answer / Key (optional)</label>
        <input value={q.answer || ""} onChange={e => setQ(p => ({ ...p, answer: e.target.value }))} placeholder="Correct answer or grading notes..." style={fieldStyle} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Topic (optional)</label>
          <input value={q.topic || ""} onChange={e => setQ(p => ({ ...p, topic: e.target.value }))} placeholder="e.g. Constitutional Law..." style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Learning Outcome (optional)</label>
          <select value={q.outcome_id || ""} onChange={e => setQ(p => ({ ...p, outcome_id: e.target.value }))} style={fieldStyle}>
            <option value="">— None —</option>
            {(courses || []).flatMap(c => (c.outcomes || [])).filter((o,i,a) => a.findIndex(x => x.id === o.id) === i).map(o => (
              <option key={o.id} value={o.id}>{o.name || o.description || ("Outcome #" + o.id)}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSave} disabled={saving || !(q.text || "").trim()} style={{ padding: "7px 18px", background: C.gold, color: C.navy, border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "Saving..." : saveLabel}
          </button>
          <button onClick={onCancel} style={{ padding: "7px 14px", background: "#eee", color: C.muted, border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>Cancel</button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.muted, cursor: "pointer" }}>
          <input type="checkbox" checked={q.is_shared || false} onChange={e => setQ(p => ({ ...p, is_shared: e.target.checked }))} />
          Share with others
        </label>
      </div>
    </div>
  );

  const list = tab === "mine" ? questions : shared;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Question Bank</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Store and reuse questions across your courses</div>
        </div>
        <button onClick={() => setShowNew(!showNew)} style={{ padding: "8px 18px", background: C.gold, color: C.navy, border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + New Question
        </button>
      </div>

      {showNew && (
        <Card style={{ marginBottom: 16, background: C.linen }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: C.text }}>New Question</div>
          <QuestionForm q={newQ} setQ={setNewQ} onSave={createQuestion} onCancel={() => setShowNew(false)} saveLabel="Save Question" />
        </Card>
      )}

      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid " + C.border }}>
        {[
          { id: "mine", label: "My Questions (" + questions.length + ")" },
          { id: "shared", label: "Shared with Me (" + shared.length + ")" }
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 16px", background: "none", border: "none", borderBottom: tab === t.id ? "2px solid " + C.navy : "2px solid transparent", color: tab === t.id ? C.navy : C.muted, fontSize: 13, fontWeight: tab === t.id ? 700 : 400, cursor: "pointer", marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Loading...</div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{tab === "mine" ? "No questions yet" : "No shared questions"}</div>
          <div style={{ fontSize: 13 }}>{tab === "mine" ? "Create your first question to build your bank." : "Questions shared with you will appear here."}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map(q => {
            const isEditing = editingId === q.id;
            return (
              <Card key={q.id} style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: "#f0f4ff", color: C.navy, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {(QTYPES.find(t => t.value === q.type) || {}).label || q.type}
                        </span>
                        <span style={{ fontSize: 11, color: C.muted }}>{q.pts} pts</span>
                        {q.is_shared && (
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: "#e8f5e9", color: "#2d6b4a", fontWeight: 700 }}>Shared</span>
                        )}
                      </div>
                      <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{q.text}</div>
                      {q.answer && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Key: {q.answer}</div>}
                      {(q.topic || q.outcome_id) && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                          {q.topic && (
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#fef9e7", color: "#92600a", border: "1px solid #f0d080", fontWeight: 600 }}>📌 {q.topic}</span>
                          )}
                          {q.outcome_id && (
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#f0f4ff", color: C.navy, border: "1px solid #c8d4f0", fontWeight: 600 }}>🎯 Outcome #{q.outcome_id}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {tab === "mine" && !isEditing && (
                      <div style={{ display: "flex", gap: 6, marginLeft: 12, flexShrink: 0 }}>
                        <button
                          onClick={() => { setEditingId(q.id); setEditQ({ type: q.type, text: q.text, pts: q.pts, answer: q.answer || "", topic: q.topic || "", outcome_id: q.outcome_id || "", is_shared: q.is_shared || false }); }}
                          style={{ padding: "4px 10px", background: "none", border: "1px solid " + C.border, borderRadius: 6, fontSize: 12, color: C.muted, cursor: "pointer" }}
                        >Edit</button>
                        <button
                          onClick={() => deleteQuestion(q.id)}
                          style={{ padding: "4px 10px", background: "none", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 12, color: "#dc2626", cursor: "pointer" }}
                        >Delete</button>
                      </div>
                    )}
                  </div>
                </div>
                {isEditing && (
                  <div style={{ borderTop: "1px solid " + C.border, background: "#fafaf8", padding: 16 }} onClick={e => e.stopPropagation()}>
                    <QuestionForm q={editQ} setQ={setEditQ} onSave={saveEdit} onCancel={() => setEditingId(null)} saveLabel="Save Changes" />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function App() {
  const [user, setUserState] = useState(() => getUser());
  const [page, setPage] = useState("dashboard");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [dyslexia, setDyslexia] = useState(() => localStorage.getItem("lc_dyslexia") === "1");
  useEffect(() => {
    const STYLE_ID = "lc-dyslexic-style";
    let tag = document.getElementById(STYLE_ID);
    if (dyslexia) {
      if (!tag) { tag = document.createElement("style"); tag.id = STYLE_ID; document.head.appendChild(tag); }
      tag.textContent = 'html body *, html body { font-family: "OpenDyslexic", sans-serif !important; letter-spacing: 0.05em; word-spacing: 0.1em; line-height: 1.6; }';
    } else {
      if (tag) tag.remove();
    }
    localStorage.setItem("lc_dyslexia", dyslexia ? "1" : "0");
  }, [dyslexia]);
  useEffect(() => {
    if (!user) return; setLoadingCourses(true);
    api("/api/courses").then(data => setCourses(Array.isArray(data) ? data : data.courses || [])).catch(() => {}).finally(() => setLoadingCourses(false));
  }, [user]);
  const login = (u) => { setUser(u); setUserState(u); };
  const logout = () => { clearUser(); setUserState(null); setCourses([]); };
  if (!user) return <LoginScreen onLogin={login} />;
  if (user.role === "user") return (
    <div style={{ minHeight: "100vh", background: C.linen, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif" }}>
      <Card style={{ maxWidth: 400, textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>Student Account Detected</div>
        <div style={{ color: C.muted, fontSize: 14, marginBottom: 20 }}>This portal is for faculty and administrators.</div>
        <a href="https://classroom.lexcommons.org" style={{ display: "inline-block", padding: "10px 20px", background: C.navy, color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>Go to Classroom</a>
      </Card>
    </div>
  );
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.linen, fontFamily: "'Segoe UI', sans-serif", color: C.text }}>
      <Sidebar user={user} page={page} setPage={setPage} onLogout={logout} dyslexia={dyslexia} setDyslexia={setDyslexia} />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ padding: "28px 32px", maxWidth: 1100 }}>
          {loadingCourses ? <div style={{ color: C.muted, textAlign: "center", padding: 60 }}>Loading...</div> : (<>
            {page === "dashboard" && <Dashboard user={user} courses={courses} onSelectCourse={(c) => { setSelectedCourse(c); setPage("courses"); }} />}
            {page === "courses" && <CoursesPage courses={courses} setCourses={setCourses} user={user} initialCourse={selectedCourse} onClearSelected={() => setSelectedCourse(null)} />}
            {page === "students" && <StudentsPage courses={courses} />}
            {page === "grades" && <div style={{ color: C.muted }}>Select a course from My Courses to view the gradebook.</div>}
            {page === "program-outcomes" && <ProgramOutcomesPage courses={courses} />}
            {page === "faculty-service" && <FacultyServicePage user={user} />}
            {page === "scholarship" && <ScholarshipPage user={user} />}
            {page === "question-bank" && <QuestionBankPage user={user} courses={courses} />}
            {page === "alerts" && <AlertsPage courses={courses} />}
          </>)}
        </div>
      </div>
    </div>
  );
}

export default App;
