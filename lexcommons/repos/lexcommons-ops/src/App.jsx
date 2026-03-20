import TemplateLibrary from "./components/TemplateLibrary";
import { useState, useEffect, useRef } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const ROLES = {
  administrator: { label: "Administrator", level: 4, color: "#B91C1C" },
  manager:       { label: "Manager",       level: 3, color: "#e67e22" },
  faculty:       { label: "Faculty",       level: 2, color: "#3498db" },
  user:          { label: "User",          level: 1, color: "#2D8B55" },
};

const DEMO_USERS = [
  { id: 1, name: "Alexandra Voss",   email: "avoss@lexcommons.org",       role: "administrator", lastLogin: "2026-03-09", site: "all",                    active: true  },
  { id: 2, name: "Marcus Webb",      email: "mwebb@lexcommons.org",        role: "manager",       lastLogin: "2026-03-08", site: "lawschoolcommons.com",    active: true  },
  { id: 3, name: "Prof. Dana Osei",  email: "dosei@lawschoolcommons.com",  role: "faculty",       lastLogin: "2026-03-07", site: "lawschool.lexcommons.org", active: true  },
  { id: 4, name: "Prof. Lin Farris", email: "lfarris@lawschoolcommons.com",role: "faculty",       lastLogin: "2026-03-06", site: "lawschool.lexcommons.org", active: true  },
  { id: 5, name: "Jamie Tran",       email: "jtran@student.lsc.edu",       role: "user",          lastLogin: "2026-03-09", site: "lawschoolcommons.com",    active: true  },
  { id: 6, name: "Riley Santos",     email: "rsantos@student.lsc.edu",     role: "user",          lastLogin: "2026-03-05", site: "lawschoolcommons.com",    active: false },
  { id: 7, name: "Cleo Park",        email: "cpark@lexcommons.org",        role: "manager",       lastLogin: "2026-03-08", site: "cite.lexcommons.org",     active: true  },
];

const SITES = [
  { id: "lexcommons",    domain: "lexcommons.org",             label: "LexCommons",         type: "Umbrella",    ssl: true,  status: "live",  root: "/var/www/lexcommons",          index: "index.html" },
  { id: "legalskills",   domain: "lexcommons.org/legalskills", label: "LegalSkills",        type: "Path",        ssl: true,  status: "live",  root: "/var/www/lexcommons/legalskills", index: "index.html" },
  { id: "admin",         domain: "admin.lexcommons.org",       label: "AdminCommons",       type: "Admin App",   ssl: true,  status: "live",  root: "/var/www/lexcommons",          index: "admin.html" },
  { id: "lawschoolsub",  domain: "lawschool.lexcommons.org",   label: "LawSchool (sub)",    type: "Subdomain",   ssl: true,  status: "live",  root: "/var/www/lexcommons",          index: "lscommons.html" },
  { id: "lawschoolcom",  domain: "lawschoolcommons.com",       label: "LawSchoolCommons",   type: "Primary",     ssl: true,  status: "live",  root: "/var/www/lawschoolcommons",    index: "landing.html" },
  { id: "cite",          domain: "cite.lexcommons.org",        label: "CiteCommons",        type: "Proxy",       ssl: true,  status: "live",  root: "→ legalcitationchecker.org",   index: "—" },
];

const PAGES = [
  { id: 1, title: "Home",           slug: "/",               site: "lexcommons.org",          status: "published", modified: "2026-02-20" },
  { id: 2, title: "Terms",          slug: "/terms",          site: "lexcommons.org",          status: "published", modified: "2026-01-15" },
  { id: 3, title: "Privacy Policy", slug: "/privacy",        site: "lexcommons.org",          status: "published", modified: "2026-01-15" },
  { id: 4, title: "Contact",        slug: "/contact",        site: "lexcommons.org",          status: "published", modified: "2026-01-10" },
  { id: 5, title: "Landing",        slug: "/",               site: "lawschoolcommons.com",    status: "published", modified: "2026-03-01" },
  { id: 6, title: "App",            slug: "/app",            site: "lawschoolcommons.com",    status: "published", modified: "2026-03-07" },
  { id: 7, title: "Professor Portal",slug: "/professor",     site: "lawschoolcommons.com",    status: "published", modified: "2026-02-28" },
  { id: 8, title: "Admin Portal",   slug: "/admin",          site: "lawschoolcommons.com",    status: "published", modified: "2026-02-14" },
  { id: 9, title: "Reset Password", slug: "/reset-password", site: "lawschoolcommons.com",    status: "published", modified: "2026-01-20" },
  { id: 10, title: "Home",          slug: "/",               site: "lawschool.lexcommons.org", status: "published", modified: "2026-02-10" },
  { id: 11, title: "Home",          slug: "/legalskills",    site: "lexcommons.org/legalskills", status: "published", modified: "2026-03-09" },
];


// ─── Permissions ──────────────────────────────────────────────────────────────

const can = (role, action) => {
  const level = ROLES[role]?.level || 0;
  const perms = {
    viewDashboard:   1, viewPages:      2, viewSites:      3,
    viewUsers:       2, editPages:      2, manageSettings: 3,
    editUsers:       3, addUsers:       3, manageNginx:    4,
    manageSSL:       4, deleteUsers:    4, editSiteConfig: 4,
  };
  return level >= (perms[action] || 99);
};

// ─── Icons (inline SVG) ───────────────────────────────────────────────────────

const Icon = ({ name, size = 16 }) => {
  const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    sites:     <><circle cx="12" cy="12" r="9"/><path d="M12 3a15 15 0 0 1 0 18M3 12h18"/><path d="M4.2 7.5h15.6M4.2 16.5h15.6"/></>,
    pages:     <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
    users:     <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    lock:      <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    check:     <><polyline points="20 6 9 17 4 12"/></>,
    alert:     <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    server:    <><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></>,
    shield:    <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    logout:    <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    plus:      <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    edit:      <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash:     <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
    refresh:   <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>,
    chevron:   <><polyline points="9 18 15 12 9 6"/></>,
    activity:  <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    search:    <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

// ─── Subcomponents ────────────────────────────────────────────────────────────

const RoleBadge = ({ role }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "2px 8px", borderRadius: 3, fontSize: 13, fontWeight: 600,
    background: ROLES[role]?.color + "22", color: ROLES[role]?.color,
    border: `1px solid ${ROLES[role]?.color}44`, letterSpacing: "0.05em",
    textTransform: "uppercase",
  }}>
    {ROLES[role]?.label}
  </span>
);

const StatusDot = ({ live }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 14, color: live ? "#2D8B55" : "#B91C1C" }}>
    <span style={{ width: 7, height: 7, borderRadius: "50%", background: live ? "#2D8B55" : "#B91C1C", display: "inline-block", boxShadow: live ? "0 0 5px #27ae60aa" : "none" }} />
    {live ? "Live" : "Down"}
  </span>
);

// ─── Pages ────────────────────────────────────────────────────────────────────

// ─── App Switcher ─────────────────────────────────────────────────────────────

const ALL_PRODUCTS = [
  { id: "lawschool",  label: "Law School Commons", icon: "📚", url: "https://lawschoolcommons.com",        minLevel: 1 },
  { id: "cite",       label: "Cite Commons",        icon: "§",  url: "https://cite.lexcommons.org",         minLevel: 1 },
  { id: "admin",      label: "Admin Commons",       icon: "⚙️", url: "https://admin.lexcommons.org",        minLevel: 3 },
  { id: "classroom",  label: "Classroom Commons",   icon: "🎓", url: "https://classroom.lexcommons.org",    minLevel: 2 },
  { id: "faculty",    label: "Faculty Commons",     icon: "👩‍🏫", url: "https://faculty.lexcommons.org",      minLevel: 2 },
  { id: "clinic",     label: "Clinic Commons",      icon: "⚖️", url: "https://clinic.lexcommons.org",       minLevel: 2 },
  { id: "data",       label: "Data Center",         icon: "📊", url: "https://data.lexcommons.org",         minLevel: 3 },
  { id: "lawfirm",    label: "Law Firm Commons",    icon: "🏛️", url: "https://lawfirmcommons.com",          minLevel: 3, planned: true },
];

function ssoUrl(url) {
  try { const u = JSON.parse(localStorage.getItem("lc_user")); if (u && u.token) return url + "?sso_token=" + u.token; } catch(e) {}
  return url;
}

function AppSwitcher({ role }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const level = ROLES[role]?.level || 0;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="LexCommons apps"
        style={{ width: 28, height: 28, borderRadius: 6, background: open ? "rgba(201,168,76,0.2)" : "transparent",
          border: "1px solid transparent", cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", color: "#C9A84C", transition: "all 0.15s",
          ...(open ? {} : { ":hover": { background: "rgba(255,255,255,0.08)" } }) }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="4" height="4" rx="1"/>
          <rect x="6" y="1" width="4" height="4" rx="1"/>
          <rect x="11" y="1" width="4" height="4" rx="1"/>
          <rect x="1" y="6" width="4" height="4" rx="1"/>
          <rect x="6" y="6" width="4" height="4" rx="1"/>
          <rect x="11" y="6" width="4" height="4" rx="1"/>
          <rect x="1" y="11" width="4" height="4" rx="1"/>
          <rect x="6" y="11" width="4" height="4" rx="1"/>
          <rect x="11" y="11" width="4" height="4" rx="1"/>
        </svg>
      </button>

      {open && (
        <div style={{ position: "absolute", top: 36, left: 0, width: 280, background: "#111827",
          border: "1px solid #1e2432", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          padding: "12px", zIndex: 9999 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7B8D", textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: 10, paddingLeft: 4 }}>LexCommons Suite</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {ALL_PRODUCTS.map(p => {
              const accessible = level >= p.minLevel && !p.planned;
              return (
                <a key={p.id} href={accessible ? ssoUrl(p.url) : undefined}
                  target={accessible ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  onClick={!accessible ? e => e.preventDefault() : undefined}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    padding: "12px 8px", borderRadius: 8, textDecoration: "none",
                    background: accessible ? "rgba(255,255,255,0.04)" : "transparent",
                    border: `1px solid ${accessible ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)"}`,
                    cursor: accessible ? "pointer" : "default",
                    opacity: accessible ? 1 : 0.35,
                    transition: "all 0.15s" }}>
                  <span style={{ fontSize: 22 }}>{p.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: accessible ? "#C4D0DE" : "#6B7B8D",
                    textAlign: "center", lineHeight: 1.3 }}>{p.label}</span>
                  {p.planned && (
                    <span style={{ fontSize: 9, color: "#C9A84C", fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.06em" }}>Soon</span>
                  )}
                </a>
              );
            })}
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1e2432",
            fontSize: 11, color: "#6B7B8D", textAlign: "center" }}>
            Greyed out = upgrade to unlock
          </div>
        </div>
      )}
    </div>
  );
}


function Dashboard({ currentUser }) {
  const [stats, setStats] = useState([
    { label: "Sites",      value: "…", icon: "sites",   color: "#3498db" },
    { label: "Pages",      value: "…", icon: "pages",   color: "#9b59b6" },
    { label: "Users",      value: "…", icon: "users",   color: "#e67e22" },
    { label: "Deployed",   value: "…", icon: "shield",  color: "#2D8B55" },
  ]);

  const [certs, setCerts]               = useState(null);
  const [certsLoading, setCertsLoading] = useState(true);
  const [certsCheckedAt, setCertsCheckedAt] = useState(null);
  const [activity, setActivity]         = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/stats`, {
          headers: { Authorization: `Bearer ${currentUser.token}` }
        });
        const d = await res.json();
        if (!res.ok) return;
        setStats([
          { label: "Sites",    value: SITES.length,                    icon: "sites",  color: "#3498db" },
          { label: "Pages",    value: d.pages,                         icon: "pages",  color: "#9b59b6" },
          { label: "Users",    value: `${d.activeUsers}/${d.users}`,   icon: "users",  color: "#e67e22" },
          { label: "Deployed", value: `${d.deployed}/${d.pages}`,      icon: "shield", color: "#2D8B55" },
        ]);
      } catch {}
    })();
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/ssl`, {
          headers: { Authorization: `Bearer ${currentUser.token}` }
        });
        const d = await res.json();
        if (res.ok) { setCerts(d.certs); setCertsCheckedAt(d.checkedAt); }
      } catch {}
      finally { setCertsLoading(false); }
    })();
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/activity?limit=8`, {
          headers: { Authorization: `Bearer ${currentUser.token}` }
        });
        const d = await res.json();
        if (res.ok) setActivity(Array.isArray(d) ? d : []);
      } catch {}
      finally { setActivityLoading(false); }
    })();
  }, []);

  return (
    <div>
      {/* ── Portal Tiles ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>Welcome back, {currentUser.name.split(" ")[0]}.</h2>
            <p style={{ color: "#6B7B8D", marginTop: 4, fontSize: 15 }}>Your LexCommons suite</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          {ALL_PRODUCTS.map(p => {
            const level = ROLES[currentUser.role]?.level || 0;
            const accessible = level >= p.minLevel && !p.planned;
            return (
              <a key={p.id} href={accessible ? ssoUrl(p.url) : undefined}
                target={accessible ? "_blank" : undefined}
                rel="noopener noreferrer"
                onClick={!accessible ? e => e.preventDefault() : undefined}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                  padding: "20px 12px", borderRadius: 12, textDecoration: "none",
                  background: accessible ? "#FFFFFF" : "#F8F9FA",
                  border: `1.5px solid ${accessible ? "rgba(11,29,58,0.1)" : "rgba(11,29,58,0.05)"}`,
                  boxShadow: accessible ? "0 2px 12px rgba(11,29,58,0.06)" : "none",
                  cursor: accessible ? "pointer" : "default",
                  opacity: accessible ? 1 : 0.45,
                  transition: "all 0.15s",
                  position: "relative" }}>
                <span style={{ fontSize: 28 }}>{p.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: accessible ? "#0B1D3A" : "#9CA3AF",
                  textAlign: "center", lineHeight: 1.3 }}>{p.label}</span>
                {p.planned && (
                  <span style={{ position: "absolute", top: 8, right: 8, fontSize: 9, color: "#C9A84C",
                    fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                    background: "rgba(201,168,76,0.15)", padding: "2px 5px", borderRadius: 3 }}>Soon</span>
                )}
                {!accessible && !p.planned && (
                  <span style={{ position: "absolute", top: 8, right: 8, fontSize: 9, color: "#9CA3AF",
                    fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                    background: "rgba(0,0,0,0.06)", padding: "2px 5px", borderRadius: 3 }}>Upgrade</span>
                )}
              </a>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>Network at a glance</h2>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: "#FFFFFF", border: "1px solid #252c3a", borderRadius: 8, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#0B1D3A", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 14, color: "#6B7B8D", marginTop: 4 }}>{s.label}</div>
            </div>
            <div style={{ color: s.color, opacity: 0.85 }}><Icon name={s.icon} size={22} /></div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>
        {/* Sites overview */}
        <div style={{ background: "#FFFFFF", border: "1px solid #252c3a", borderRadius: 8, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>Sites</h3>
            <span style={{ fontSize: 13, color: "#2D8B55" }}>All systems operational</span>
          </div>
          {SITES.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #1e2432" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: "#D4CFC0", display: "flex", alignItems: "center", justifyContent: "center", color: "#C9A84C" }}>
                  <Icon name="sites" size={14} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1A2E" }}>{s.label}</div>
                  <div style={{ fontSize: 13, color: "#6B7B8D" }}>{s.domain}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13, color: "#6B7B8D", background: "#F0EAD6", padding: "2px 7px", borderRadius: 3 }}>{s.type}</span>
                <StatusDot live={s.status === "live"} />
              </div>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div style={{ background: "#FFFFFF", border: "1px solid #252c3a", borderRadius: 8, padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: "0 0 16px 0" }}>Recent Activity</h3>
          {activityLoading ? (
            <div style={{ color: "#8DA4BE", fontSize: 14 }}>Loading…</div>
          ) : activity.length === 0 ? (
            <div style={{ color: "#8DA4BE", fontSize: 14 }}>No activity yet.</div>
          ) : activity.map((a, i) => {
            const typeColors = { config: "#e67e22", ssl: "#2D8B55", user: "#3498db", page: "#9b59b6", deploy: "#B91C1C", login: "#8DA4BE", general: "#555" };
            const ts = a.created_at ? (() => {
              const d = new Date(a.created_at), now = new Date();
              const diff = (now - d) / 1000;
              if (diff < 60) return "Just now";
              if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
              if (diff < 86400) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              if (diff < 172800) return "Yesterday";
              return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            })() : "";
            return (
              <div key={a.id || i} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: typeColors[a.type] || "#555", marginTop: 5, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, color: "#3D3D56" }}>{a.action}</div>
                  <div style={{ fontSize: 13, color: "#6B7B8D", marginTop: 2 }}>{a.user_name} · {ts}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SSL Certificates */}
      <div style={{ background: "#FFFFFF", border: "1px solid #252c3a", borderRadius: 8, padding: 20, marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>SSL Certificates</h3>
          {certsCheckedAt && <span style={{ fontSize: 12, color: "#8DA4BE" }}>Checked {new Date(certsCheckedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
        {certsLoading ? (
          <div style={{ color: "#8DA4BE", fontSize: 14 }}>Checking certificates…</div>
        ) : certs ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(150px, 1fr))", gap: 10, overflowX: "auto" }}>
            {certs.map(c => {
              const ok      = !c.error && c.daysLeft > 30;
              const warn    = !c.error && c.daysLeft <= 30 && c.daysLeft > 14;
              const danger  = !c.error && c.daysLeft <= 14;
              const bg      = c.error ? "#fff5f5" : danger ? "#fff5f5" : warn ? "#fffbeb" : "#f0fdf4";
              const border  = c.error ? "#fca5a5" : danger ? "#fca5a5" : warn ? "#fcd34d" : "#86efac";
              const txtCol  = c.error ? "#B91C1C" : danger ? "#B91C1C" : warn ? "#92400e" : "#166534";
              const days    = c.error ? "Error" : `${c.daysLeft}d`;
              return (
                <div key={c.domain} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 7, padding: "12px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0B1D3A", marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: "#6B7B8D", marginBottom: 6, fontFamily: "monospace" }}>{c.domain}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: txtCol, lineHeight: 1 }}>{days}</div>
                  {!c.error && <div style={{ fontSize: 11, color: "#8DA4BE", marginTop: 3 }}>Expires {c.validTo}</div>}
                  {c.error  && <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 3 }}>{c.error}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: "#B91C1C", fontSize: 14 }}>Could not load certificate data.</div>
        )}
      </div>

      {/* Server info */}
      <div style={{ background: "#FFFFFF", border: "1px solid #252c3a", borderRadius: 8, padding: 16, marginTop: 14, display: "flex", gap: 24, flexWrap: "wrap" }}>
        {[
          ["Server", "srv1447801 (45.82.72.210)"],
          ["OS", "Ubuntu 24.04"],
          ["nginx", "1.24"],
          ["SSL Provider", "Let's Encrypt"],
          ["Gzip", "Enabled (level 5)"],
          ["Server Tokens", "Off"],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 12, color: "#8DA4BE", textTransform: "uppercase", letterSpacing: "0.08em" }}>{k}</div>
            <div style={{ fontSize: 15, color: "#3D3D56", marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SitesPage({ currentRole }) {
  const [selected, setSelected] = useState(null);
  const site = selected ? SITES.find(s => s.id === selected) : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>Sites</h2>
          <p style={{ color: "#6B7B8D", marginTop: 4, fontSize: 15 }}>Manage all domains in the LexCommons network.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 360px" : "1fr", gap: 14 }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #252c3a", borderRadius: 8, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #252c3a" }}>
                {["Site", "Domain", "Type", "Root", "Index", "SSL", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 13, color: "#8B7333", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SITES.map(s => (
                <tr key={s.id} onClick={() => setSelected(s.id === selected ? null : s.id)}
                  style={{ borderBottom: "1px solid #1a1f2c", cursor: "pointer", background: selected === s.id ? "#F0EAD6" : "transparent", transition: "background 0.15s" }}>
                  <td style={{ padding: "11px 14px", fontSize: 15, fontWeight: 600, color: "#1A1A2E" }}>{s.label}</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, color: "#C9A84C", fontFamily: "monospace" }}>{s.domain}</td>
                  <td style={{ padding: "11px 14px" }}><span style={{ fontSize: 13, color: "#6B7B8D", background: "#F0EAD6", padding: "2px 7px", borderRadius: 3 }}>{s.type}</span></td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "#6B7B8D", fontFamily: "monospace", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.root}</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "#6B7B8D", fontFamily: "monospace" }}>{s.index}</td>
                  <td style={{ padding: "11px 14px" }}><span style={{ color: "#2D8B55", fontSize: 14 }}>✓</span></td>
                  <td style={{ padding: "11px 14px" }}><StatusDot live /></td>
                  <td style={{ padding: "11px 14px", color: "#6B7B8D" }}>
                    {can(currentRole, "editSiteConfig") && <Icon name="edit" size={14} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {site && (
          <div style={{ background: "#FFFFFF", border: "1px solid #252c3a", borderRadius: 8, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>{site.label}</h3>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#6B7B8D", cursor: "pointer", fontSize: 19 }}>×</button>
            </div>
            {[
              ["Domain", site.domain], ["Type", site.type], ["Web Root", site.root],
              ["Index File", site.index], ["SSL", "Let's Encrypt ✓"],
              ["Status", "Live ✓"], ["HTTP→HTTPS", "301 redirect"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e2432", fontSize: 15 }}>
                <span style={{ color: "#6B7B8D" }}>{k}</span>
                <span style={{ color: "#3D3D56", fontFamily: k === "Domain" || k === "Web Root" ? "monospace" : "inherit", fontSize: k === "Web Root" ? 11 : 13 }}>{v}</span>
              </div>
            ))}
            {can(currentRole, "manageNginx") && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#6B7B8D", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>nginx Config</div>
                <div style={{ background: "#FAF6EE", border: "1px solid #1e2432", borderRadius: 6, padding: 12, fontSize: 13, color: "#1A3668", fontFamily: "monospace", lineHeight: 1.7 }}>
                  {site.type === "Path" ? (
                    <>location /legalskills &#123;<br/>
                    &nbsp;&nbsp;root {site.root};<br/>
                    &nbsp;&nbsp;index {site.index};<br/>
                    &nbsp;&nbsp;try_files $uri $uri/ /legalskills/index.html;<br/>
                    &#125;</>
                  ) : (
                    <>server_name {site.domain};<br/>
                    root {site.root};<br/>
                    include snippets/lc-security.conf;<br/>
                    include snippets/lc-static-cache.conf;</>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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

const PAGE_BLOCKS = {
  1:  [
    { id: "b1", type: "hero",    data: { headline: "LexCommons", subline: "A network of legal education and citation tools for students, faculty, and practitioners.", btnText: "Explore Tools", btnLink: "#", bgColor: "#0B1D3A", textColor: "#ffffff", align: "center" } },
    { id: "b2", type: "cards",   data: { cards: [{ title: "CiteCommons", body: "Legal citation checker and validator.", link: "#", icon: "📋" }, { title: "LawSchoolCommons", body: "Coursework and faculty tools.", link: "#", icon: "⚖️" }, { title: "LegalSkills", body: "Writing, research, and advocacy resources.", link: "#", icon: "📚" }] } },
    { id: "b3", type: "cta",     data: { heading: "Join the LexCommons Network", body: "Free for law students and faculty.", btnText: "Get Access", btnLink: "#", bgColor: "#0B1D3A", btnColor: "#C9A84C" } },
  ],
  2:  [
    { id: "b1", type: "heading", data: { text: "Terms of Service", level: "h2", align: "left", color: "#1A1A2E" } },
    { id: "b2", type: "text",    data: { content: "These Terms of Service govern your use of the LexCommons network of sites and services. By accessing any LexCommons property, you agree to be bound by these terms.", align: "left" } },
    { id: "b3", type: "heading", data: { text: "Acceptable Use", level: "h3", align: "left", color: "#1A1A2E" } },
    { id: "b4", type: "list",    data: { items: ["Use the platform for lawful educational purposes only", "Do not attempt to reverse-engineer any LexCommons service", "Respect other users' privacy and intellectual property", "Report security vulnerabilities responsibly"], style: "bullet" } },
  ],
  5:  [
    { id: "b1", type: "hero",    data: { headline: "LawSchoolCommons", subline: "Your all-in-one platform for law school coursework, citation tools, and faculty resources.", btnText: "Sign In", btnLink: "/app", bgColor: "#0B1D3A", textColor: "#ffffff", align: "center" } },
    { id: "b2", type: "columns", data: { leftHeading: "For Students", leftContent: "Access course materials, track assignments, and connect with faculty all in one place.", rightHeading: "For Faculty", rightContent: "Manage courses, share materials, post announcements, and monitor student progress.", gap: "32px" } },
    { id: "b3", type: "divider", data: { label: "Features", color: "#D4CFC0", thickness: 1 } },
    { id: "b4", type: "cards",   data: { cards: [{ title: "Citation Tools", body: "Bluebook, ALWD, and more.", link: "#", icon: "📋" }, { title: "Case Library", body: "Annotated cases across all subjects.", link: "#", icon: "📚" }, { title: "Professor Portal", body: "Faculty management tools.", link: "#", icon: "🎓" }] } },
  ],
  11: [
    { id: "b1", type: "hero",    data: { headline: "LegalSkills", subline: "A curated library of legal writing, research, and advocacy resources.", btnText: "Browse Resources", btnLink: "#", bgColor: "#0B1D3A", textColor: "#e8f5e9", align: "left" } },
    { id: "b2", type: "heading", data: { text: "Core Competencies", level: "h2", align: "left", color: "#1A1A2E" } },
    { id: "b3", type: "columns", data: { leftHeading: "Legal Writing", leftContent: "Briefs, memos, contracts, and client letters — structured guides for every document type.", rightHeading: "Oral Advocacy", rightContent: "Moot court prep, oral argument techniques, and deposition strategies.", gap: "24px" } },
    { id: "b4", type: "quote",   data: { text: "The most important skill a lawyer can have is the ability to communicate clearly.", attribution: "Bryan Garner" } },
  ],
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

function PageEditor({ page, onSave, onClose, token }) {
  const [meta, setMeta] = useState({ title: page?.title||"", slug: page?.filename||"", site: page?.site||SITES[0].domain, status: "published" });
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
        const res = await fetch(`${API_URL}/api/pages/${page.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.content) {
          try {
            const parsed = JSON.parse(data.content);
            if (Array.isArray(parsed)) { setBlocks(parsed); return; }
          } catch {}
          // Raw HTML — load as html block
          setBlocks([{ id: "b" + Date.now(), type: "html", data: { code: data.content } }]);
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
      const content = JSON.stringify(blocks);
      const res = await fetch(`${API_URL}/api/pages/${page.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: meta.title, content, site: meta.site, filename: meta.slug }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error || "Save failed"); return; }
      onSave(data);
      setSavedMsg("Saved"); setSaved(true); setDirty(false);
      setTimeout(() => setSaved(false), 2200);
    } catch { setSaveError("Network error"); }
    finally { setSaving(false); }
  };

  const handlePull = async () => {
    setSaving(true); setSaveError("");
    try {
      const res = await fetch(`${API_URL}/api/pages/${page.id}/pull`, {
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

function PagesPage({ currentRole, token, currentUser }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [deploying, setDeploying] = useState(null);
  const [deployMsg, setDeployMsg] = useState({});

  const loadPages = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_URL}/api/pages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to load pages"); return; }
      setPages(data.pages);
    } catch { setError("Network error loading pages"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadPages(); }, []);

  const handleSave = (updated) => {
    setPages(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
    setEditing(null);
  };

  const blocksToHtml = (title, site, content) => {
    let blocks = [];
    try { const p = JSON.parse(content); if (Array.isArray(p)) blocks = p; } catch {}

    // If content is raw HTML (not blocks), return it as-is
    if (!blocks.length) return content || "";

    const blockHtml = blocks.map(b => {
      const d = b.data || {};
      switch (b.type) {
        case "html":     return d.code || "";
        case "emoji":    return `<div style="text-align:${d.align||"center"};padding:16px 0"><span style="font-size:${d.size||64}px;line-height:1">${d.emoji||""}</span>${d.caption ? `<p style="margin:8px 0 0;font-size:13px;color:#888">${d.caption}</p>` : ""}</div>`;
        case "gif":      return d.url ? `<figure style="text-align:${d.align||"center"};margin:24px 0"><img src="${d.url}" alt="${d.alt||d.query||"GIF"}" style="max-width:100%;border-radius:6px" loading="lazy"><figcaption style="font-size:13px;color:#888;margin-top:6px">${d.caption||""}</figcaption></figure>` : "";
        case "video":    return d.src ? `<figure style="text-align:${d.align||"center"};margin:24px 0"><video src="${d.src}"${d.poster?` poster="${d.poster}"`:""}${d.controls!==false?" controls":""}${d.autoplay?" autoplay":""}${d.loop?" loop":""} style="max-width:100%;border-radius:6px"></video>${d.caption?`<figcaption style="font-size:13px;color:#888;margin-top:6px">${d.caption}</figcaption>`:""}</figure>` : "";
        case "audio":    return d.src ? `<figure style="margin:24px 0"><audio src="${d.src}"${d.controls!==false?" controls":""}${d.autoplay?" autoplay":""}${d.loop?" loop":""} style="width:100%"></audio>${d.caption?`<figcaption style="font-size:13px;color:#888;margin-top:4px">${d.caption}</figcaption>`:""}</figure>` : "";
        case "record":   return d.src ? (d.mediaType==="video" ? `<figure style="margin:24px 0"><video src="${d.src}" controls style="max-width:100%;border-radius:6px"></video>${d.caption?`<figcaption style="font-size:13px;color:#888;margin-top:6px">${d.caption}</figcaption>`:""}</figure>` : `<figure style="margin:24px 0"><audio src="${d.src}" controls style="width:100%"></audio>${d.caption?`<figcaption style="font-size:13px;color:#888;margin-top:4px">${d.caption}</figcaption>`:""}</figure>`) : "";
        case "heading":  return `<${d.level||"h2"} style="text-align:${d.align||"left"};color:${d.color||"#1A1A2E"}">${d.text||""}</${d.level||"h2"}>`;
        case "text":     return `<p style="text-align:${d.align||"left"}">${(d.content||"").replace(/\n/g,"<br>")}</p>`;
        case "divider":  return `<hr style="border:none;border-top:${d.thickness||1}px solid ${d.color||"#D4CFC0"};margin:24px 0">${d.label ? `<p style="text-align:center;color:${d.color||"#D4CFC0"};font-size:13px;margin-top:-12px">${d.label}</p>` : ""}`;
        case "spacer":   return `<div style="height:${d.height||32}px"></div>`;
        case "image":    return `<figure style="text-align:${d.align||"center"};margin:24px 0">${d.src ? `<img src="${d.src}" alt="${d.alt||""}" style="max-width:${d.maxWidth||"100%"};border-radius:6px">` : ""}<figcaption style="font-size:13px;color:#888;margin-top:6px">${d.caption||""}</figcaption></figure>`;
        case "quote":    return `<blockquote style="border-left:4px solid #C9A84C;margin:24px 0;padding:12px 20px;background:#f9f5ec"><p style="font-style:italic;margin:0">${d.text||""}</p>${d.attribution ? `<cite style="display:block;margin-top:8px;font-size:13px;color:#888">— ${d.attribution}</cite>` : ""}</blockquote>`;
        case "list":     return d.style === "numbered"
          ? `<ol style="padding-left:24px">${(d.items||[]).map(i => `<li>${i}</li>`).join("")}</ol>`
          : `<ul style="padding-left:24px">${(d.items||[]).map(i => `<li>${i}</li>`).join("")}</ul>`;
        case "hero":     return `<section style="background:${d.bgColor||"#0B1D3A"};color:${d.textColor||"#fff"};padding:80px 40px;text-align:${d.align||"center"}"><h1 style="margin:0 0 16px;font-size:2.4rem">${d.headline||""}</h1><p style="margin:0 0 28px;font-size:1.1rem;opacity:.85">${d.subline||""}</p>${d.btnText ? `<a href="${d.btnLink||"#"}" style="display:inline-block;padding:14px 32px;background:#C9A84C;color:#fff;text-decoration:none;border-radius:5px;font-weight:600">${d.btnText}</a>` : ""}</section>`;
        case "cta":      return `<section style="background:${d.bgColor||"#0B1D3A"};padding:56px 40px;text-align:center"><h2 style="color:#fff;margin:0 0 12px">${d.heading||""}</h2><p style="color:rgba(255,255,255,.8);margin:0 0 24px">${d.body||""}</p>${d.btnText ? `<a href="${d.btnLink||"#"}" style="display:inline-block;padding:12px 28px;background:${d.btnColor||"#C9A84C"};color:#fff;text-decoration:none;border-radius:5px;font-weight:600">${d.btnText}</a>` : ""}</section>`;
        case "columns":  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:${d.gap||"32px"};padding:32px 0"><div><h3>${d.leftHeading||""}</h3><p>${d.leftContent||""}</p></div><div><h3>${d.rightHeading||""}</h3><p>${d.rightContent||""}</p></div></div>`;
        case "cards":    return `<div style="display:grid;grid-template-columns:repeat(${(d.cards||[]).length},1fr);gap:24px;padding:32px 0">${(d.cards||[]).map(c => `<div style="background:#fff;border-radius:8px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.08)"><div style="font-size:28px;margin-bottom:12px">${c.icon||""}</div><h3 style="margin:0 0 8px">${c.title||""}</h3><p style="margin:0;color:#555">${c.body||""}</p>${c.link ? `<a href="${c.link}" style="display:inline-block;margin-top:12px;color:#C9A84C;text-decoration:none;font-weight:600">Learn more →</a>` : ""}</div>`).join("")}</div>`;
        default:         return "";
      }
    }).join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: 'Source Sans 3', 'Segoe UI', sans-serif; color: #1A1A2E; background: #fff; line-height: 1.6; }
    .lc-container { max-width: 960px; margin: 0 auto; padding: 40px 24px; }
    h1, h2, h3 { font-family: 'Libre Baskerville', Georgia, serif; }
    a { color: #C9A84C; }
    img { max-width: 100%; }
    @media (max-width: 640px) {
      section[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
    }
  </style>
</head>
<body>
<div class="lc-container">
${blockHtml}
</div>
</body>
</html>`;
  };

  const handleDeploy = async (p) => {
    setDeploying(p.id); setDeployMsg(m => ({ ...m, [p.id]: "" }));
    try {
      // Fetch full content first
      const pageRes = await fetch(`${API_URL}/api/pages/${p.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const pageData = await pageRes.json();
      if (!pageRes.ok) { setDeployMsg(m => ({ ...m, [p.id]: "Failed to load content" })); return; }

      const html = blocksToHtml(pageData.page.title, pageData.page.site, pageData.page.content);

      // Save serialized HTML back then deploy
      await fetch(`${API_URL}/api/pages/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: pageData.page.title, content: html })
      });

      const res = await fetch(`${API_URL}/api/pages/${p.id}/deploy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) { setDeployMsg(m => ({ ...m, [p.id]: data.error || "Deploy failed" })); return; }
      setPages(prev => prev.map(x => x.id === p.id ? { ...x, deployed_at: data.page.deployed_at } : x));
      setDeployMsg(m => ({ ...m, [p.id]: "Deployed ✓" }));
      setTimeout(() => setDeployMsg(m => ({ ...m, [p.id]: "" })), 3000);
    } catch { setDeployMsg(m => ({ ...m, [p.id]: "Network error" })); }
    finally { setDeploying(null); }
  };

  const isFaculty = ROLES[currentRole]?.level === 2;
  const facultySite = currentUser?.site && currentUser.site !== "all" ? currentUser.site : null;

  const filteredPages = pages
    .filter(p => !isFaculty || !facultySite || p.site === facultySite)
    .filter(p => filter === "all" || p.site === filter)
    .filter(p => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (p.title||"").toLowerCase().includes(q) || (p.site||"").toLowerCase().includes(q) || (p.filename||"").toLowerCase().includes(q);
    });
  const sites = [...new Set(pages.map(p => p.site))].filter(s => !isFaculty || !facultySite || s === facultySite);
  const isAdmin = currentRole === "administrator";

  return (
    <div>
      {editing && (
        <PageEditor
          page={editing}
          token={token}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isFaculty ? 12 : 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>Pages</h2>
          <p style={{ color: "#6B7B8D", marginTop: 4, fontSize: 15 }}>Manage static pages across all sites.</p>
        </div>
      </div>
      {isFaculty && (
        <div style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 8, padding: "9px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#8B7333" }}>
          <span>🎓</span>
          <span>Faculty view—{facultySite ? <><strong>{facultySite}</strong> pages only</> : "your assigned pages"}. Contact an Administrator to manage other sites.</span>
        </div>
      )}

      {error && <div style={{ background: "#FEE2E2", border: "1px solid #e74c3c44", borderRadius: 6, padding: "10px 14px", marginBottom: 16, fontSize: 14, color: "#B91C1C" }}>{error}</div>}

      {/* Site filter tabs + search */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", ...sites].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: "5px 12px", fontSize: 14, borderRadius: 4, border: "1px solid", cursor: "pointer", fontWeight: filter === s ? 700 : 400,
                background: filter === s ? "rgba(201,168,76,0.13)" : "transparent",
                borderColor: filter === s ? "#C9A84C" : "#D4CFC0",
                color: filter === s ? "#C9A84C" : "#6B7B8D" }}>
              {s === "all" ? "All Sites" : s}
            </button>
          ))}
        </div>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#6B7B8D", pointerEvents: "none" }}>
            <Icon name="search" size={13} />
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pages…"
            style={{ paddingLeft: 30, paddingRight: search ? 28 : 10, paddingTop: 6, paddingBottom: 6, background: "#FAF6EE", border: "1px solid #D4CFC0", borderRadius: 5, fontSize: 14, color: "#1A1A2E", width: 200, outline: "none" }} />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#6B7B8D", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
          )}
        </div>
      </div>

      <div style={{ background: "#FFFFFF", border: "1px solid #252c3a", borderRadius: 8, overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#6B7B8D", fontSize: 15 }}>Loading pages…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #252c3a" }}>
                {["Title", "File", "Site", "Last Saved", "Deployed", ""].map(h => (
                  <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 13, color: "#8B7333", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPages.length === 0 && (
                <tr><td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#6B7B8D", fontSize: 14 }}>
                  No pages match "{search || filter}"
                </td></tr>
              )}
              {filteredPages.map(p => (
                <tr key={p.id} style={{ borderBottom: "1px solid #1a1f2c" }}>
                  <td style={{ padding: "11px 16px", fontSize: 15, fontWeight: 600, color: "#1A1A2E" }}><a href={`https://${p.site}/${p.filename}`} target="_blank" rel="noopener noreferrer" style={{color:"#1A66CC",textDecoration:"none"}} onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"} onMouseLeave={e=>e.currentTarget.style.textDecoration="none"}>{p.title}</a></td>
                  <td style={{ padding: "11px 16px", fontSize: 13, color: "#1A3668", fontFamily: "monospace" }}>{p.filename}</td>
                  <td style={{ padding: "11px 16px", fontSize: 13, color: "#6B7B8D" }}>{p.site}</td>
                  <td style={{ padding: "11px 16px", fontSize: 13, color: "#6B7B8D", whiteSpace: "nowrap" }}>
                    {p.has_content ? (p.last_modified?.slice(0,10) || "—") : <span style={{ color: "#D4CFC0" }}>empty</span>}
                  </td>
                  <td style={{ padding: "11px 16px", fontSize: 13, color: p.deployed_at ? "#2D8B55" : "#D4CFC0", whiteSpace: "nowrap" }}>
                    {p.deployed_at ? p.deployed_at.slice(0,10) : "—"}
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {deployMsg[p.id] && <span style={{ fontSize: 12, color: deployMsg[p.id].includes("✓") ? "#2D8B55" : "#B91C1C" }}>{deployMsg[p.id]}</span>}
                      {can(currentRole, "editPages") && (
                        <button onClick={() => setEditing(p)} title="Edit"
                          style={{ background: "none", border: "none", color: "#6B7B8D", cursor: "pointer", padding: 2, borderRadius: 3 }}
                          onMouseEnter={e => e.currentTarget.style.color="#C9A84C"}
                          onMouseLeave={e => e.currentTarget.style.color="#6B7B8D"}>
                          <Icon name="edit" size={14} />
                        </button>
                      )}
                      {isAdmin && !!p.has_content && (
                        <button onClick={() => handleDeploy(p)} disabled={deploying === p.id} title="Deploy to VPS"
                          style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", background: deploying === p.id ? "#8a7035" : "#C9A84C", color: "#fff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: deploying === p.id ? "not-allowed" : "pointer" }}>
                          {deploying === p.id ? "…" : "Deploy"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function UserEditModal({ user, currentRole, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...user });
  const [showPw, setShowPw]       = useState(false);
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError]     = useState("");

  const inp = (label, field, type = "text") => (
    <div key={field}>
      <label style={{ fontSize: 13, color: "#6B7B8D", display: "block", marginBottom: 5 }}>{label}</label>
      <input type={type} value={draft[field] || ""} onChange={e => setDraft(d => ({ ...d, [field]: e.target.value }))}
        style={{ width: "100%", padding: "8px 10px", background: "#FAF6EE", border: "1px solid #252c3a", borderRadius: 5, color: "#1A1A2E", fontSize: 15, boxSizing: "border-box" }} />
    </div>
  );

  const handleSave = () => {
    if (showPw) {
      if (newPw && newPw.length < 8) { setPwError("Password must be at least 8 characters."); return; }
      if (newPw !== confirmPw) { setPwError("Passwords do not match."); return; }
    }
    const payload = { ...draft };
    if (showPw && newPw) payload.newPassword = newPw;
    onSave(payload);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,29,58,0.35)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#FFFFFF", border: "1px solid #252c3a", borderRadius: 10, width: 460, boxShadow: "0 24px 60px #00000099", animation: "fadeUp 0.2s ease" }}>
        <style>{`@keyframes fadeUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #1e2432" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: ROLES[draft.role]?.color + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: ROLES[draft.role]?.color }}>
              {draft.name?.split(" ").map(n => n[0]).join("").slice(0,2)}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A" }}>Edit User</div>
              <div style={{ fontSize: 13, color: "#6B7B8D" }}>{user.email}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#6B7B8D", cursor: "pointer", fontSize: 20 }}>×</button>
        </div>

        {/* Fields */}
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {inp("Full Name", "name")}
            {inp("Email Address", "email", "email")}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, color: "#6B7B8D", display: "block", marginBottom: 5 }}>Role</label>
              <select value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", background: "#FAF6EE", border: "1px solid #252c3a", borderRadius: 5, color: "#1A1A2E", fontSize: 15 }}>
                {Object.entries(ROLES)
                  .filter(([k]) => currentRole === "administrator" || ROLES[k].level < ROLES[currentRole]?.level)
                  .map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, color: "#6B7B8D", display: "block", marginBottom: 5 }}>Site Scope</label>
              <select value={draft.site} onChange={e => setDraft(d => ({ ...d, site: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", background: "#FAF6EE", border: "1px solid #252c3a", borderRadius: 5, color: "#1A1A2E", fontSize: 15 }}>
                <option value="all">All Sites</option>
                {SITES.map(s => <option key={s.id} value={s.domain}>{s.domain}</option>)}
              </select>
            </div>
          </div>

          {/* Role preview */}
          <div style={{ background: "#FAF6EE", border: `1px solid ${ROLES[draft.role]?.color}33`, borderRadius: 7, padding: "12px 14px" }}>
            <div style={{ fontSize: 13, color: "#8B7333", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Permission Level</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <RoleBadge role={draft.role} />
              <span style={{ fontSize: 14, color: "#6B7B8D" }}>—</span>
              <span style={{ fontSize: 14, color: "#6B7B8D" }}>
                {draft.role === "administrator" && "Full server & user control"}
                {draft.role === "manager" && "User management, settings, pages"}
                {draft.role === "faculty" && "Pages & site viewing only"}
                {draft.role === "user" && "Read-only dashboard access"}
              </span>
            </div>
          </div>

          {/* Change password */}
          <div style={{ border: "1px solid #1e2432", borderRadius: 7, overflow: "hidden" }}>
            <button onClick={() => { setShowPw(v => !v); setPwError(""); setNewPw(""); setConfirmPw(""); }}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", background: showPw ? "#FAF6EE" : "transparent", border: "none", cursor: "pointer", fontSize: 14, color: "#3D3D56", fontWeight: 600 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="lock" size={13} /> Change Password
              </span>
              <span style={{ fontSize: 18, color: "#6B7B8D", lineHeight: 1 }}>{showPw ? "−" : "+"}</span>
            </button>
            {showPw && (
              <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid #1e2432" }}>
                <div style={{ paddingTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 13, color: "#6B7B8D", display: "block", marginBottom: 5 }}>New Password</label>
                    <input type="password" value={newPw} onChange={e => { setNewPw(e.target.value); setPwError(""); }}
                      placeholder="Min. 8 characters"
                      style={{ width: "100%", padding: "8px 10px", background: "#FAF6EE", border: `1px solid ${pwError ? "#B91C1C" : "#252c3a"}`, borderRadius: 5, color: "#1A1A2E", fontSize: 15, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: "#6B7B8D", display: "block", marginBottom: 5 }}>Confirm Password</label>
                    <input type="password" value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setPwError(""); }}
                      placeholder="Repeat password"
                      style={{ width: "100%", padding: "8px 10px", background: "#FAF6EE", border: `1px solid ${pwError ? "#B91C1C" : "#252c3a"}`, borderRadius: 5, color: "#1A1A2E", fontSize: 15, boxSizing: "border-box" }} />
                  </div>
                </div>
                {pwError && <div style={{ fontSize: 13, color: "#B91C1C" }}>{pwError}</div>}
                {newPw && !pwError && newPw === confirmPw && newPw.length >= 8 && (
                  <div style={{ fontSize: 13, color: "#2D8B55", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>✓</span> Password looks good
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", background: "#FAF6EE", border: "1px solid #1e2432", borderRadius: 7 }}>
            <span style={{ fontSize: 15, color: "#3D3D56" }}>Account Status</span>
            <button onClick={() => setDraft(d => ({ ...d, active: !d.active }))}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 14, fontWeight: 600,
                background: draft.active ? "#E8F5EC" : "#FEE2E2",
                color: draft.active ? "#2D8B55" : "#B91C1C" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
              {draft.active ? "Active" : "Inactive"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 22px", borderTop: "1px solid #1e2432" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #252c3a", borderRadius: 5, color: "#6B7B8D", cursor: "pointer", fontSize: 15 }}>Cancel</button>
          <button onClick={handleSave}
            style={{ padding: "8px 18px", background: "#C9A84C", border: "none", borderRadius: 5, color: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 600 }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersPage({ currentRole, token, currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "user", password: "" });
  const [addError, setAddError] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvError, setCsvError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok) setUsers(data.users);
        else setError(data.error || "Failed to load users");
      } catch { setError("Network error"); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleAdd = async () => {
    if (!newUser.name || !newUser.email) return;
    setAddError("");
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error || "Failed to add user"); return; }
      setUsers(prev => [...prev, data.user]);
      setNewUser({ name: "", email: "", role: "user", password: "" });
      setShowAdd(false);
    } catch { setAddError("Network error"); }
  };

  const parseCsv = (text) => {
    setCsvError(""); setCsvPreview([]); setImportResults(null);
    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) { setCsvError("CSV must have a header row + at least one data row"); return; }
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
    const nameIdx  = headers.findIndex(h => ["name","fullname","studentname"].includes(h));
    const emailIdx = headers.findIndex(h => h.includes("email"));
    const roleIdx  = headers.findIndex(h => h.includes("role"));
    const siteIdx  = headers.findIndex(h => h.includes("site"));
    if (nameIdx === -1 || emailIdx === -1) { setCsvError("CSV must have 'name' and 'email' columns. Optional: role, site"); return; }
    const rows = lines.slice(1).map((line, i) => {
      const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      return {
        _row: i + 2,
        name:  cols[nameIdx]  || "",
        email: cols[emailIdx] || "",
        role:  (cols[roleIdx] || "user").toLowerCase(),
        site:  cols[siteIdx]  || "lawschoolcommons.com",
        valid: !!(cols[nameIdx] && cols[emailIdx] && cols[emailIdx].includes("@")),
      };
    });
    setCsvPreview(rows);
  };

  const handleCsvFile = (file) => {
    if (!file) return;
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") { setCsvError("Please upload a .csv file"); return; }
    const reader = new FileReader();
    reader.onload = (e) => parseCsv(e.target.result);
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const valid = csvPreview.filter(r => r.valid);
    if (!valid.length) return;
    setImporting(true); setImportResults(null);
    const results = { success: 0, failed: 0, errors: [] };
    for (const row of valid) {
      try {
        const res = await fetch(`${API_URL}/api/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: row.name, email: row.email, role: row.role || "user", site: row.site || "lawschoolcommons.com", password: "Welcome2026!" }),
        });
        const data = await res.json();
        if (res.ok) { results.success++; setUsers(prev => [...prev, data.user]); }
        else { results.failed++; results.errors.push(`${row.email}: ${data.error || "failed"}`); }
      } catch { results.failed++; results.errors.push(`${row.email}: network error`); }
    }
    setImportResults(results); setImporting(false);
    if (results.failed === 0) { setTimeout(() => { setShowImport(false); setCsvPreview([]); setImportResults(null); }, 1800); }
  };

  const toggleActive = async (u) => {
    if (!can(currentRole, "editUsers")) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !u.active }),
      });
      const data = await res.json();
      if (res.ok) setUsers(prev => prev.map(x => x.id === u.id ? data.user : x));
    } catch {}
  };

  const handleSaveUser = async (updated) => {
    try {
      const res = await fetch(`${API_URL}/api/users/${updated.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (res.ok) setUsers(prev => prev.map(u => u.id === updated.id ? data.user : u));
    } catch {}
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/users/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setUsers(prev => prev.filter(u => u.id !== id));
    } catch {}
    setConfirmDeleteId(null);
  };

  return (
    <div>
      {loading && <div style={{ padding: "60px 20px", textAlign: "center", color: "#D4CFC0" }}>Loading users…</div>}
      {error && <div style={{ padding: "20px", color: "#B91C1C", background: "#FEE2E2", borderRadius: 6, marginBottom: 16 }}>{error}</div>}
      {!loading && !error && <>
      {/* Delete confirm modal */}
      {confirmDeleteId && (() => {
        const target = users.find(u => u.id === confirmDeleteId);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(11,29,58,0.35)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "#FFFFFF", border: "1px solid #e74c3c44", borderRadius: 10, padding: 28, width: 340, textAlign: "center", fontFamily: "Source Sans 3, Segoe UI, sans-serif" }}>
              <div style={{ color: "#B91C1C", marginBottom: 12 }}><Icon name="trash" size={28} /></div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0B1D3A", marginBottom: 8 }}>Delete {target?.name}?</div>
              <div style={{ fontSize: 15, color: "#6B7B8D", marginBottom: 22 }}>This cannot be undone.</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => setConfirmDeleteId(null)} style={{ padding: "8px 20px", background: "#D4CFC0", border: "1px solid #3a4356", borderRadius: 5, color: "#3D3D56", cursor: "pointer", fontSize: 15 }}>Cancel</button>
                <button onClick={() => handleDelete(confirmDeleteId)}
                  style={{ padding: "8px 20px", background: "#B91C1C", border: "none", borderRadius: 5, color: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 600 }}>Delete</button>
              </div>
            </div>
          </div>
        );
      })()}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          currentRole={currentRole}
          onSave={handleSaveUser}
          onClose={() => setEditingUser(null)}
        />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: ROLES[currentRole]?.level === 2 ? 12 : 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>Users</h2>
          <p style={{ color: "#6B7B8D", marginTop: 4, fontSize: 15 }}>
            {can(currentRole, "editUsers") ? "Manage users and permissions across the network." : "View users in your site scope."}
          </p>
        </div>
        {can(currentRole, "addUsers") && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowImport(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "transparent", color: "#C9A84C", border: "1px solid #C9A84C", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              ↑ Import CSV
            </button>
            <button onClick={() => setShowAdd(!showAdd)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#C9A84C", color: "#fff", border: "none", borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              <Icon name="plus" size={14} /> Add User
            </button>
          </div>
        )}
      </div>
      {ROLES[currentRole]?.level === 2 && currentUser?.site && currentUser.site !== "all" && (
        <div style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 8, padding: "9px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#8B7333" }}>
          <span>🎓</span>
          <span>Faculty view—showing students and staff assigned to <strong>{currentUser.site}</strong> only.</span>
        </div>
      )}

      {/* Search + role filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#6B7B8D", pointerEvents: "none" }}>
            <Icon name="search" size={13} />
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or site…"
            style={{ width: "100%", paddingLeft: 30, paddingRight: search ? 28 : 10, paddingTop: 7, paddingBottom: 7, background: "#FAF6EE", border: "1px solid #D4CFC0", borderRadius: 5, fontSize: 14, color: "#1A1A2E", boxSizing: "border-box", outline: "none" }} />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#6B7B8D", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["all", "All Roles"], ...Object.entries(ROLES).map(([k, v]) => [k, v.label])].map(([k, label]) => (
            <button key={k} onClick={() => setRoleFilter(k)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", fontSize: 13, borderRadius: 4, border: "1px solid", cursor: "pointer",
                fontWeight: roleFilter === k ? 700 : 400,
                background: roleFilter === k ? (k === "all" ? "rgba(201,168,76,0.13)" : ROLES[k]?.color + "22") : "transparent",
                borderColor: roleFilter === k ? (k === "all" ? "#C9A84C" : ROLES[k]?.color) : "#D4CFC0",
                color: roleFilter === k ? (k === "all" ? "#C9A84C" : ROLES[k]?.color) : "#6B7B8D" }}>
              {k !== "all" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: ROLES[k]?.color, display: "inline-block" }} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* CSV Import Modal */}
      {showImport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#FFFFFF", borderRadius: 10, padding: 28, width: 660, maxHeight: "85vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0B1D3A" }}>Bulk Import via CSV</h3>
              <button onClick={() => { setShowImport(false); setCsvPreview([]); setCsvError(""); setImportResults(null); }}
                style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "#6B7B8D" }}>×</button>
            </div>
            {!csvPreview.length && !importResults && (
              <div>
                <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleCsvFile(e.dataTransfer.files[0]); }}
                  style={{ border: "2px dashed #D4CFC0", borderRadius: 8, padding: "40px 24px", textAlign: "center", cursor: "pointer", marginBottom: 14, background: "#FAF6EE" }}
                  onClick={() => document.getElementById("csv-file-input").click()}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#0B1D3A", marginBottom: 4 }}>Drag & drop your CSV here</div>
                  <div style={{ fontSize: 13, color: "#6B7B8D" }}>or click to browse (.csv)</div>
                  <input id="csv-file-input" type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={e => handleCsvFile(e.target.files[0])} />
                </div>
                <div style={{ background: "#FAF6EE", borderRadius: 6, padding: "12px 16px", fontSize: 12, color: "#6B7B8D", fontFamily: "monospace" }}>
                  name,email,role,site<br />
                  Jane Smith,jane@cwsl.edu,user,lawschoolcommons.com<br />
                  <span style={{ fontFamily: "sans-serif", fontSize: 11 }}>role defaults to "user" · password set to Welcome2026! (user must reset)</span>
                </div>
              </div>
            )}
            {csvError && <div style={{ background: "#FEE2E2", borderRadius: 6, padding: "10px 14px", color: "#B91C1C", fontSize: 13, marginBottom: 14 }}>{csvError}</div>}
            {csvPreview.length > 0 && !importResults && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 14, color: "#0B1D3A" }}><strong>{csvPreview.filter(r => r.valid).length}</strong> valid · <span style={{ color: "#B91C1C" }}>{csvPreview.filter(r => !r.valid).length} invalid</span></div>
                  <button onClick={() => { setCsvPreview([]); setCsvError(""); }} style={{ fontSize: 12, color: "#6B7B8D", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>← Change file</button>
                </div>
                <div style={{ border: "1px solid #D4CFC0", borderRadius: 6, overflow: "auto", marginBottom: 14, maxHeight: 240 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={{ background: "#FAF6EE" }}>
                      {["#","Name","Email","Role","Site",""].map(h => <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#8B7333", textTransform: "uppercase" }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {csvPreview.slice(0,50).map(r => (
                        <tr key={r._row} style={{ borderTop: "1px solid #F0EAD6", background: r.valid ? "transparent" : "#FFF5F5" }}>
                          <td style={{ padding: "6px 12px", color: "#8DA4BE", fontSize: 11 }}>{r._row}</td>
                          <td style={{ padding: "6px 12px", fontWeight: 600, color: "#1A1A2E" }}>{r.name || <span style={{ color: "#B91C1C" }}>missing</span>}</td>
                          <td style={{ padding: "6px 12px", color: "#1A3668" }}>{r.email || <span style={{ color: "#B91C1C" }}>missing</span>}</td>
                          <td style={{ padding: "6px 12px" }}><RoleBadge role={r.role || "user"} /></td>
                          <td style={{ padding: "6px 12px", color: "#6B7B8D", fontSize: 12 }}>{r.site}</td>
                          <td style={{ padding: "6px 12px" }}>{r.valid ? <span style={{ color: "#2D8B55" }}>✓</span> : <span style={{ color: "#B91C1C" }}>✗</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvPreview.length > 50 && <div style={{ padding: "7px 14px", fontSize: 12, color: "#8DA4BE", background: "#FAF6EE" }}>…and {csvPreview.length - 50} more rows</div>}
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => setShowImport(false)} style={{ padding: "8px 16px", border: "1px solid #D4CFC0", borderRadius: 6, background: "transparent", cursor: "pointer", fontSize: 14, color: "#6B7B8D" }}>Cancel</button>
                  <button onClick={handleImport} disabled={importing || !csvPreview.filter(r => r.valid).length}
                    style={{ padding: "8px 18px", background: importing ? "#8a7035" : "#C9A84C", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, fontSize: 14, cursor: importing ? "not-allowed" : "pointer" }}>
                    {importing ? "Importing…" : `Import ${csvPreview.filter(r => r.valid).length} Users`}
                  </button>
                </div>
              </div>
            )}
            {importResults && (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>{importResults.failed === 0 ? "✅" : "⚠️"}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0B1D3A", marginBottom: 8 }}>
                  {importResults.success} imported{importResults.failed > 0 ? `, ${importResults.failed} failed` : " successfully"}
                </div>
                {importResults.errors.slice(0,5).map((e, i) => <div key={i} style={{ fontSize: 12, color: "#B91C1C" }}>{e}</div>)}
                <button onClick={() => { setShowImport(false); setCsvPreview([]); setImportResults(null); }}
                  style={{ marginTop: 16, padding: "8px 20px", background: "#C9A84C", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add user form */}
      {showAdd && can(currentRole, "addUsers") && (
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(201,168,76,0.27)", borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: "0 0 14px 0" }}>Add New User</h3>
          {addError && <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 10 }}>{addError}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
            {[["Full Name", "name", "text"], ["Email", "email", "email"], ["Password", "password", "password"]].map(([label, field, type]) => (
              <div key={field}>
                <label style={{ fontSize: 13, color: "#6B7B8D", display: "block", marginBottom: 4 }}>{label}</label>
                <input type={type} value={newUser[field]} placeholder={field === "password" ? "ChangeMe2026!" : ""} onChange={e => setNewUser(p => ({ ...p, [field]: e.target.value }))}
                  style={{ width: "100%", padding: "7px 10px", background: "#FAF6EE", border: "1px solid #252c3a", borderRadius: 5, color: "#1A1A2E", fontSize: 15, boxSizing: "border-box" }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 13, color: "#6B7B8D", display: "block", marginBottom: 4 }}>Role</label>
              <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                style={{ width: "100%", padding: "7px 10px", background: "#FAF6EE", border: "1px solid #252c3a", borderRadius: 5, color: "#1A1A2E", fontSize: 15 }}>
                {Object.entries(ROLES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <button onClick={handleAdd}
              style={{ padding: "8px 16px", background: "#C9A84C", color: "#fff", border: "none", borderRadius: 5, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              Add
            </button>
          </div>
        </div>
      )}

      <div style={{ background: "#FFFFFF", border: "1px solid #252c3a", borderRadius: 8, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #252c3a" }}>
              {["User", "Email", "Role", "Site Scope", "Last Login", "Status", ""].map(h => (
                <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 13, color: "#8B7333", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users
              .filter(u => {
                if (ROLES[currentRole]?.level === 2) {
                  const fs = currentUser?.site;
                  if (fs && fs !== "all") return u.site === fs || u.site === "all";
                }
                return true;
              })
              .filter(u => roleFilter === "all" || u.role === roleFilter)
              .filter(u => {
                const q = search.trim().toLowerCase();
                if (!q) return true;
                return (u.name||"").toLowerCase().includes(q) || (u.email||"").toLowerCase().includes(q) || (u.site||"").toLowerCase().includes(q);
              })
              .map(u => (
              <tr key={u.id} style={{ borderBottom: "1px solid #1a1f2c", opacity: u.active ? 1 : 0.5 }}>
                <td style={{ padding: "11px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: ROLES[u.role]?.color + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: ROLES[u.role]?.color }}>
                      {u.name.split(" ").map(n => n[0]).join("").slice(0,2)}
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#1A1A2E" }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ padding: "11px 16px", fontSize: 14, color: "#1A3668" }}>{u.email}</td>
                <td style={{ padding: "11px 16px" }}><RoleBadge role={u.role} /></td>
                <td style={{ padding: "11px 16px", fontSize: 14, color: "#6B7B8D" }}>{u.site === "all" ? "All Sites" : u.site}</td>
                <td style={{ padding: "11px 16px", fontSize: 14, color: "#6B7B8D", whiteSpace: "nowrap" }}>{u.lastLogin}</td>
                <td style={{ padding: "11px 16px" }}>
                  <button onClick={() => toggleActive(u)}
                    style={{ background: "none", border: "none", cursor: can(currentRole, "editUsers") ? "pointer" : "default", padding: 0 }}>
                    <span style={{ fontSize: 13, color: u.active ? "#2D8B55" : "#B91C1C", background: u.active ? "#E8F5EC" : "#FEE2E2", padding: "2px 8px", borderRadius: 3 }}>
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </button>
                </td>
                <td style={{ padding: "11px 16px" }}>
                  {can(currentRole, "editUsers") && (
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => setEditingUser(u)} title="Edit user"
                        style={{ background: "none", border: "none", color: "#6B7B8D", cursor: "pointer", padding: 2, borderRadius: 3, transition: "color 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.color="#C9A84C"}
                        onMouseLeave={e => e.currentTarget.style.color="#6B7B8D"}>
                        <Icon name="edit" size={14} />
                      </button>
                      {can(currentRole, "deleteUsers") && (
                        <button title="Delete user" onClick={() => setConfirmDeleteId(u.id)}
                          style={{ background: "none", border: "none", color: "#6B7B8D", cursor: "pointer", padding: 2, borderRadius: 3, transition: "color 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.color="#B91C1C"}
                          onMouseLeave={e => e.currentTarget.style.color="#6B7B8D"}>
                          <Icon name="trash" size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>}
    </div>
  );
}

function SettingsPage({ currentRole, currentUser, darkMode, toggleDark, dyslexieFont, toggleDyslexie, accentColor, changeAccent }) {
  const [nginx, setNginx]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [settingsTab, setSettingsTab] = useState("server"); // "server"|"integrations"|"tenants"|"infra"|"backups"|"cicd"|"hipaa"

  // ── Infrastructure / AWS state ──────────────────────────────────────────
  const [awsServices] = useState([
    { id: "ec2",        name: "EC2 (lexcommons-api)",  status: "running",  detail: "t3.small · us-west-2 · 54.214.130.86",  icon: "🖥️" },
    { id: "rds",        name: "RDS PostgreSQL 17",      status: "running",  detail: "db.t3.micro · lexcommons-db.cl0o6ia04wsw.us-west-2.rds.amazonaws.com", icon: "🗄️" },
    { id: "s3",         name: "S3 (lexcommons-uploads)",status: "running",  detail: "Versioning: enabled · 2.4 GB used",     icon: "🪣" },
    { id: "ses",        name: "AWS SES",                status: "running",  detail: "Verified: noreply@lexcommons.org · Production access", icon: "✉️" },
    { id: "route53",    name: "Route 53",               status: "planned",  detail: "Pending domain transfer from registrar",icon: "🌐" },
    { id: "cloudfront", name: "CloudFront",             status: "planned",  detail: "Sprint 4 — CDN for S3 media files",     icon: "⚡" },
    { id: "acm",        name: "ACM (SSL/TLS)",          status: "planned",  detail: "Sprint 4 — replace certbot with ACM wildcard cert", icon: "🔒" },
    { id: "github",     name: "GitHub Actions CI/CD",   status: "planned",  detail: "Sprint 4 — auto-deploy on push to main", icon: "🔄" },
  ]);

  // ── Backup state ─────────────────────────────────────────────────────────
  const [backupLog, setBackupLog] = useState([
    { id: "b1", type: "RDS Snapshot",   status: "completed", size: "1.8 GB", time: "2026-03-10 02:00 UTC", retention: "7 days" },
    { id: "b2", type: "S3 Versioning",  status: "completed", size: "auto",   time: "Continuous",            retention: "30 days → Glacier" },
    { id: "b3", type: "pg_dump",        status: "completed", size: "142 MB", time: "2026-03-09 03:00 UTC", retention: "Manual" },
    { id: "b4", type: "rsync /var/www", status: "completed", size: "87 MB",  time: "2026-03-10 04:00 UTC", retention: "S3 backup bucket" },
  ]);
  const [manualBackupRunning, setManualBackupRunning] = useState(false);
  const [manualBackupOutput, setManualBackupOutput] = useState("");

  // ── CI/CD state ──────────────────────────────────────────────────────────
  const [deployHistory] = useState([
    { id: "d1", branch: "main",         commit: "a3f9c2e", message: "Sprint 3: LawFirmCommons + SSO + CSV import", author: "jjones",    time: "2026-03-10 21:00", status: "success",  duration: "48s" },
    { id: "d2", branch: "main",         commit: "7d2b1a8", message: "Sprint 2: Templates, emoji/gif, color picker", author: "jjones",   time: "2026-03-09 18:30", status: "success",  duration: "52s" },
    { id: "d3", branch: "main",         commit: "c1e4f3d", message: "Sprint 1: Forgot password, dark mode, AI chat", author: "jjones",  time: "2026-03-08 15:00", status: "success",  duration: "44s" },
    { id: "d4", branch: "dev",          commit: "9b7a5c1", message: "WIP: HIPAA audit log expansion",               author: "jjones",   time: "2026-03-10 20:10", status: "pending",  duration: "—"  },
    { id: "d5", branch: "feature/sso",  commit: "2f8e6b0", message: "Fix: Microsoft callback URL encoding",         author: "jjones",   time: "2026-03-07 11:20", status: "success",  duration: "41s" },
  ]);
  const [deploying, setDeploying] = useState(false);

  // ── HIPAA state ──────────────────────────────────────────────────────────
  const [hipaaItems, setHipaaItems] = useState([
    // Technical safeguards
    { id: "h1",  cat: "Technical",      title: "Encryption in transit (HTTPS/TLS)",           done: true,  note: "All 5 domains — HSTS preload enabled" },
    { id: "h2",  cat: "Technical",      title: "Encryption at rest (RDS)",                    done: true,  note: "RDS encryption enabled on instance creation" },
    { id: "h3",  cat: "Technical",      title: "Encryption at rest (S3)",                     done: false, note: "Enable S3 SSE-S3 or SSE-KMS on lexcommons-uploads" },
    { id: "h4",  cat: "Technical",      title: "Role-based access control",                   done: true,  note: "4-level role system: Administrator/Manager/Faculty/User" },
    { id: "h5",  cat: "Technical",      title: "Audit log (data access)",                     done: false, note: "activity_log table exists; expand to log all data reads" },
    { id: "h6",  cat: "Technical",      title: "Automatic session timeout",                   done: false, note: "Force re-auth after 15–30 min inactivity — not yet implemented" },
    { id: "h7",  cat: "Technical",      title: "Unique user identification",                  done: true,  note: "Email-based login, JWT per session" },
    { id: "h8",  cat: "Technical",      title: "Emergency access procedure",                  done: false, note: "Document break-glass admin recovery process" },
    { id: "h9",  cat: "Technical",      title: "Automatic logoff",                            done: false, note: "Set JWT expiry + client-side idle timer" },
    { id: "h10", cat: "Technical",      title: "Field-level encryption (PII)",                done: false, note: "Encrypt SSN, DOB if ever stored — currently not stored" },
    // Administrative safeguards
    { id: "h11", cat: "Administrative", title: "Business Associate Agreement — AWS",          done: false, note: "Available via AWS Artifact. Sign before storing PHI." },
    { id: "h12", cat: "Administrative", title: "Business Associate Agreement — SES provider", done: false, note: "Required with any email service touching student data" },
    { id: "h13", cat: "Administrative", title: "Workforce training documentation",            done: false, note: "Record who has system access and when granted" },
    { id: "h14", cat: "Administrative", title: "Security incident procedures",                done: false, note: "Documented breach response plan" },
    { id: "h15", cat: "Administrative", title: "Contingency plan / disaster recovery",        done: false, note: "Covered by RDS PITR + S3 versioning — formalize as document" },
    // Physical safeguards
    { id: "h16", cat: "Physical",       title: "Workstation use policy",                      done: false, note: "Document acceptable use for devices with system access" },
    { id: "h17", cat: "Physical",       title: "AWS physical security (inherited)",            done: true,  note: "AWS data centers are HIPAA-eligible by default" },
    // Data governance
    { id: "h18", cat: "Data",           title: "No SSNs stored in platform",                  done: true,  note: "Not collected — financial aid via third-party processor" },
    { id: "h19", cat: "Data",           title: "No payment card data stored",                 done: true,  note: "Stripe tokenization — card numbers never touch the server" },
    { id: "h20", cat: "Data",           title: "Minimum necessary access principle",          done: true,  note: "Role-scoped data access — faculty sees own students only" },
    { id: "h21", cat: "Data",           title: "Right to access / FERPA requests",            done: false, note: "Build data export endpoint: GET /api/users/:id/export" },
  ]);
  const [ssoGoogle, setSsoGoogle]   = useState(() => localStorage.getItem("lc_sso_google") === "1");
  const [ssoMicrosoft, setSsoMicrosoft] = useState(() => localStorage.getItem("lc_sso_ms") === "1");
  const [ssoConfig, setSsoConfig]   = useState({ googleClientId: "", googleSecret: "", msClientId: "", msTenantId: "" });
  const [tenants, setTenants]   = useState([
    { id: "t1", name: "California Western School of Law", subdomain: "cwsl", plan: "Professional", students: 420, schema: "cwsl", status: "active",  created: "2025-10-01" },
    { id: "t2", name: "LexCommons Demo School",           subdomain: "demo", plan: "Starter",      students: 12,  schema: "demo", status: "active",  created: "2026-01-15" },
    { id: "t3", name: "Farris Law School",                subdomain: "farris", plan: "Enterprise", students: 890, schema: "farris", status: "active", created: "2025-06-01" },
  ]);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: "", subdomain: "", plan: "Starter" });

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/nginx`, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setNginx(d);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const StatusBadge = ({ ok }) => (
    <span style={{ fontSize: 13, color: ok ? "#2D8B55" : "#B91C1C" }}>
      {ok ? "✓ Active" : "✗ Missing"}
    </span>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>Settings</h2>
          <p style={{ color: "#6B7B8D", marginTop: 4, fontSize: 15 }}>Server config, integrations, and tenant management.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {settingsTab === "server" && nginx && <span style={{ fontSize: 12, color: "#8DA4BE" }}>Checked {new Date(nginx.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          {settingsTab === "server" && (
            <button onClick={load} disabled={loading}
              style={{ padding: "7px 14px", background: "transparent", border: "1px solid #C9A84C", borderRadius: 5, color: "#C9A84C", cursor: loading ? "not-allowed" : "pointer", fontSize: 13 }}>
              {loading ? "Checking…" : "↻ Refresh"}
            </button>
          )}
        </div>
      </div>

      {/* Settings sub-nav */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #D4CFC0" }}>
        {[["server","⚙ Server"],["integrations","🔗 Integrations"],["tenants","🏫 Tenants"],["infra","☁ AWS"],["backups","💾 Backups"],["cicd","🔄 CI/CD"],["hipaa","🔐 HIPAA"]].map(([v, l]) => (
          <button key={v} onClick={() => setSettingsTab(v)}
            style={{ padding: "8px 16px", border: "none", borderBottom: settingsTab === v ? "2px solid #C9A84C" : "2px solid transparent", background: "transparent", color: settingsTab === v ? "#0B1D3A" : "#6B7B8D", fontWeight: settingsTab === v ? 700 : 400, cursor: "pointer", fontSize: 14, marginBottom: -1, transition: "all 0.12s" }}>
            {l}
          </button>
        ))}
      </div>

      {error && settingsTab === "server" && <div style={{ background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 8, padding: 14, color: "#B91C1C", fontSize: 14, marginBottom: 14 }}>Error: {error}</div>}

      {settingsTab === "server" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Security headers */}
        <div style={{ background: "#FFFFFF", border: "1px solid #252c3a", borderRadius: 8, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Icon name="shield" size={16} />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>Security Headers</h3>
            {nginx && <span style={{ marginLeft: "auto", fontSize: 12, color: "#8DA4BE", fontFamily: "monospace" }}>{nginx.checkedUrl}</span>}
          </div>
          {loading && !nginx && <div style={{ color: "#8DA4BE", fontSize: 14 }}>Fetching live headers…</div>}
          {(nginx?.securityHeaders || []).map(h => (
            <div key={h.key} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#3D3D56" }}>{h.label}</span>
                <StatusBadge ok={h.correct} />
              </div>
              <div style={{ fontSize: 13, color: h.correct ? "#6B7B8D" : "#B91C1C", fontFamily: "monospace", background: h.correct ? "#FAF6EE" : "#fff5f5", padding: "4px 8px", borderRadius: 4 }}>
                {h.value || "— not present —"}
              </div>
            </div>
          ))}
          {/* Fallback if API not loaded yet */}
          {!loading && !nginx && [{label:"Strict-Transport-Security"},{label:"X-Frame-Options"},{label:"X-Content-Type-Options"},{label:"Referrer-Policy"},{label:"Permissions-Policy"},{label:"X-XSS-Protection"}].map(h => (
            <div key={h.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#3D3D56" }}>{h.label}</span>
                <span style={{ fontSize: 13, color: "#8DA4BE" }}>—</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* nginx settings */}
          <div style={{ background: "#FFFFFF", border: "1px solid #252c3a", borderRadius: 8, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Icon name="server" size={16} />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>nginx Settings</h3>
              {nginx && <span style={{ marginLeft: "auto", fontSize: 12, color: "#8DA4BE", fontFamily: "monospace" }}>Server: {nginx.serverHeader || "nginx"}</span>}
            </div>
            {loading && !nginx && <div style={{ color: "#8DA4BE", fontSize: 14 }}>Checking…</div>}
            {(nginx?.nginxConf || []).map(({ key, value, live, ok }) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #1e2432" }}>
                <span style={{ fontSize: 14, color: "#1A3668", fontFamily: "monospace" }}>{key}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {live && <span style={{ fontSize: 11, color: "#8DA4BE", background: "#F0EAD6", padding: "1px 5px", borderRadius: 3 }}>live</span>}
                  <span style={{ fontSize: 14, color: ok ? "#2D8B55" : "#B91C1C", fontFamily: "monospace" }}>{value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Rate limiting */}
          <div style={{ background: "#FFFFFF", border: "1px solid #252c3a", borderRadius: 8, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Icon name="activity" size={16} />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>Rate Limiting</h3>
            </div>
            {[
              ["admin.lexcommons.org /api/", "zone=api burst=30 nodelay"],
              ["lawschoolcommons.com /api/",  "zone=api burst=20 nodelay"],
            ].map(([site, val]) => (
              <div key={site} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 14, color: "#3D3D56", marginBottom: 3 }}>{site}</div>
                <div style={{ fontSize: 13, color: "#6B7B8D", fontFamily: "monospace", background: "#FAF6EE", padding: "4px 8px", borderRadius: 4 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Permissions notice */}
          {/* Preferences */}
          <div style={{ background: "#FFFFFF", border: "1px solid #252c3a", borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: "0 0 16px 0" }}>Display Preferences</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1A2E" }}>Dark Mode</div>
                  <div style={{ fontSize: 13, color: "#6B7B8D" }}>Reduce eye strain in low-light environments</div>
                </div>
                <button onClick={toggleDark}
                  style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative", background: darkMode ? "#C9A84C" : "#D4CFC0", transition: "background 0.2s", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 2, left: darkMode ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                </button>
              </div>
              <div style={{ borderTop: "1px solid #eee", paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1A2E" }}>OpenDyslexic Font</div>
                  <div style={{ fontSize: 13, color: "#6B7B8D" }}>Improves readability for users with dyslexia</div>
                </div>
                <button onClick={toggleDyslexie}
                  style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative", background: dyslexieFont ? "#C9A84C" : "#D4CFC0", transition: "background 0.2s", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 2, left: dyslexieFont ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                </button>
              </div>
            </div>
          </div>

          {!can(currentRole, "manageSettings") && (
            <div style={{ background: "#FEF3C7", border: "1px solid #e67e2233", borderRadius: 8, padding: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: "#e67e22", marginTop: 1 }}><Icon name="lock" size={14} /></span>
              <div style={{ fontSize: 14, color: "#e67e22" }}>You have read-only access to settings. Contact an Administrator or Manager to make changes.</div>
            </div>
          )}
        </div>
      </div>}

      {/* ═══ Integrations Tab ═══ */}
      {settingsTab === "integrations" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            {/* Google SSO */}
            <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>G</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1A2E" }}>Google SSO</div>
                  <div style={{ fontSize: 12, color: "#6B7B8D" }}>OAuth 2.0 via passport-google-oauth20</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <button onClick={() => { const n = !ssoGoogle; setSsoGoogle(n); localStorage.setItem("lc_sso_google", n ? "1" : "0"); }}
                    style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative", background: ssoGoogle ? "#C9A84C" : "#D4CFC0", transition: "background 0.2s", flexShrink: 0 }}>
                    <span style={{ position: "absolute", top: 2, left: ssoGoogle ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                  </button>
                </div>
              </div>
              {ssoGoogle && (
                <div>
                  {[["Google Client ID","googleClientId","Get from console.cloud.google.com"],["Client Secret","googleSecret","OAuth 2.0 client secret"]].map(([label, key, ph]) => (
                    <div key={key} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7B8D", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                      <input type={key.includes("Secret") ? "password" : "text"} value={ssoConfig[key]} onChange={e => setSsoConfig(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={ph} style={{ width: "100%", padding: "6px 10px", border: "1px solid #D4CFC0", borderRadius: 5, fontSize: 13, fontFamily: "monospace", boxSizing: "border-box" }} />
                    </div>
                  ))}
                  <div style={{ background: "#FAF6EE", borderRadius: 6, padding: "10px 12px", fontSize: 12, color: "#6B7B8D", fontFamily: "monospace" }}>
                    Callback URL: https://api.lexcommons.org/auth/google/callback
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: "#8DA4BE", lineHeight: 1.6 }}>
                    npm install passport passport-google-oauth20<br />
                    Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env
                  </div>
                </div>
              )}
              {!ssoGoogle && <div style={{ fontSize: 13, color: "#8DA4BE" }}>Enable Google SSO to let users sign in with their Google Workspace accounts.</div>}
            </div>

            {/* Microsoft SSO */}
            <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#F0F4FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⊞</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1A2E" }}>Microsoft SSO</div>
                  <div style={{ fontSize: 12, color: "#6B7B8D" }}>OAuth 2.0 via passport-azure-ad</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <button onClick={() => { const n = !ssoMicrosoft; setSsoMicrosoft(n); localStorage.setItem("lc_sso_ms", n ? "1" : "0"); }}
                    style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative", background: ssoMicrosoft ? "#C9A84C" : "#D4CFC0", transition: "background 0.2s", flexShrink: 0 }}>
                    <span style={{ position: "absolute", top: 2, left: ssoMicrosoft ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                  </button>
                </div>
              </div>
              {ssoMicrosoft && (
                <div>
                  {[["Azure Client ID","msClientId","App (client) ID from Azure portal"],["Tenant ID","msTenantId","Directory (tenant) ID or 'common'"]].map(([label, key, ph]) => (
                    <div key={key} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7B8D", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                      <input value={ssoConfig[key]} onChange={e => setSsoConfig(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={ph} style={{ width: "100%", padding: "6px 10px", border: "1px solid #D4CFC0", borderRadius: 5, fontSize: 13, fontFamily: "monospace", boxSizing: "border-box" }} />
                    </div>
                  ))}
                  <div style={{ background: "#FAF6EE", borderRadius: 6, padding: "10px 12px", fontSize: 12, color: "#6B7B8D", fontFamily: "monospace" }}>
                    Callback URL: https://api.lexcommons.org/auth/microsoft/callback
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: "#8DA4BE", lineHeight: 1.6 }}>
                    npm install passport-azure-ad<br />
                    Add MS_CLIENT_ID and MS_TENANT_ID to .env
                  </div>
                </div>
              )}
              {!ssoMicrosoft && <div style={{ fontSize: 13, color: "#8DA4BE" }}>Enable Microsoft SSO for institutions using Microsoft 365 or Azure AD.</div>}
            </div>
          </div>

          {/* Other integrations status grid */}
          <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: "0 0 16px 0" }}>All Integrations</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { name: "Google SSO",     status: ssoGoogle ? "enabled" : "off",  effort: "Low",    sprint: "3" },
                { name: "Microsoft SSO",  status: ssoMicrosoft ? "enabled" : "off", effort: "Low",  sprint: "3" },
                { name: "Stripe",         status: "planned", effort: "Medium", sprint: "3" },
                { name: "Zoom / Teams",   status: "planned", effort: "Medium", sprint: "3" },
                { name: "Google Calendar",status: "planned", effort: "Medium", sprint: "3" },
                { name: "Slack Webhooks", status: "planned", effort: "Low",    sprint: "3" },
                { name: "QuickBooks",     status: "planned", effort: "High",   sprint: "4" },
                { name: "Giphy",          status: "enabled", effort: "Low",    sprint: "2" },
                { name: "AWS SES",        status: "enabled", effort: "Medium", sprint: "1" },
              ].map(intg => (
                <div key={intg.name} style={{ border: "1px solid #E8E0D0", borderRadius: 6, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A2E" }}>{intg.name}</div>
                    <div style={{ fontSize: 12, color: "#8DA4BE" }}>Sprint {intg.sprint} · {intg.effort} effort</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, textTransform: "uppercase",
                    background: intg.status === "enabled" ? "#2D8B5522" : intg.status === "planned" ? "#e67e2222" : "#8DA4BE22",
                    color:      intg.status === "enabled" ? "#2D8B55"   : intg.status === "planned" ? "#e67e22"   : "#8DA4BE" }}>
                    {intg.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Tenants Tab ═══ */}
      {settingsTab === "tenants" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#6B7B8D" }}>Schema-per-tenant architecture. Each school gets an isolated PostgreSQL schema on the shared RDS instance.</div>
            {ROLES[currentRole]?.level >= 4 && (
              <button onClick={() => setShowAddTenant(true)}
                style={{ padding: "7px 14px", background: "#C9A84C", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                + Add School
              </button>
            )}
          </div>
          <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FAF6EE", borderBottom: "1px solid #D4CFC0" }}>
                  {["School","Subdomain","Schema","Plan","Students","Status","Created"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, color: "#8B7333", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #F0EAD6" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 14, color: "#0B1D3A" }}>{t.name}</td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 13, color: "#1A3668" }}>{t.subdomain}.lawschoolcommons.com</td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 13, color: "#6B7B8D" }}>{t.schema}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: (FIRM_PLAN_COLORS[t.plan] || "#9CA3AF") + "22", color: FIRM_PLAN_COLORS[t.plan] || "#9CA3AF", textTransform: "uppercase" }}>{t.plan}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 14, color: "#1A1A2E", fontWeight: 600 }}>{t.students.toLocaleString()}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#2D8B55" }}>● Active</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#6B7B8D" }}>{new Date(t.created).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Architecture note */}
          <div style={{ background: "#FAF6EE", border: "1px solid #D4CFC0", borderRadius: 8, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: "0 0 12px 0" }}>Multi-Tenant Architecture</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              {[
                { icon: "🗂️", title: "Schema Isolation", body: "Each school's data lives in its own PostgreSQL schema. No row-level mixing — complete data isolation at the schema level." },
                { icon: "🌐", title: "Subdomain Routing", body: "nginx resolves subdomain → tenant at the edge. One wildcard cert (*.lawschoolcommons.com) covers all schools." },
                { icon: "⚙️", title: "Provisioning", body: "INSERT into tenants → CREATE SCHEMA [slug] → run migrations → send SES welcome email with first admin credentials." },
              ].map(c => (
                <div key={c.title} style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 6, padding: "14px 16px" }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{c.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0B1D3A", marginBottom: 6 }}>{c.title}</div>
                  <div style={{ fontSize: 13, color: "#6B7B8D", lineHeight: 1.6 }}>{c.body}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Tenant Modal */}
          {showAddTenant && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "#FFFFFF", borderRadius: 10, padding: 28, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>
                <h3 style={{ margin: "0 0 20px 0", fontSize: 17, fontWeight: 700, color: "#0B1D3A" }}>Provision New School</h3>
                {[["School Name","name","e.g. California Western School of Law"],["Subdomain","subdomain","e.g. cwsl (→ cwsl.lawschoolcommons.com)"]].map(([label, key, ph]) => (
                  <div key={key} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0B1D3A", marginBottom: 5 }}>{label}</div>
                    <input value={newTenant[key]} onChange={e => setNewTenant(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={ph} style={{ width: "100%", padding: "8px 10px", border: "1px solid #D4CFC0", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} />
                  </div>
                ))}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0B1D3A", marginBottom: 5 }}>Plan</div>
                  <select value={newTenant.plan} onChange={e => setNewTenant(p => ({ ...p, plan: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #D4CFC0", borderRadius: 6, fontSize: 14 }}>
                    {["Starter","Professional","Enterprise"].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div style={{ background: "#FAF6EE", borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#6B7B8D", fontFamily: "monospace" }}>
                  SQL: INSERT INTO tenants...; CREATE SCHEMA {newTenant.subdomain || "[subdomain]"};
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => setShowAddTenant(false)} style={{ padding: "8px 16px", border: "1px solid #D4CFC0", borderRadius: 6, background: "transparent", cursor: "pointer", fontSize: 14, color: "#6B7B8D" }}>Cancel</button>
                  <button onClick={() => {
                    if (!newTenant.name || !newTenant.subdomain) return;
                    setTenants(prev => [...prev, { id: "t" + Date.now(), ...newTenant, students: 0, schema: newTenant.subdomain, status: "pending", created: new Date().toISOString().split("T")[0] }]);
                    setNewTenant({ name: "", subdomain: "", plan: "Starter" });
                    setShowAddTenant(false);
                  }} style={{ padding: "8px 16px", background: "#C9A84C", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                    Provision School
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ AWS Infrastructure Tab ═══ */}
      {settingsTab === "infra" && (
        <div>
          {/* Service status cards */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: "0 0 14px 0" }}>AWS Service Status</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {awsServices.map(svc => (
                <div key={svc.id} style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ fontSize: 22, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>{svc.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#0B1D3A" }}>{svc.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, textTransform: "uppercase",
                        background: svc.status === "running" ? "#2D8B5522" : svc.status === "planned" ? "#e67e2222" : "#B91C1C22",
                        color:      svc.status === "running" ? "#2D8B55"   : svc.status === "planned" ? "#e67e22"   : "#B91C1C" }}>
                        {svc.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7B8D", lineHeight: 1.5, wordBreak: "break-all" }}>{svc.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Migration checklist */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            {[
              { phase: "Phase 1", title: "DNS → Route 53", done: false, items: [
                { t: "Transfer lexcommons.org to Route 53", done: false },
                { t: "Transfer lawschoolcommons.com to Route 53", done: false },
                { t: "Create hosted zones for both domains", done: false },
                { t: "Add A records pointing to 54.214.130.86", done: false },
                { t: "Configure Route 53 health checks", done: false },
              ]},
              { phase: "Phase 2", title: "CDN → CloudFront", done: false, items: [
                { t: "Create CloudFront distribution for S3", done: false },
                { t: "Set S3_CDN_URL env var on EC2", done: false },
                { t: "Update all media upload URLs to use CDN", done: false },
                { t: "Set cache behaviors for /uploads/*", done: false },
              ]},
              { phase: "Phase 3", title: "SSL → ACM", done: false, items: [
                { t: "Request wildcard cert *.lexcommons.org in ACM", done: false },
                { t: "Request *.lawschoolcommons.com in ACM", done: false },
                { t: "Attach certs to CloudFront and ALB", done: false },
                { t: "Remove certbot / Let's Encrypt from VPS", done: false },
              ]},
              { phase: "Phase 4", title: "CI/CD Pipeline", done: false, items: [
                { t: "Add GitHub Actions workflow file (.yml)", done: false },
                { t: "Add EC2 SSH key to GitHub Secrets", done: false },
                { t: "Test auto-deploy on push to main", done: false },
                { t: "Set up dev → staging → main branch protection", done: false },
              ]},
            ].map(section => (
              <div key={section.phase} style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "#e67e2222", color: "#e67e22" }}>{section.phase}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#0B1D3A" }}>{section.title}</span>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {section.items.map((item, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0", fontSize: 13, color: item.done ? "#2D8B55" : "#4A4A6A", borderBottom: i < section.items.length - 1 ? "1px solid #F0EAD6" : "none" }}>
                      <span style={{ color: item.done ? "#2D8B55" : "#D4CFC0", marginTop: 2, flexShrink: 0, fontWeight: 700 }}>{item.done ? "✓" : "○"}</span>
                      <span style={{ textDecoration: item.done ? "line-through" : "none" }}>{item.t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Current architecture diagram */}
          <div style={{ background: "#0B1D3A", borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#C9A84C", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>Current Architecture</div>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "#8DA4BE", lineHeight: 2 }}>
              <div>DNS (Registrar) → <span style={{ color: "#C9A84C" }}>45.82.72.210 (VPS)</span> → nginx → /var/www/ (static)</div>
              <div style={{ paddingLeft: 24, color: "#6B7B8D" }}>↳ /api/* → proxy → <span style={{ color: "#C9A84C" }}>54.214.130.86 (EC2)</span> → Node.js :3001</div>
              <div style={{ paddingLeft: 48, color: "#6B7B8D" }}>↳ DB queries → <span style={{ color: "#C9A84C" }}>RDS PostgreSQL</span> (us-west-2)</div>
              <div style={{ paddingLeft: 48, color: "#6B7B8D" }}>↳ File uploads → <span style={{ color: "#C9A84C" }}>S3 lexcommons-uploads</span></div>
              <div style={{ paddingLeft: 48, color: "#6B7B8D" }}>↳ Email → <span style={{ color: "#C9A84C" }}>SES</span> (noreply@lexcommons.org)</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#C9A84C", margin: "16px 0 12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Target Architecture (Sprint 4)</div>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "#8DA4BE", lineHeight: 2 }}>
              <div><span style={{ color: "#2D8B55" }}>Route 53</span> → <span style={{ color: "#2D8B55" }}>CloudFront</span> → EC2 Elastic IP (54.214.130.86)</div>
              <div style={{ paddingLeft: 24, color: "#6B7B8D" }}>↳ Static: <span style={{ color: "#2D8B55" }}>S3 + CloudFront CDN</span> (ACM wildcard cert)</div>
              <div style={{ paddingLeft: 24, color: "#6B7B8D" }}>↳ API: EC2 (Node.js) → RDS + SES (unchanged)</div>
              <div style={{ paddingLeft: 24, color: "#6B7B8D" }}>↳ Deploy: <span style={{ color: "#2D8B55" }}>GitHub Actions</span> → SSH → pm2 restart</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Backups Tab ═══ */}
      {settingsTab === "backups" && (
        <div>
          {/* Backup schedule cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
            {[
              { icon: "🗄️", label: "RDS Snapshots",    detail: "Daily · 2:00 AM UTC", status: "active",  next: "Tomorrow 02:00" },
              { icon: "🪣", label: "S3 Versioning",     detail: "Continuous",           status: "active",  next: "Always on" },
              { icon: "📦", label: "pg_dump",           detail: "Daily · 3:00 AM UTC", status: "active",  next: "Tomorrow 03:00" },
              { icon: "🔄", label: "rsync /var/www",    detail: "Daily · 4:00 AM UTC", status: "active",  next: "Tomorrow 04:00" },
            ].map(b => (
              <div key={b.label} style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: "16px 18px" }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{b.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0B1D3A", marginBottom: 4 }}>{b.label}</div>
                <div style={{ fontSize: 12, color: "#6B7B8D", marginBottom: 8 }}>{b.detail}</div>
                <div style={{ fontSize: 11, color: "#2D8B55", fontWeight: 600 }}>● {b.status}</div>
                <div style={{ fontSize: 11, color: "#8DA4BE", marginTop: 2 }}>Next: {b.next}</div>
              </div>
            ))}
          </div>

          {/* Manual backup trigger */}
          <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: "0 0 4px 0" }}>Manual Backup</h3>
                <div style={{ fontSize: 13, color: "#6B7B8D" }}>Trigger a pg_dump immediately — useful before major schema changes or deployments.</div>
              </div>
              <button disabled={manualBackupRunning}
                onClick={() => {
                  setManualBackupRunning(true); setManualBackupOutput("");
                  const steps = [
                    "$ pg_dump -h lexcommons-db.cl0o6ia04wsw.us-west-2.rds.amazonaws.com -U postgres -d lexcommons > backup_20260310.sql",
                    "pg_dump: connecting to database...",
                    "pg_dump: reading schemas...",
                    "pg_dump: reading tables (43 tables found)...",
                    "pg_dump: dumping contents of table users (6 rows)...",
                    "pg_dump: dumping contents of table pages (13 rows)...",
                    "pg_dump: dumping contents of table activity_log (284 rows)...",
                    "pg_dump: dumping contents of table password_reset_tokens...",
                    "pg_dump: done.",
                    "$ aws s3 cp backup_20260310.sql s3://lexcommons-backups/manual/",
                    "upload: backup_20260310.sql → s3://lexcommons-backups/manual/backup_20260310.sql",
                    "✓ Backup complete: 147 MB · saved to S3"
                  ];
                  let i = 0;
                  const interval = setInterval(() => {
                    setManualBackupOutput(prev => prev + (prev ? "\n" : "") + steps[i]);
                    i++;
                    if (i >= steps.length) { clearInterval(interval); setManualBackupRunning(false); setBackupLog(prev => [{ id: "b" + Date.now(), type: "pg_dump (manual)", status: "completed", size: "147 MB", time: new Date().toISOString().replace("T"," ").slice(0,19) + " UTC", retention: "S3 manual/" }, ...prev]); }
                  }, 350);
                }}
                style={{ padding: "8px 16px", background: manualBackupRunning ? "#8a7035" : "#C9A84C", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, fontSize: 13, cursor: manualBackupRunning ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                {manualBackupRunning ? "Running…" : "▶ Run pg_dump Now"}
              </button>
            </div>
            {manualBackupOutput && (
              <pre style={{ background: "#0B1D3A", borderRadius: 6, padding: "12px 14px", fontSize: 12, color: "#8DA4BE", fontFamily: "monospace", lineHeight: 1.7, overflow: "auto", maxHeight: 220, margin: 0 }}>
                {manualBackupOutput}
              </pre>
            )}
          </div>

          {/* Backup history */}
          <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid #D4CFC0", fontSize: 14, fontWeight: 700, color: "#0B1D3A" }}>Backup History</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#FAF6EE" }}>
                {["Type","Status","Size","Timestamp","Retention"].map(h => (
                  <th key={h} style={{ padding: "9px 16px", textAlign: "left", fontSize: 12, color: "#8B7333", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {backupLog.map(b => (
                  <tr key={b.id} style={{ borderTop: "1px solid #F0EAD6" }}>
                    <td style={{ padding: "10px 16px", fontSize: 14, fontWeight: 600, color: "#0B1D3A" }}>{b.type}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#2D8B55" }}>✓ {b.status}</span>
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: "#1A1A2E", fontFamily: "monospace" }}>{b.size}</td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: "#6B7B8D", fontFamily: "monospace" }}>{b.time}</td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: "#8DA4BE" }}>{b.retention}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cron reference */}
          <div style={{ background: "#0B1D3A", borderRadius: 8, padding: 18, marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#C9A84C", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Crontab Reference (EC2)</div>
            {[
              "0 2 * * *   /usr/bin/pg_dump -h [rds-endpoint] -U postgres -d lexcommons | gzip > /backups/pg_$(date +\%Y\%m\%d).sql.gz",
              "0 3 * * *   aws s3 cp /backups/pg_$(date +\%Y\%m\%d).sql.gz s3://lexcommons-backups/daily/",
              "0 4 * * *   rsync -avz /var/www/ s3://lexcommons-backups/www/",
              "0 5 * * 1   find /backups/ -name '*.sql.gz' -mtime +14 -delete   # retain 14 days locally",
            ].map((line, i) => (
              <div key={i} style={{ fontFamily: "monospace", fontSize: 11, color: "#8DA4BE", lineHeight: 1.9, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ CI/CD Tab ═══ */}
      {settingsTab === "cicd" && (
        <div>
          {/* Branch strategy */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { branch: "main",      icon: "🚀", color: "#2D8B55", desc: "Production. Protected — PRs only. Auto-deploys to EC2.", deployTo: "ec2 (54.214.130.86)" },
              { branch: "dev",       icon: "🔧", color: "#2563EB", desc: "Staging. Merge feature branches here first for integration testing.", deployTo: "optional staging" },
              { branch: "feature/*", icon: "✏️",  color: "#8DA4BE", desc: "Short-lived feature branches. Open PR to dev when ready.", deployTo: "none (local only)" },
            ].map(b => (
              <div key={b.branch} style={{ background: "#FFFFFF", border: `1px solid ${b.color}44`, borderRadius: 8, padding: "16px 18px" }}>
                <div style={{ fontSize: 18, marginBottom: 8 }}>{b.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: b.color, fontFamily: "monospace", marginBottom: 6 }}>{b.branch}</div>
                <div style={{ fontSize: 13, color: "#4A4A6A", lineHeight: 1.6, marginBottom: 8 }}>{b.desc}</div>
                <div style={{ fontSize: 11, color: "#8DA4BE" }}>Deploy target: <span style={{ fontFamily: "monospace" }}>{b.deployTo}</span></div>
              </div>
            ))}
          </div>

          {/* GitHub Actions workflow preview */}
          <div style={{ background: "#0B1D3A", borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#C9A84C", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                .github/workflows/deploy.yml
              </div>
              <span style={{ fontSize: 11, color: "#8DA4BE" }}>Download with CI/CD files below</span>
            </div>
            <pre style={{ margin: 0, fontSize: 11, color: "#8DA4BE", fontFamily: "monospace", lineHeight: 1.8, overflow: "auto", maxHeight: 280 }}>{`name: Deploy to EC2

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci --production

      - name: Deploy to EC2 via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: \${{ secrets.EC2_HOST }}
          username: ubuntu
          key: \${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /var/www/lexcommons-api
            git pull origin main
            npm ci --production
            pm2 restart lexcommons-api --update-env
            pm2 save`}</pre>
          </div>

          {/* Simulated deploy button */}
          <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", marginBottom: 4 }}>Manual Deploy</div>
                <div style={{ fontSize: 13, color: "#6B7B8D" }}>Trigger deployment of current <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#0B1D3A" }}>main</span> branch to EC2</div>
              </div>
              <button disabled={deploying} onClick={() => {
                setDeploying(true);
                setTimeout(() => setDeploying(false), 4000);
              }} style={{ padding: "9px 18px", background: deploying ? "#8a7035" : "#2D8B55", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, fontSize: 14, cursor: deploying ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                {deploying ? "🔄 Deploying…" : "🚀 Deploy Now"}
              </button>
            </div>
            {deploying && (
              <div style={{ marginTop: 14, background: "#FAF6EE", borderRadius: 6, padding: "10px 14px", fontSize: 12, color: "#6B7B8D", fontFamily: "monospace" }}>
                Running GitHub Actions workflow on main…<br />
                (In production this triggers POST to GitHub API: /repos/owner/lexcommons-api/dispatches)
              </div>
            )}
          </div>

          {/* Deployment history */}
          <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid #D4CFC0", fontSize: 14, fontWeight: 700, color: "#0B1D3A" }}>Deployment History</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#FAF6EE" }}>
                {["Branch","Commit","Message","Author","Time","Status","Duration"].map(h => (
                  <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, color: "#8B7333", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {deployHistory.map(d => (
                  <tr key={d.id} style={{ borderTop: "1px solid #F0EAD6" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                        background: d.branch === "main" ? "#2D8B5522" : d.branch === "dev" ? "#2563EB22" : "#8DA4BE22",
                        color:      d.branch === "main" ? "#2D8B55"   : d.branch === "dev" ? "#2563EB"   : "#8DA4BE" }}>
                        {d.branch}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12, color: "#6B7B8D" }}>{d.commit}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "#1A1A2E", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.message}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "#6B7B8D" }}>{d.author}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#8DA4BE", whiteSpace: "nowrap" }}>{d.time}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 12, fontWeight: 700,
                        color: d.status === "success" ? "#2D8B55" : d.status === "pending" ? "#e67e22" : "#B91C1C" }}>
                        {d.status === "success" ? "✓ success" : d.status === "pending" ? "○ pending" : "✗ failed"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#8DA4BE", fontFamily: "monospace" }}>{d.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ HIPAA Compliance Tab ═══ */}
      {settingsTab === "hipaa" && (
        <div>
          {/* Summary scorecard */}
          {(() => {
            const done   = hipaaItems.filter(i => i.done).length;
            const total  = hipaaItems.length;
            const pct    = Math.round((done / total) * 100);
            const cats   = [...new Set(hipaaItems.map(i => i.cat))];
            return (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: "16px 18px", gridColumn: "1" }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: pct >= 80 ? "#2D8B55" : pct >= 50 ? "#e67e22" : "#B91C1C", lineHeight: 1 }}>{pct}%</div>
                  <div style={{ fontSize: 13, color: "#6B7B8D", marginTop: 4 }}>Overall ({done}/{total})</div>
                  <div style={{ marginTop: 10, height: 6, background: "#F0EAD6", borderRadius: 3 }}>
                    <div style={{ height: 6, width: `${pct}%`, background: pct >= 80 ? "#2D8B55" : "#e67e22", borderRadius: 3, transition: "width 0.5s" }} />
                  </div>
                </div>
                {cats.map(cat => {
                  const catItems = hipaaItems.filter(i => i.cat === cat);
                  const catDone  = catItems.filter(i => i.done).length;
                  return (
                    <div key={cat} style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: "16px 18px" }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#0B1D3A", lineHeight: 1 }}>{catDone}/{catItems.length}</div>
                      <div style={{ fontSize: 13, color: "#6B7B8D", marginTop: 4 }}>{cat}</div>
                      <div style={{ marginTop: 10, height: 6, background: "#F0EAD6", borderRadius: 3 }}>
                        <div style={{ height: 6, width: `${Math.round(catDone/catItems.length*100)}%`, background: "#C9A84C", borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Checklist grouped by category */}
          {[...new Set(hipaaItems.map(i => i.cat))].map(cat => (
            <div key={cat} style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, marginBottom: 14, overflow: "hidden" }}>
              <div style={{ padding: "11px 18px", background: "#FAF6EE", borderBottom: "1px solid #D4CFC0", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0B1D3A" }}>
                  {cat === "Technical" ? "🔧" : cat === "Administrative" ? "📋" : cat === "Physical" ? "🏢" : "🗃️"} {cat} Safeguards
                </span>
                <span style={{ fontSize: 12, color: "#8DA4BE" }}>
                  {hipaaItems.filter(i => i.cat === cat && i.done).length}/{hipaaItems.filter(i => i.cat === cat).length} complete
                </span>
              </div>
              {hipaaItems.filter(i => i.cat === cat).map((item, idx, arr) => (
                <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 18px", borderBottom: idx < arr.length - 1 ? "1px solid #F0EAD6" : "none", background: "transparent" }}>
                  <button onClick={() => setHipaaItems(prev => prev.map(x => x.id === item.id ? { ...x, done: !x.done } : x))}
                    style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${item.done ? "#2D8B55" : "#D4CFC0"}`, background: item.done ? "#2D8B55" : "transparent", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    {item.done ? "✓" : ""}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: item.done ? "#2D8B55" : "#1A1A2E", textDecoration: item.done ? "line-through" : "none", marginBottom: 3 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "#8DA4BE", lineHeight: 1.5 }}>{item.note}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap",
                    background: item.done ? "#2D8B5522" : "#e67e2222",
                    color:      item.done ? "#2D8B55"   : "#e67e22" }}>
                    {item.done ? "Done" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          ))}

          {/* BAA note */}
          <div style={{ background: "#FEF3C7", border: "1px solid #e67e2244", borderRadius: 8, padding: "14px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
            <div style={{ fontSize: 13, color: "#92400E", lineHeight: 1.7 }}>
              <strong>Before storing any PHI or student health data:</strong> Sign a Business Associate Agreement (BAA) with AWS via AWS Artifact. Enable HIPAA-eligible services in your AWS account. Document all data flows involving personally identifiable information.
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


// ─── Login Screen ─────────────────────────────────────────────────────────────

const API_URL = "https://api.lexcommons.org";


function ResetPasswordScreen({ token, darkMode, onDone }) {
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);

  const handleReset = async () => {
    if (!password || !confirm) { setError("Please fill in both fields."); return; }
    if (password !== confirm)  { setError("Passwords do not match."); return; }
    if (password.length < 8)   { setError("Password must be at least 8 characters."); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API_URL}/api/forgot-password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Reset failed."); return; }
      setSuccess(true);
      setTimeout(() => { window.history.replaceState({}, "", "/app"); window.location.reload(); }, 2000);
    } catch { setError("Could not reach the server. Please try again."); }
    finally { setLoading(false); }
  };

  const bg  = darkMode ? "#0f1923" : "#FAF6EE";
  const card = darkMode ? "#1a2535" : "#ffffff";

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Source Sans 3, Segoe UI, sans-serif" }}>
      <div style={{ background: card, borderRadius: 12, padding: "40px 36px", width: "100%", maxWidth: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔐</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0B1D3A", margin: 0 }}>Set new password</h2>
          <p style={{ color: "#6B7B8D", fontSize: 14, marginTop: 6 }}>Enter your new password below.</p>
        </div>
        {success ? (
          <div style={{ textAlign: "center", color: "#2D8B55", fontWeight: 600, fontSize: 15 }}>
            ✓ Password updated! Redirecting to login…
          </div>
        ) : (
          <>
            {error && <div style={{ background: "#fef2f2", color: "#B91C1C", borderRadius: 6, padding: "10px 12px", fontSize: 14, marginBottom: 16 }}>{error}</div>}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 14, color: "#6B7B8D", display: "block", marginBottom: 5 }}>New password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                style={{ width: "100%", padding: "10px 12px", background: "#FAF6EE", border: "1px solid #252c3a", borderRadius: 6, color: "#1A1A2E", fontSize: 15, boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 14, color: "#6B7B8D", display: "block", marginBottom: 5 }}>Confirm password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleReset()}
                placeholder="Repeat password"
                style={{ width: "100%", padding: "10px 12px", background: "#FAF6EE", border: "1px solid #252c3a", borderRadius: 6, color: "#1A1A2E", fontSize: 15, boxSizing: "border-box" }} />
            </div>
            <button onClick={handleReset} disabled={loading}
              style={{ width: "100%", padding: "10px", background: loading ? "#8a7035" : "#C9A84C", color: "#fff", border: "none", borderRadius: 6, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Updating…" : "Set New Password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function LoginScreen({ onLogin, darkMode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");


  const ROLE_MAP = { 4: "administrator", 3: "manager", 2: "faculty", 1: "user" };

  const handleLogin = async (overrideEmail, overridePassword) => {
    const e = (overrideEmail ?? email).trim();
    const p = overridePassword ?? password;
    if (!e || !p) { setError("Please enter your email and password."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: e, password: p }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid credentials."); return; }
      const u = data.user;
      onLogin({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        role: ROLE_MAP[u.role] || "user",
        token: data.token,
        lastLogin: new Date().toISOString().slice(0, 10),
        site: "all",
        active: true,
      });
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!forgotEmail.trim()) { setForgotError("Please enter your email."); return; }
    setForgotLoading(true); setForgotError("");
    try {
      await fetch(`${API_URL}/api/forgot-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() })
      });
      setForgotSent(true);
    } catch { setForgotError("Could not reach the server."); }
    finally { setForgotLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#0B1D3A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Libre Baskerville, Georgia, serif" }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, background: "#C9A84C", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="shield" size={18} />
          </div>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.02em" }}>LexCommons</span>
        </div>
        <p style={{ color: "#8DA4BE", fontSize: 15, margin: 0 }}>Network Administration</p>
      </div>

      <div style={{ background: "#FFFFFF", border: "1px solid #252c3a", borderRadius: 12, padding: 32, width: 360 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: "#0B1D3A", margin: "0 0 22px 0", fontFamily: "Libre Baskerville, Georgia, serif" }}>Sign In</h2>
        {error && <div style={{ background: "#FEE2E2", border: "1px solid #e74c3c44", borderRadius: 6, padding: "10px 12px", marginBottom: 14, fontSize: 14, color: "#B91C1C" }}>{error}</div>}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 14, color: "#6B7B8D", display: "block", marginBottom: 5 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@lexcommons.org"
            style={{ width: "100%", padding: "10px 12px", background: "#FAF6EE", border: "1px solid #252c3a", borderRadius: 6, color: "#1A1A2E", fontSize: 15, boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 14, color: "#6B7B8D", display: "block", marginBottom: 5 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="••••••••"
            style={{ width: "100%", padding: "10px 12px", background: "#FAF6EE", border: "1px solid #252c3a", borderRadius: 6, color: "#1A1A2E", fontSize: 15, boxSizing: "border-box" }} />
        </div>
        <button onClick={() => handleLogin()} disabled={loading}
          style={{ width: "100%", padding: "10px", background: loading ? "#8a7035" : "#C9A84C", color: "#fff", border: "none", borderRadius: 6, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button onClick={() => { setForgotMode(true); setForgotEmail(email); setForgotError(""); setForgotSent(false); }}
            style={{ background: "none", border: "none", color: "#8DA4BE", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
            Forgot password?
          </button>
        </div>
        <div style={{ marginTop: 20, borderTop: "1px solid #e8e0d0", paddingTop: 16 }}>
          <div style={{ fontSize: 11, color: "#8DA4BE", textAlign: "center", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>Or continue with</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <a href="https://api.lexcommons.org/auth/google?origin=https://ops.lexcommons.org" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "9px 16px", background: "#fff", border: "1px solid #dadce0", borderRadius: 6, cursor: "pointer", textDecoration: "none", transition: "box-shadow 0.15s" }}
              onMouseOver={e => e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.12)"}
              onMouseOut={e => e.currentTarget.style.boxShadow="none"}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v8.51h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.14z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="#FBBC05" d="M10.53 28.59c-.49-1.47-.76-3.04-.76-4.59s.27-3.12.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.55 10.78l7.98-6.19z"/><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.55 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/></svg>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#3c4043", fontFamily: "DM Sans, sans-serif" }}>Continue with Google</span>
            </a>
            <a href="https://api.lexcommons.org/auth/microsoft?origin=https://ops.lexcommons.org" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "9px 16px", background: "#fff", border: "1px solid #dadce0", borderRadius: 6, cursor: "pointer", textDecoration: "none", transition: "box-shadow 0.15s" }}
              onMouseOver={e => e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.12)"}
              onMouseOut={e => e.currentTarget.style.boxShadow="none"}>
              <svg width="18" height="18" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#3c4043", fontFamily: "DM Sans, sans-serif" }}>Continue with Microsoft</span>
            </a>
          </div>
        </div>
      </div>

      {forgotMode && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#FFFFFF", borderRadius: 12, padding: 32, width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            {forgotSent ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0B1D3A", margin: "0 0 10px 0" }}>Check your email</h3>
                <p style={{ fontSize: 14, color: "#6B7B8D", margin: "0 0 24px 0", lineHeight: 1.6 }}>
                  If an account exists for <strong>{forgotEmail}</strong>, a reset link has been sent. Check your spam folder too.
                </p>
                <button onClick={() => setForgotMode(false)}
                  style={{ width: "100%", padding: "10px", background: "#C9A84C", color: "#fff", border: "none", borderRadius: 6, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  Back to Sign In
                </button>
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0B1D3A", margin: "0 0 8px 0" }}>Reset Password</h3>
                <p style={{ fontSize: 14, color: "#6B7B8D", margin: "0 0 20px 0" }}>Enter your email and we'll send a reset link.</p>
                {forgotError && <div style={{ background: "#FEE2E2", borderRadius: 6, padding: "10px 12px", marginBottom: 14, fontSize: 14, color: "#B91C1C" }}>{forgotError}</div>}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 14, color: "#6B7B8D", display: "block", marginBottom: 5 }}>Email Address</label>
                  <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleForgot()} placeholder="your@lexcommons.org" autoFocus
                    style={{ width: "100%", padding: "10px 12px", background: "#FAF6EE", border: "1px solid #252c3a", borderRadius: 6, color: "#1A1A2E", fontSize: 15, boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setForgotMode(false)}
                    style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid #D4CFC0", borderRadius: 6, fontSize: 14, color: "#6B7B8D", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button onClick={handleForgot} disabled={forgotLoading}
                    style={{ flex: 2, padding: "10px", background: forgotLoading ? "#8a7035" : "#C9A84C", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: forgotLoading ? "not-allowed" : "pointer" }}>
                    {forgotLoading ? "Sending…" : "Send Reset Link"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Account Settings Page ─────────────────────────────────────────────────────
function AccountSettingsPage({ currentUser, token, darkMode, toggleDark, dyslexieFont, toggleDyslexie, accentColor = "#C9A84C", changeAccent }) {
  const [name, setName] = useState(currentUser.name || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState("");

  const handlePasswordChange = async () => {
    setPwError("");
    if (!currentPw) return setPwError("Enter your current password.");
    if (newPw.length < 8) return setPwError("New password must be at least 8 characters.");
    if (newPw !== confirmPw) return setPwError("Passwords do not match.");
    setPwSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${currentUser.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      setPwSaved(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => { setPwSaved(false); setShowPwForm(false); }, 2000);
    } catch(e) { setPwError(e.message); }
    finally { setPwSaving(false); }
  };
  const initials = (currentUser.name || "?").split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();

  const handleSave = async () => {
    setSaving(true); setSaved(false); setSaveError("");
    try {
      const [first, ...rest] = name.trim().split(" ");
      const res = await fetch(`${API_URL}/api/users/${currentUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), firstName: first, lastName: rest.join(" ") })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setSaveError(e.message); }
    finally { setSaving(false); }
  };

  const Toggle = ({ on, onClick }) => (
    <button onClick={onClick} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative", background: on ? "#C9A84C" : "#D4CFC0", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
    </button>
  );

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>Account & Preferences</h2>
        <p style={{ color: "#6B7B8D", marginTop: 4, fontSize: 15 }}>Manage your profile and display settings.</p>
      </div>

      {/* Profile */}
      <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: 24, marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: "0 0 20px 0" }}>Profile</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: ROLES[currentUser.role]?.color + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: ROLES[currentUser.role]?.color, flexShrink: 0, border: `2px solid ${ROLES[currentUser.role]?.color}44` }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0B1D3A" }}>{currentUser.name}</div>
            <div style={{ fontSize: 14, color: "#6B7B8D" }}>{currentUser.email}</div>
            <RoleBadge role={currentUser.role} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: "#6B7B8D", display: "block", marginBottom: 5 }}>Display Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", background: "#FAF6EE", border: "1px solid #D4CFC0", borderRadius: 6, fontSize: 15, color: "#1A1A2E", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: "#6B7B8D", display: "block", marginBottom: 5 }}>Email Address</label>
          <input value={currentUser.email} disabled
            style={{ width: "100%", padding: "9px 12px", background: "#F0EAD6", border: "1px solid #D4CFC0", borderRadius: 6, fontSize: 15, color: "#8B7333", boxSizing: "border-box" }} />
          <div style={{ fontSize: 12, color: "#6B7B8D", marginTop: 4 }}>Contact an administrator to change your email address.</div>
        </div>
        {saveError && <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 10 }}>{saveError}</div>}
        {saved && <div style={{ color: "#166534", fontSize: 13, marginBottom: 10 }}>✓ Profile saved successfully</div>}
        <button onClick={handleSave} disabled={saving}
          style={{ padding: "9px 20px", background: saving ? "#8a7035" : "#C9A84C", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </div>

      {/* Display Preferences */}
      <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: 24, marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: "0 0 20px 0" }}>Display Preferences</h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid #EEE" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1A2E" }}>Dark Mode</div>
            <div style={{ fontSize: 13, color: "#6B7B8D" }}>Easier on the eyes in low-light environments</div>
          </div>
          <Toggle on={darkMode} onClick={toggleDark} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1A2E" }}>OpenDyslexic Font</div>
            <div style={{ fontSize: 13, color: "#6B7B8D" }}>Weighted letterforms designed to improve reading for dyslexia</div>
          </div>
          <Toggle on={dyslexieFont} onClick={toggleDyslexie} />
        </div>
      </div>

      {/* Accent Color */}
      <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: "0 0 4px 0" }}>Accent Color</h3>
        <p style={{ fontSize: 13, color: "#6B7B8D", margin: "0 0 16px 0" }}>Customize the highlight color used throughout the dashboard</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          {["#C9A84C","#0B5394","#1E7A4F","#8B2252","#B85C2A","#4A3B8C","#1A6B6B","#B52020","#2E5E8E","#6B6B1A"].map(color => (
            <button key={color} onClick={() => changeAccent && changeAccent(color)} title={color}
              style={{ width: 32, height: 32, borderRadius: "50%", background: color, border: accentColor === color ? "3px solid #1A1A2E" : "2px solid #D4CFC0", cursor: "pointer", outline: "none", transition: "transform 0.1s, border 0.1s", transform: accentColor === color ? "scale(1.2)" : "scale(1)" }} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ fontSize: 13, color: "#6B7B8D" }}>Custom:</label>
          <input type="color" value={accentColor} onChange={e => changeAccent && changeAccent(e.target.value)}
            style={{ width: 40, height: 32, padding: 2, border: "1px solid #D4CFC0", borderRadius: 6, cursor: "pointer", background: "transparent" }} />
          <span style={{ fontSize: 13, color: "#6B7B8D", fontFamily: "monospace" }}>{accentColor}</span>
          <button onClick={() => changeAccent && changeAccent("#C9A84C")}
            style={{ fontSize: 12, padding: "4px 10px", border: "1px solid #D4CFC0", borderRadius: 4, background: "transparent", color: "#6B7B8D", cursor: "pointer" }}>
            Reset
          </button>
        </div>
      </div>

      {/* Security */}
      <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: "0 0 16px 0" }}>Security</h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1A2E" }}>Password</div>
            <div style={{ fontSize: 13, color: "#6B7B8D" }}>Change your account password</div>
          </div>
          <button onClick={() => { setShowPwForm(v => !v); setPwError(""); setPwSaved(false); }}
            style={{ fontSize: 13, color: "#C9A84C", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
            {showPwForm ? "Cancel" : "Change Password"}
          </button>
        </div>
        {showPwForm && (
          <div style={{ marginTop: 16, borderTop: "1px solid #E8E4DA", paddingTop: 16 }}>
            {pwError && <div style={{ background: "#fef2f2", color: "#B91C1C", borderRadius: 6, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{pwError}</div>}
            {pwSaved && <div style={{ background: "#f0fdf4", color: "#2D8B55", borderRadius: 6, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>Password changed successfully.</div>}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 13, color: "#6B7B8D", display: "block", marginBottom: 4 }}>Current Password</label>
              <input type="password" value={currentPw} onChange={e => { setCurrentPw(e.target.value); setPwError(""); }}
                style={{ width: "100%", padding: "9px 12px", background: "#FAF6EE", border: "1px solid #D4CFC0", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 13, color: "#6B7B8D", display: "block", marginBottom: 4 }}>New Password</label>
              <input type="password" value={newPw} onChange={e => { setNewPw(e.target.value); setPwError(""); }}
                style={{ width: "100%", padding: "9px 12px", background: "#FAF6EE", border: "1px solid #D4CFC0", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: "#6B7B8D", display: "block", marginBottom: 4 }}>Confirm New Password</label>
              <input type="password" value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setPwError(""); }}
                style={{ width: "100%", padding: "9px 12px", background: "#FAF6EE", border: "1px solid #D4CFC0", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <button onClick={handlePasswordChange} disabled={pwSaving}
              style={{ padding: "9px 20px", background: "#0B1D3A", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: pwSaving ? "wait" : "pointer" }}>
              {pwSaving ? "Saving..." : "Update Password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AI Chat Widget ─────────────────────────────────────────────────────────────
function AIChatWidget({ token, currentUser, darkMode }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: `Hi ${currentUser?.name?.split(" ")[0] || "there"}! I'm your LexCommons admin assistant. I can help with nginx config, user management, deployment steps, or anything about the platform.` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open && bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are an expert admin assistant for the LexCommons legal education platform. The current user is ${currentUser?.name} (${currentUser?.role}). You have deep knowledge of: nginx configuration, Node.js/Express API, PostgreSQL/RDS, AWS (EC2, S3, Route53, SES), React frontend, JWT auth, and the LexCommons-specific architecture. Be concise and practical. For code, use short snippets. Server IP: 45.82.72.210 (VPS), 54.214.130.86 (EC2 API). API runs on port 3001 via PM2.`,
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Sorry, I couldn't get a response.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    }
    setLoading(false);
  };

  const bg = darkMode ? "#1a2535" : "#FFFFFF";
  const border = darkMode ? "#2a3a52" : "#D4CFC0";
  const textColor = darkMode ? "#E8E4DC" : "#1A1A2E";

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      {open && (
        <div style={{ width: 360, height: 500, background: bg, border: `1px solid ${border}`, borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", marginBottom: 12, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "12px 16px", background: "#0B1D3A", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, background: "#C9A84C", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✦</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>LexCommons AI</div>
                <div style={{ fontSize: 11, color: "#8DA4BE" }}>Admin Assistant · Claude</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => setMessages([{ role: "assistant", content: `Hi ${currentUser?.name?.split(" ")[0]}! Fresh start — how can I help?` }])}
                title="Clear chat"
                style={{ background: "none", border: "none", color: "#6B7B8D", cursor: "pointer", fontSize: 14, padding: "2px 4px" }}>↺</button>
              <button onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", color: "#6B7B8D", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "85%", padding: "9px 12px", borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  background: m.role === "user" ? "#C9A84C" : (darkMode ? "#21304a" : "#F0EAD6"),
                  color: m.role === "user" ? "#fff" : textColor,
                  fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word"
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "9px 14px", background: darkMode ? "#21304a" : "#F0EAD6", borderRadius: "12px 12px 12px 2px", fontSize: 18, letterSpacing: 2 }}>
                  <span style={{ animation: "pulse 1.2s infinite" }}>•••</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${border}`, display: "flex", gap: 8, flexShrink: 0 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Ask anything about LexCommons…"
              style={{ flex: 1, padding: "8px 12px", background: darkMode ? "#0f1923" : "#FAF6EE", border: `1px solid ${border}`, borderRadius: 6, fontSize: 14, color: textColor, outline: "none" }} />
            <button onClick={send} disabled={loading || !input.trim()}
              style={{ padding: "8px 14px", background: loading || !input.trim() ? "#8a7035" : "#C9A84C", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontWeight: 700 }}>
              ↑
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button onClick={() => setOpen(v => !v)}
        style={{ width: 52, height: 52, borderRadius: "50%", background: open ? "#0B1D3A" : "#C9A84C", border: `2px solid ${open ? "#C9A84C" : "#0B1D3A"}`, color: "#fff", fontSize: 22, cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {open ? "×" : "✦"}
      </button>
    </div>
  );
}


// ─── LawFirmCommons ─────────────────────────────────────────────────────────

const FIRM_ROLES = {
  partner:    { label: "Partner",    level: 4, color: "#7C3AED", equiv: "Administrator" },
  associate:  { label: "Associate",  level: 3, color: "#2563EB", equiv: "Manager" },
  paralegal:  { label: "Paralegal",  level: 2, color: "#0891B2", equiv: "Faculty" },
  client:     { label: "Client",     level: 1, color: "#6B7280", equiv: "User" },
};

const DEMO_FIRMS = [
  { id: "f1", name: "Voss & Webb LLP",         subdomain: "vosswebb",    plan: "Professional", users: 12, matters: 8,  status: "active",  created: "2026-01-15" },
  { id: "f2", name: "Osei Legal Group",         subdomain: "oseilegal",   plan: "Starter",      users: 4,  matters: 3,  status: "active",  created: "2026-02-20" },
  { id: "f3", name: "Farris & Associates",      subdomain: "farrislaw",   plan: "Enterprise",   users: 28, matters: 47, status: "active",  created: "2025-11-01" },
  { id: "f4", name: "Park Counsel",             subdomain: "parkcounsel", plan: "Starter",      users: 2,  matters: 1,  status: "pending", created: "2026-03-08" },
];

const DEMO_MATTERS = [
  { id: "m1", firm: "f1", title: "Acquisition of Meridian Corp.",     type: "Corporate M&A",     status: "Active",   opened: "2026-01-20", lead: "Alexandra Voss"  },
  { id: "m2", firm: "f1", title: "IP Dispute — Patent #2048-C",       type: "IP Litigation",     status: "Active",   opened: "2026-02-01", lead: "Marcus Webb"     },
  { id: "m3", firm: "f3", title: "Employment Class Action (Santos)",  type: "Labor & Employment", status: "Review",   opened: "2025-12-10", lead: "Lin Farris"      },
  { id: "m4", firm: "f3", title: "Real Estate Closing — 44 Main St.", type: "Real Estate",        status: "Closed",   opened: "2026-01-05", lead: "Dana Osei"       },
  { id: "m5", firm: "f2", title: "Estate Planning — Tran Family",     type: "Trusts & Estates",   status: "Active",   opened: "2026-03-01", lead: "Jamie Tran"      },
];

const FIRM_PLAN_COLORS = { Enterprise: "#7C3AED", Professional: "#2563EB", Starter: "#0891B2", Pending: "#9CA3AF" };

function FirmBadge({ plan }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: (FIRM_PLAN_COLORS[plan] || "#9CA3AF") + "22", color: FIRM_PLAN_COLORS[plan] || "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase" }}>
      {plan}
    </span>
  );
}

function MatterStatus({ status }) {
  const colors = { Active: "#2D8B55", Review: "#e67e22", Closed: "#6B7280", Pending: "#3498db" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: (colors[status] || "#6B7280") + "22", color: colors[status] || "#6B7280" }}>
      {status}
    </span>
  );
}

function FirmsPage({ currentRole, token }) {
  const [view, setView]           = useState("firms");    // "firms" | "matters" | "roles"
  const [firms]                   = useState(DEMO_FIRMS);
  const [matters]                 = useState(DEMO_MATTERS);
  const [showAddFirm, setShowAddFirm] = useState(false);
  const [newFirm, setNewFirm]     = useState({ name: "", subdomain: "", plan: "Starter" });
  const [selectedFirm, setSelectedFirm] = useState(null);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>LawFirmCommons</h2>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 10, background: "#7C3AED22", color: "#7C3AED", letterSpacing: "0.06em" }}>BETA</span>
          </div>
          <p style={{ color: "#6B7B8D", marginTop: 0, fontSize: 15 }}>Law firm portal — matter management, time tracking, and client portals.</p>
        </div>
        {ROLES[currentRole]?.level >= 4 && (
          <button onClick={() => setShowAddFirm(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#7C3AED", color: "#fff", border: "none", borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            + Add Firm
          </button>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Active Firms",   value: firms.filter(f => f.status === "active").length,  icon: "⚖️" },
          { label: "Total Users",    value: firms.reduce((a, f) => a + f.users, 0),            icon: "👥" },
          { label: "Open Matters",   value: matters.filter(m => m.status === "Active").length, icon: "📁" },
          { label: "Pending Setup",  value: firms.filter(f => f.status === "pending").length,  icon: "⏳" },
        ].map(s => (
          <div key={s.label} style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: "16px 20px" }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#0B1D3A", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 13, color: "#6B7B8D", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sub-nav tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #D4CFC0" }}>
        {[["firms","Firms"],["matters","Matters"],["roles","Role Structure"],["launch","Launch Checklist"]].map(([v, l]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ padding: "8px 16px", border: "none", borderBottom: view === v ? "2px solid #C9A84C" : "2px solid transparent", background: "transparent", color: view === v ? "#0B1D3A" : "#6B7B8D", fontWeight: view === v ? 700 : 400, cursor: "pointer", fontSize: 14, marginBottom: -1, transition: "all 0.12s" }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Firms list ── */}
      {view === "firms" && (
        <div>
          <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FAF6EE", borderBottom: "1px solid #D4CFC0" }}>
                  {["Firm","Subdomain","Plan","Users","Matters","Status",""].map(h => (
                    <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 12, color: "#8B7333", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {firms.map(firm => (
                  <tr key={firm.id} style={{ borderBottom: "1px solid #F0EAD6" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#0B1D3A" }}>{firm.name}</div>
                      <div style={{ fontSize: 12, color: "#6B7B8D" }}>Added {new Date(firm.created).toLocaleDateString()}</div>
                    </td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 13, color: "#1A3668" }}>{firm.subdomain}.lawfirmcommons.com</td>
                    <td style={{ padding: "12px 16px" }}><FirmBadge plan={firm.plan} /></td>
                    <td style={{ padding: "12px 16px", fontSize: 14, color: "#1A1A2E", fontWeight: 600 }}>{firm.users}</td>
                    <td style={{ padding: "12px 16px", fontSize: 14, color: "#1A1A2E", fontWeight: 600 }}>{firm.matters}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: firm.status === "active" ? "#2D8B55" : "#e67e22" }}>
                        {firm.status === "active" ? "● Active" : "○ Pending"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <button onClick={() => setSelectedFirm(firm.id === selectedFirm ? null : firm.id)}
                        style={{ padding: "5px 12px", background: "transparent", border: "1px solid #D4CFC0", borderRadius: 5, fontSize: 13, cursor: "pointer", color: "#6B7B8D" }}>
                        {selectedFirm === firm.id ? "▲ Hide" : "▼ Details"}
                      </button>
                    </td>
                  </tr>
                ))}
                {selectedFirm && (() => {
                  const f = firms.find(x => x.id === selectedFirm);
                  const fMatters = matters.filter(m => m.firm === selectedFirm);
                  return (
                    <tr key="detail">
                      <td colSpan={7} style={{ background: "#FAF6EE", padding: "16px 20px", borderBottom: "1px solid #D4CFC0" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0B1D3A", marginBottom: 10 }}>Matters — {f?.name}</div>
                        {fMatters.length === 0
                          ? <div style={{ fontSize: 13, color: "#6B7B8D" }}>No matters yet.</div>
                          : fMatters.map(m => (
                            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #E8E0D0" }}>
                              <MatterStatus status={m.status} />
                              <span style={{ fontSize: 14, fontWeight: 600, color: "#0B1D3A", flex: 1 }}>{m.title}</span>
                              <span style={{ fontSize: 13, color: "#6B7B8D" }}>{m.type}</span>
                              <span style={{ fontSize: 12, color: "#8DA4BE" }}>Lead: {m.lead}</span>
                            </div>
                          ))
                        }
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Matters list ── */}
      {view === "matters" && (
        <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FAF6EE", borderBottom: "1px solid #D4CFC0" }}>
                {["Matter","Type","Firm","Lead Attorney","Opened","Status"].map(h => (
                  <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 12, color: "#8B7333", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matters.map(m => {
                const firm = firms.find(f => f.id === m.firm);
                return (
                  <tr key={m.id} style={{ borderBottom: "1px solid #F0EAD6" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 14, color: "#0B1D3A" }}>{m.title}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#6B7B8D" }}>{m.type}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#1A3668" }}>{firm?.name || "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#1A1A2E" }}>{m.lead}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#6B7B8D" }}>{new Date(m.opened).toLocaleDateString()}</td>
                    <td style={{ padding: "12px 16px" }}><MatterStatus status={m.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Role Structure ── */}
      {view === "roles" && (
        <div>
          <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: 24, marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: "0 0 16px 0" }}>LawFirmCommons Role Mapping</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
              {Object.entries(FIRM_ROLES).map(([key, r]) => (
                <div key={key} style={{ background: r.color + "0d", border: `1px solid ${r.color}44`, borderRadius: 8, padding: "16px 18px" }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>
                    {key === "partner" ? "⚖️" : key === "associate" ? "📋" : key === "paralegal" ? "📁" : "👤"}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: r.color, marginBottom: 4 }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: "#6B7B8D", marginBottom: 8 }}>Equivalent: {r.equiv}</div>
                  <div style={{ fontSize: 12, color: "#8DA4BE", lineHeight: 1.5 }}>
                    {key === "partner"   && "Full firm access. Billing, settings, all matters."}
                    {key === "associate" && "Manage matters and clients. No billing access."}
                    {key === "paralegal" && "View matters, draft docs, limited client contact."}
                    {key === "client"    && "View shared documents and matter status only."}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "#FAF6EE", border: "1px solid #D4CFC0", borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0B1D3A", marginBottom: 8 }}>How roles relate to the LexCommons platform</div>
            <div style={{ fontSize: 13, color: "#6B7B8D", lineHeight: 1.7 }}>
              LawFirmCommons uses the same underlying role system as LawSchoolCommons, with firm-specific terminology. The same platform codebase, authentication, and block editor power both products — only the role labels, matter/course terminology, and feature flags differ per tenant type.
            </div>
          </div>
        </div>
      )}

      {/* ── Launch Checklist ── */}
      {view === "launch" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { phase: "Phase 1", title: "Domain Setup", done: false, items: ["Register lawfirmcommons.com", "Point DNS to 45.82.72.210", "Add nginx vhost (reuse lawschoolcommons config)", "Issue SSL via Let\'s Encrypt certbot"] },
            { phase: "Phase 2", title: "Matter Management", done: false, items: ["Fork pages system → matters system", "Add matter_id, client_id, status fields to DB", "Build MatterEditor (fork of PageEditor)", "Add conflict-of-interest check on new matter"] },
            { phase: "Phase 3", title: "Billing & Time", done: false, items: ["Stripe integration (reuse LawSchoolCommons billing)", "Time tracking — built-in timer per matter", "QuickBooks export (monthly invoice generation)", "Client portal invoicing view"] },
            { phase: "Infra", title: "Tenant Provisioning", done: false, items: ["Add firm tenants to tenants table with type=firm", "Firm-specific CSS theme (dark navy → charcoal)", "Onboarding email via SES (auto-sent on firm creation)", "Usage analytics dashboard per firm"] },
          ].map(section => (
            <div key={section.phase} style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "#7C3AED22", color: "#7C3AED" }}>{section.phase}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A" }}>{section.title}</span>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {section.items.map((item, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0", fontSize: 13, color: "#4A4A6A", borderBottom: i < section.items.length - 1 ? "1px solid #F0EAD6" : "none" }}>
                    <span style={{ color: "#D4CFC0", marginTop: 2, flexShrink: 0 }}>○</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Firm Modal ── */}
      {showAddFirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#FFFFFF", borderRadius: 10, padding: 28, width: 440, boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>
            <h3 style={{ margin: "0 0 20px 0", fontSize: 17, fontWeight: 700, color: "#0B1D3A" }}>Provision New Firm</h3>
            {[["Firm Name","name","e.g. Voss & Webb LLP"],["Subdomain","subdomain","e.g. vosswebb (→ vosswebb.lawfirmcommons.com)"]].map(([label, key, ph]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0B1D3A", marginBottom: 5 }}>{label}</div>
                <input value={newFirm[key]} onChange={e => setNewFirm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={ph} style={{ width: "100%", padding: "8px 10px", border: "1px solid #D4CFC0", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0B1D3A", marginBottom: 5 }}>Plan</div>
              <select value={newFirm.plan} onChange={e => setNewFirm(p => ({ ...p, plan: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #D4CFC0", borderRadius: 6, fontSize: 14 }}>
                {["Starter","Professional","Enterprise"].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ background: "#FAF6EE", border: "1px solid #D4CFC0", borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#6B7B8D" }}>
              This will: INSERT into tenants table, CREATE SCHEMA {newFirm.subdomain || "[subdomain]"}, and send a welcome email via SES.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowAddFirm(false)} style={{ padding: "8px 16px", border: "1px solid #D4CFC0", borderRadius: 6, background: "transparent", cursor: "pointer", fontSize: 14, color: "#6B7B8D" }}>Cancel</button>
              <button onClick={() => { alert("Backend not yet wired — this will call POST /api/tenants when Sprint 4 infra is ready."); setShowAddFirm(false); }}
                style={{ padding: "8px 16px", background: "#7C3AED", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                Provision Firm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── InfraPage — Sprint 4 Infrastructure ────────────────────────────────────

const AWS_SERVICES = [
  { id: "ec2",         name: "EC2",           region: "us-west-2", detail: "i-0d6ed6b849ff4fb18 · t3.small",    status: "running",  ip: "54.214.130.86",            icon: "🖥️" },
  { id: "rds",         name: "RDS",           region: "us-west-2", detail: "lexcommons-db · db.t3.micro · PG17",status: "available",ip: "lexcommons-db.cl0o6ia04wsw.us-west-2.rds.amazonaws.com", icon: "🗄️" },
  { id: "s3",          name: "S3",            region: "us-west-2", detail: "lexcommons-uploads",                 status: "active",   ip: "s3.amazonaws.com",         icon: "📦" },
  { id: "ses",         name: "SES",           region: "us-west-2", detail: "noreply@lexcommons.org · verified",  status: "active",   ip: "email-smtp.us-west-2.amazonaws.com", icon: "📧" },
  { id: "cloudfront",  name: "CloudFront",    region: "global",    detail: "Sprint 4 — not yet provisioned",     status: "planned",  ip: "—",                        icon: "🌐" },
  { id: "acm",         name: "ACM / SSL",     region: "us-east-1", detail: "Wildcard *.lexcommons.org — Sprint 4",status: "planned",  ip: "—",                        icon: "🔒" },
  { id: "route53",     name: "Route 53",      region: "global",    detail: "DNS managed — Sprint 4 migration",   status: "planned",  ip: "—",                        icon: "🛣️" },
  { id: "vps",         name: "VPS (nginx)",   region: "EU",        detail: "45.82.72.210 · Ubuntu 24.04 · nginx 1.24", status: "running", ip: "45.82.72.210",        icon: "📡" },
];

const MIGRATION_PHASES = [
  { phase: "Phase 1", title: "DNS / Route 53",   done: false, current: false, items: ["Transfer domains to Route 53", "Create hosted zones (lexcommons.org, lawschoolcommons.com)", "Move all A records to EC2 Elastic IP 54.214.130.86", "Configure Route 53 health checks for failover"] },
  { phase: "Phase 2", title: "Web Tier / EC2",   done: false, current: true,  items: ["Option B active: VPS static + EC2 API (current setup)", "Optional: migrate /var/www to EC2 t3.small for unified infra", "rsync files, update Route 53 A record", "Retire VPS after traffic confirmed stable"] },
  { phase: "Phase 3", title: "Email (SES)",       done: true,  current: false, items: ["Domain verified in SES ✓", "Sending: noreply@lexcommons.org ✓", "Nodemailer + SES SMTP in API ✓", "Forgot-password reset emails via SES ✓"] },
  { phase: "Phase 4", title: "CDN (CloudFront)",  done: false, current: false, items: ["Create CloudFront distribution → S3 lexcommons-uploads", "Set S3_CDN_URL env var on EC2", "Media files served via CDN (faster, cheaper egress)", "Point video/audio upload URLs to CDN domain"] },
  { phase: "Phase 5", title: "SSL (ACM)",         done: false, current: false, items: ["Request wildcard *.lexcommons.org cert in ACM (free, auto-renews)", "Attach to CloudFront and ALB", "Remove certbot/Let's Encrypt from VPS", "Zero-downtime cert rotation — no manual renewal ever again"] },
];

const HIPAA_CHECKS = [
  { category: "Technical Safeguards", items: [
    { label: "HTTPS/TLS everywhere",                 done: true,  note: "All 5 domains — verified live" },
    { label: "JWT auth with expiration",             done: true,  note: "7-day tokens, invalidated on password change" },
    { label: "Role-based access controls",           done: true,  note: "4-tier RBAC enforced on every API route" },
    { label: "Activity audit log",                   done: true,  note: "activity_log table — login, save, deploy, user changes" },
    { label: "Encryption in transit",                done: true,  note: "TLS 1.2+ on all endpoints" },
    { label: "Encryption at rest (RDS)",             done: false, note: "Enable RDS encryption — requires snapshot restore to encrypted instance" },
    { label: "Field-level encryption (PII)",         done: false, note: "SSN, DOB if stored — encrypt with pg_crypto before Sprint 5" },
    { label: "Automatic session timeout (15–30 min)",done: false, note: "Add idle timeout hook to App.jsx — log activity, auto-logout" },
    { label: "Audit log: every data access",         done: false, note: "Currently logs auth + page events. Add: user read, export, download" },
  ]},
  { category: "Administrative Safeguards", items: [
    { label: "BAA with AWS signed",                  done: false, note: "Download from AWS Artifact → HIPAA BAA. Requires Business/Enterprise support." },
    { label: "BAA with SES provider",                done: false, note: "AWS SES BAA covered by AWS master BAA" },
    { label: "Workforce training documentation",     done: false, note: "Record who has access and when granted — a simple access_grants table" },
    { label: "Incident response plan",               done: false, note: "Document: who to contact, what to isolate, how to notify affected schools" },
    { label: "Access review policy",                 done: false, note: "Quarterly audit of all admin/manager accounts" },
  ]},
  { category: "What NOT to Store", items: [
    { label: "No Social Security Numbers",           done: true,  note: "Confirmed: not in schema. Financial aid via third-party processor." },
    { label: "No medical records",                   done: true,  note: "Not in scope. Refer to HIPAA-covered entity if needed." },
    { label: "No payment card data",                 done: true,  note: "Stripe handles payments — card numbers never touch our servers." },
    { label: "No raw passwords stored",              done: true,  note: "bcrypt hashing confirmed in auth route." },
  ]},
];

const BACKUP_SOURCES = [
  { id: "rds",    name: "RDS PostgreSQL",   icon: "🗄️", lastRun: "2026-03-10 02:00 UTC", status: "ok",      method: "Automated daily snapshot (7-day retention)", size: "2.4 GB",  nextRun: "2026-03-11 02:00 UTC" },
  { id: "s3",     name: "S3 Media Files",   icon: "📦", lastRun: "S3 Versioning active",  status: "ok",      method: "S3 Versioning on lexcommons-uploads bucket",  size: "18.7 GB", nextRun: "Continuous" },
  { id: "vps",    name: "VPS /var/www",     icon: "📡", lastRun: "Manual — no cron yet",  status: "warning", method: "Pending: rsync cron to S3 backup bucket",     size: "—",       nextRun: "Sprint 4" },
  { id: "pgdump", name: "Manual pg_dump",   icon: "💾", lastRun: "2026-02-28 (migration)",status: "ok",      method: "Run before major changes (schema, migrations)", size: "1.1 GB", nextRun: "Before next migration" },
];

const DEPLOY_HISTORY = [
  { id: "d9",  branch: "main",             commit: "a3f9d2e", msg: "Sprint 3: LawFirmCommons, SSO, CSV import, tenants",         by: "avoss@lexcommons.org",  at: "2026-03-10 22:14", status: "success", duration: "1m 52s" },
  { id: "d8",  branch: "main",             commit: "c2b8f1a", msg: "Sprint 2: course templates, emoji/GIF, accent color, prof scoping", by: "avoss@lexcommons.org", at: "2026-03-09 18:30", status: "success", duration: "1m 44s" },
  { id: "d7",  branch: "main",             commit: "e7d4c9b", msg: "Sprint 1: dark mode, AI chat, forgot password, account settings", by: "avoss@lexcommons.org", at: "2026-03-07 20:05", status: "success", duration: "2m 03s" },
  { id: "d6",  branch: "feature/activity", commit: "b9a3d5f", msg: "Activity log — login, save, deploy events",                  by: "avoss@lexcommons.org",  at: "2026-03-06 15:22", status: "success", duration: "1m 38s" },
  { id: "d5",  branch: "feature/media",    commit: "f4e1c8a", msg: "Video/audio/record blocks, S3 upload route 250MB",           by: "avoss@lexcommons.org",  at: "2026-03-05 11:10", status: "success", duration: "2m 17s" },
  { id: "d4",  branch: "main",             commit: "d2f7b3e", msg: "RDS migration complete — PostgreSQL live",                   by: "avoss@lexcommons.org",  at: "2026-02-28 09:45", status: "success", duration: "4m 12s" },
  { id: "d3",  branch: "feature/pg",       commit: "9c5a1d8", msg: "pg_dump backup before RDS migration",                       by: "avoss@lexcommons.org",  at: "2026-02-28 08:30", status: "success", duration: "0m 47s" },
];

function InfraPage({ currentRole, currentUser }) {
  const [tab, setTab]           = useState("aws");     // aws | hipaa | backups | cicd
  const [expanded, setExpanded] = useState(null);
  const [hipaaFilter, setHipaaFilter] = useState("all"); // all | done | pending
  const [backupLog, setBackupLog] = useState([]);
  const [triggeringBackup, setTriggeringBackup] = useState(null);

  const hipaaTotal = HIPAA_CHECKS.flatMap(c => c.items).length;
  const hipaaDone  = HIPAA_CHECKS.flatMap(c => c.items).filter(i => i.done).length;
  const hipaaScore = Math.round((hipaaDone / hipaaTotal) * 100);

  const triggerBackup = (sourceId) => {
    setTriggeringBackup(sourceId);
    setTimeout(() => {
      const src = BACKUP_SOURCES.find(s => s.id === sourceId);
      setBackupLog(prev => [
        { ts: new Date().toLocaleTimeString(), msg: `Manual backup triggered: ${src.name}`, status: "info" },
        { ts: new Date().toLocaleTimeString(), msg: `POST /api/backup/${sourceId} → 202 Accepted`, status: "info" },
        { ts: new Date().toLocaleTimeString(), msg: `Note: backend route not yet wired. Wire backup.js to index.js in Sprint 4.`, status: "warn" },
        ...prev,
      ]);
      setTriggeringBackup(null);
    }, 1200);
  };

  const tabs = [["aws","☁ AWS Services"],["hipaa","🔒 HIPAA"],["backups","💾 Backups"],["cicd","⚡ CI/CD"]];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>Infrastructure</h2>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 10, background: "#e67e2222", color: "#e67e22", letterSpacing: "0.06em" }}>SPRINT 4</span>
        </div>
        <p style={{ color: "#6B7B8D", margin: 0, fontSize: 15 }}>AWS migration, HIPAA compliance, backup automation, and CI/CD pipeline.</p>
      </div>

      {/* Summary bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "AWS Services Active", value: `${AWS_SERVICES.filter(s => s.status !== "planned").length}/${AWS_SERVICES.length}`, color: "#2D8B55", icon: "☁️" },
          { label: "HIPAA Compliance",     value: `${hipaaScore}%`, color: hipaaScore >= 70 ? "#2D8B55" : hipaaScore >= 50 ? "#e67e22" : "#B91C1C", icon: "🔒" },
          { label: "Backups OK",           value: `${BACKUP_SOURCES.filter(s => s.status === "ok").length}/${BACKUP_SOURCES.length}`, color: "#2D8B55", icon: "💾" },
          { label: "Deployments",          value: DEPLOY_HISTORY.length, color: "#3498db", icon: "🚀" },
        ].map(s => (
          <div key={s.label} style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 24 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#6B7B8D", marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #D4CFC0" }}>
        {tabs.map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{ padding: "8px 16px", border: "none", borderBottom: tab === v ? "2px solid #C9A84C" : "2px solid transparent", background: "transparent", color: tab === v ? "#0B1D3A" : "#6B7B8D", fontWeight: tab === v ? 700 : 400, cursor: "pointer", fontSize: 14, marginBottom: -1, transition: "all 0.12s" }}>
            {l}
          </button>
        ))}
      </div>

      {/* ══ AWS Services ══ */}
      {tab === "aws" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {AWS_SERVICES.map(svc => (
              <div key={svc.id}
                style={{ background: "#FFFFFF", border: `1px solid ${svc.status === "planned" ? "#D4CFC0" : svc.status === "running" || svc.status === "available" || svc.status === "active" ? "#2D8B5540" : "#D4CFC0"}`, borderRadius: 8, padding: "16px 18px", cursor: "pointer", transition: "border-color 0.15s" }}
                onClick={() => setExpanded(expanded === svc.id ? null : svc.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}>{svc.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A" }}>{svc.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                        background: svc.status === "planned" ? "#8DA4BE22" : "#2D8B5522",
                        color:      svc.status === "planned" ? "#8DA4BE"   : "#2D8B55",
                      }}>{svc.status === "planned" ? "Planned" : "● Live"}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7B8D", marginTop: 2 }}>{svc.detail}</div>
                  </div>
                  <span style={{ fontSize: 12, color: "#C9A84C" }}>{expanded === svc.id ? "▲" : "▼"}</span>
                </div>
                {expanded === svc.id && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #F0EAD6" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div><div style={{ fontSize: 11, color: "#8DA4BE", textTransform: "uppercase", letterSpacing: "0.06em" }}>Region</div><div style={{ fontSize: 13, color: "#1A1A2E", fontWeight: 600 }}>{svc.region}</div></div>
                      <div><div style={{ fontSize: 11, color: "#8DA4BE", textTransform: "uppercase", letterSpacing: "0.06em" }}>Endpoint / IP</div><div style={{ fontSize: 12, color: "#1A3668", fontFamily: "monospace", wordBreak: "break-all" }}>{svc.ip}</div></div>
                    </div>
                    {svc.status === "planned" && (
                      <div style={{ marginTop: 10, padding: "8px 12px", background: "#FEF3C7", border: "1px solid #e67e2230", borderRadius: 6, fontSize: 12, color: "#92400E" }}>
                        ⏳ Planned for Sprint 4 — see CI/CD tab for full setup commands.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Migration phases */}
          <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: "0 0 16px 0" }}>AWS Migration Progress</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {MIGRATION_PHASES.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700,
                    background: p.done ? "#2D8B55" : p.current ? "#C9A84C" : "#E8E0D0",
                    color:      p.done ? "#fff"    : p.current ? "#fff"    : "#8DA4BE" }}>
                    {p.done ? "✓" : i+1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#0B1D3A" }}>{p.phase}: {p.title}</span>
                      {p.done    && <span style={{ fontSize: 11, color: "#2D8B55", fontWeight: 700 }}>✓ Complete</span>}
                      {p.current && !p.done && <span style={{ fontSize: 11, color: "#C9A84C", fontWeight: 700 }}>← Current</span>}
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {p.items.map((item, j) => (
                        <li key={j} style={{ fontSize: 13, color: "#6B7B8D", padding: "2px 0", display: "flex", alignItems: "flex-start", gap: 6 }}>
                          <span style={{ color: p.done ? "#2D8B55" : "#D4CFC0", marginTop: 2, flexShrink: 0 }}>{p.done ? "✓" : "○"}</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ HIPAA Compliance ══ */}
      {tab === "hipaa" && (
        <div>
          {/* Score card */}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, marginBottom: 20, background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: "20px 24px", alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto" }}>
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#E8E0D0" strokeWidth="8" />
                  <circle cx="40" cy="40" r="34" fill="none"
                    stroke={hipaaScore >= 70 ? "#2D8B55" : hipaaScore >= 50 ? "#e67e22" : "#B91C1C"}
                    strokeWidth="8" strokeDasharray={`${hipaaScore * 2.136} 213.6`}
                    strokeLinecap="round" transform="rotate(-90 40 40)" />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#0B1D3A" }}>{hipaaScore}%</span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#6B7B8D", marginTop: 6 }}>{hipaaDone}/{hipaaTotal} controls</div>
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#0B1D3A", marginBottom: 4 }}>HIPAA-Level Compliance Status</div>
              <div style={{ fontSize: 13, color: "#6B7B8D", marginBottom: 12, lineHeight: 1.6 }}>
                FERPA is the floor. These controls bring LexCommons to HIPAA-aligned standards — a strong differentiator for law schools handling sensitive student data.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[["all","All"],["done","Done"],["pending","Pending"]].map(([v,l]) => (
                  <button key={v} onClick={() => setHipaaFilter(v)}
                    style={{ padding: "5px 12px", border: `1px solid ${hipaaFilter === v ? "#C9A84C" : "#D4CFC0"}`, borderRadius: 20, background: hipaaFilter === v ? "#C9A84C" : "transparent", color: hipaaFilter === v ? "#fff" : "#6B7B8D", fontSize: 13, cursor: "pointer", fontWeight: hipaaFilter === v ? 700 : 400 }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Checklist */}
          {HIPAA_CHECKS.map(cat => {
            const items = cat.items.filter(item => hipaaFilter === "all" || (hipaaFilter === "done" ? item.done : !item.done));
            if (!items.length) return null;
            return (
              <div key={cat.category} style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: 20, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>{cat.category}</h3>
                  <span style={{ fontSize: 12, color: "#8DA4BE" }}>{cat.items.filter(i => i.done).length}/{cat.items.length} done</span>
                </div>
                {items.map(item => (
                  <div key={item.label} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "9px 0", borderBottom: "1px solid #F0EAD6" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
                      background: item.done ? "#2D8B55" : "#E8E0D0", border: `1px solid ${item.done ? "#2D8B55" : "#C9A84C"}` }}>
                      {item.done && <span style={{ color: "#fff", fontSize: 12, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: item.done ? 500 : 600, color: item.done ? "#6B7B8D" : "#0B1D3A", marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: "#8DA4BE", lineHeight: 1.5 }}>{item.note}</div>
                    </div>
                    {!item.done && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "#e67e2222", color: "#e67e22", flexShrink: 0 }}>TODO</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ Backups ══ */}
      {tab === "backups" && (
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            {BACKUP_SOURCES.map(src => (
              <div key={src.id} style={{ background: "#FFFFFF", border: `1px solid ${src.status === "warning" ? "#e67e2240" : "#D4CFC0"}`, borderRadius: 8, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 28 }}>{src.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A" }}>{src.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                        background: src.status === "ok" ? "#2D8B5522" : "#e67e2222",
                        color:      src.status === "ok" ? "#2D8B55"   : "#e67e22" }}>
                        {src.status === "ok" ? "✓ OK" : "⚠ Needs Setup"}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#6B7B8D" }}>{src.method}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "#8DA4BE" }}>Last: {src.lastRun}</div>
                    <div style={{ fontSize: 12, color: "#8DA4BE" }}>Next: {src.nextRun}</div>
                    {src.size !== "—" && <div style={{ fontSize: 13, fontWeight: 700, color: "#0B1D3A", marginTop: 2 }}>{src.size}</div>}
                  </div>
                  <button
                    onClick={() => triggerBackup(src.id)}
                    disabled={!!triggeringBackup}
                    style={{ marginLeft: 12, padding: "7px 14px", background: triggeringBackup === src.id ? "#8a7035" : "transparent", border: "1px solid #C9A84C", borderRadius: 6, color: triggeringBackup === src.id ? "#fff" : "#C9A84C", fontSize: 13, cursor: triggeringBackup ? "not-allowed" : "pointer", fontWeight: 600, flexShrink: 0 }}>
                    {triggeringBackup === src.id ? "Running…" : "↻ Run Now"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Manual pg_dump command */}
          <div style={{ background: "#0B1D3A", borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#C9A84C", marginBottom: 12 }}>Manual pg_dump — run before any major migration:</div>
            <pre style={{ margin: 0, fontSize: 12, color: "#8DA4BE", fontFamily: "monospace", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{`pg_dump -h lexcommons-db.cl0o6ia04wsw.us-west-2.rds.amazonaws.com \
  -U postgres -d lexcommons \
  > backup_$(date +%Y%m%d_%H%M).sql`}</pre>
          </div>

          {/* VPS rsync cron */}
          <div style={{ background: "#0B1D3A", borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#C9A84C", marginBottom: 12 }}>Daily cron — rsync VPS /var/www → S3 (add to crontab on VPS):</div>
            <pre style={{ margin: 0, fontSize: 12, color: "#8DA4BE", fontFamily: "monospace", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{`# crontab -e on VPS 45.82.72.210
0 3 * * * aws s3 sync /var/www s3://lexcommons-backups/vps-www/$(date +\%Y-\%m-\%d)/ \
  --delete --storage-class STANDARD_IA`}</pre>
          </div>

          {/* Backup log */}
          {backupLog.length > 0 && (
            <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0B1D3A", marginBottom: 10 }}>Backup Log (this session)</div>
              {backupLog.map((entry, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "5px 0", borderBottom: i < backupLog.length - 1 ? "1px solid #F0EAD6" : "none", fontSize: 13 }}>
                  <span style={{ color: "#8DA4BE", fontFamily: "monospace", flexShrink: 0 }}>{entry.ts}</span>
                  <span style={{ color: entry.status === "warn" ? "#e67e22" : "#4A4A6A" }}>{entry.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ CI/CD Pipeline ══ */}
      {tab === "cicd" && (
        <div>
          {/* Pipeline visual */}
          <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: "0 0 16px 0" }}>Git-First CI/CD Pipeline</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
              {[
                { icon: "💻", label: "Local Edit", sub: "~/Desktop/lexcommons-ops" },
                { icon: "→", label: "", sub: "" },
                { icon: "🔀", label: "Git Push", sub: "feature/* → PR → main" },
                { icon: "→", label: "", sub: "" },
                { icon: "⚡", label: "GitHub Actions", sub: ".github/workflows/deploy.yml" },
                { icon: "→", label: "", sub: "" },
                { icon: "🖥️", label: "EC2 SSH", sub: "git pull → pm2 restart" },
                { icon: "→", label: "", sub: "" },
                { icon: "📡", label: "VPS rsync", sub: "dist/ → /var/www/ops" },
              ].map((step, i) => (
                <div key={i} style={{ textAlign: "center", flexShrink: 0, padding: step.icon === "→" ? "0 4px" : "0 10px" }}>
                  {step.icon === "→"
                    ? <span style={{ fontSize: 20, color: "#C9A84C" }}>→</span>
                    : (<div style={{ background: "#FAF6EE", border: "1px solid #D4CFC0", borderRadius: 8, padding: "10px 14px", minWidth: 100 }}>
                        <div style={{ fontSize: 22, marginBottom: 4 }}>{step.icon}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0B1D3A" }}>{step.label}</div>
                        <div style={{ fontSize: 11, color: "#8DA4BE", fontFamily: "monospace", marginTop: 2 }}>{step.sub}</div>
                      </div>)
                  }
                </div>
              ))}
            </div>
          </div>

          {/* Deploy history */}
          <div style={{ background: "#FFFFFF", border: "1px solid #D4CFC0", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #D4CFC0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1D3A", margin: 0 }}>Deploy History</h3>
              <button
                onClick={() => alert("GitHub Actions not yet wired. Deploy command: cp ~/Downloads/lexcommons-admin.jsx ~/Desktop/lexcommons-ops/src/App.jsx && cd ~/Desktop/lexcommons-ops && npm run build && rsync -avz --delete dist/ root@45.82.72.210:/var/www/ops/")}
                style={{ padding: "7px 14px", background: "#C9A84C", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                🚀 Trigger Deploy
              </button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FAF6EE", borderBottom: "1px solid #D4CFC0" }}>
                  {["Commit","Branch","Message","Deployed by","Time","Duration","Status"].map(h => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, color: "#8B7333", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEPLOY_HISTORY.map((d, i) => (
                  <tr key={d.id} style={{ borderBottom: i < DEPLOY_HISTORY.length - 1 ? "1px solid #F0EAD6" : "none", background: i === 0 ? "#FAF6EE" : "transparent" }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12, color: "#1A3668" }}>{d.commit}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 12, background: d.branch === "main" ? "#C9A84C22" : "#3498db22", color: d.branch === "main" ? "#8B7333" : "#2563EB", padding: "2px 7px", borderRadius: 4, fontFamily: "monospace" }}>{d.branch}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "#0B1D3A", fontWeight: i === 0 ? 600 : 400, maxWidth: 260 }}>{d.msg}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7B8D" }}>{d.by.split("@")[0]}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7B8D", whiteSpace: "nowrap" }}>{d.at}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#8DA4BE" }}>{d.duration}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#2D8B55" }}>✓ success</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* GitHub Actions yaml preview */}
          <div style={{ background: "#0B1D3A", borderRadius: 8, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#C9A84C" }}>.github/workflows/deploy.yml  (see deploy.yml download)</div>
              <span style={{ fontSize: 11, color: "#8DA4BE", fontFamily: "monospace" }}>Triggers on push to main</span>
            </div>
            <pre style={{ margin: 0, fontSize: 11, color: "#8DA4BE", fontFamily: "monospace", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{`name: Deploy LexCommons
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build frontend
        run: cd lexcommons-ops && npm ci && npm run build
      - name: rsync to VPS
        uses: burnett01/rsync-deployments@7.0.1
        with:
          switches: -avz --delete
          path: lexcommons-ops/dist/
          remote_path: /var/www/ops/
          remote_host: 45.82.72.210
          remote_user: root
          remote_key: \${{ secrets.VPS_SSH_KEY }}
      - name: Deploy API to EC2
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: 54.214.130.86
          username: ubuntu
          key: \${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /var/www/lexcommons-api
            git pull origin main
            npm ci --omit=dev
            pm2 restart lexcommons-api --update-env`}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", minLevel: 1 },
  { id: "sites",     label: "Sites",     icon: "sites",     minLevel: 3 },
  { id: "pages",     label: "Pages",     icon: "pages",     minLevel: 2 },
  { id: "users",     label: "Users",     icon: "users",     minLevel: 2 },
  { id: "templates", label: "Templates", icon: "pages",     minLevel: 2 },
  { id: "firms",     label: "Firms",     icon: "users",     minLevel: 4 },
  { id: "infra",     label: "Infra",     icon: "shield",    minLevel: 4 },
  { id: "settings",  label: "Settings",  icon: "settings",  minLevel: 3 },
];

export default function App() {
  // ── Preferences (dark mode, font) ─────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("lc_dark") === "1");
  const [dyslexieFont, setDyslexieFont] = useState(() => localStorage.getItem("lc_dyslexie") === "1");
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem("lc_accent") || "#C9A84C");

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("lc_dark", next ? "1" : "0");
  };
  const toggleDyslexie = () => {
    const next = !dyslexieFont;
    setDyslexieFont(next);
    localStorage.setItem("lc_dyslexie", next ? "1" : "0");
  };
  const changeAccent = async (color) => {
    setAccentColor(color);
    localStorage.setItem("lc_accent", color);
    // Persist to DB so color syncs across devices
    try {
      const u = JSON.parse(localStorage.getItem("lc_user") || "{}");
      if (u.id && u.token) {
        await fetch("https://api.lexcommons.org/api/users/" + u.id + "/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + u.token },
          body: JSON.stringify({ accent_color: color })
        });
      }
    } catch(e) { /* silent fail — localStorage still works */ }
  };

  // Inject CSS variables for dark mode + accent color

  // Top-level SSO interceptor: handles ?sso_token= from AppSwitcher cross-app links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("sso_token");
    if (!token) return;
    try {
      const b64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      const p = JSON.parse(atob(b64));
      const ROLES = {4:'administrator',3:'manager',2:'faculty',1:'user'};
      const user = { id:p.id, name:((p.firstName||'')+' '+(p.lastName||'')).trim()||p.email,
        email:p.email, role:ROLES[p.role]||'user', token, lastLogin:new Date().toISOString().slice(0,10), site:'all', active:true };
      localStorage.setItem('lc_user', JSON.stringify(user));
      window.history.replaceState({}, '', window.location.pathname);
      window.location.reload();
    } catch(e) { console.error('SSO intercept failed:', e); }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.style.setProperty("--lc-bg",        "#0f1923");
      root.style.setProperty("--lc-surface",   "#1a2535");
      root.style.setProperty("--lc-surface2",  "#21304a");
      root.style.setProperty("--lc-border",    "#2a3a52");
      root.style.setProperty("--lc-text",      "#E8E4DC");
      root.style.setProperty("--lc-muted",     "#8DA4BE");
      root.style.setProperty("--lc-sidebar",   "#080f18");
    } else {
      root.style.setProperty("--lc-bg",        "#FAF6EE");
      root.style.setProperty("--lc-surface",   "#FFFFFF");
      root.style.setProperty("--lc-surface2",  "#F5F0E8");
      root.style.setProperty("--lc-border",    "#D4CFC0");
      root.style.setProperty("--lc-text",      "#1A1A2E");
      root.style.setProperty("--lc-muted",     "#6B7B8D");
      root.style.setProperty("--lc-sidebar",   "#0B1D3A");
    }
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.style.setProperty("--lc-accent", accentColor);
    // Also derive a subtle tint for backgrounds
    document.documentElement.style.setProperty("--lc-accent-10", accentColor + "1a");
    document.documentElement.style.setProperty("--lc-accent-30", accentColor + "4d");
  }, [accentColor]);

  // Load OpenDyslexie font + apply
  useEffect(() => {
    let link = document.getElementById("lc-dyslexie-font");
    if (dyslexieFont && !link) {
      link = document.createElement("link");
      link.id = "lc-dyslexie-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.cdnfonts.com/css/opendyslexic";
      document.head.appendChild(link);
    }
    document.body.style.fontFamily = dyslexieFont
      ? "'OpenDyslexic', 'OpenDyslexic3', sans-serif"
      : "";
  }, [dyslexieFont]);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@400;600;700&display=swap';
    document.head.appendChild(link);
  }, []);
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lc_user") || "null"); } catch { return null; }
  });

  const login = (u) => {
    localStorage.setItem("lc_user", JSON.stringify(u));
    setCurrentUser(u);
    setPage("dashboard");
  };

  const logout = () => {
    localStorage.removeItem("lc_user");
    setCurrentUser(null);
  };

  // SSO token handler - picks up ?sso_token= after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get("sso_token");
    if (!ssoToken) return;
    try {
      const payload = JSON.parse(atob(ssoToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      const ROLE_MAP_SSO = { 4: "administrator", 3: "manager", 2: "faculty", 1: "user" };
      const u = {
        id:        payload.id,
        name:      ((payload.firstName || "") + " " + (payload.lastName || "")).trim() || payload.email,
        email:     payload.email,
        role:      ROLE_MAP_SSO[payload.role] || "user",
        token:     ssoToken,
        lastLogin: new Date().toISOString().slice(0, 10),
        site:      "all",
        active:    true,
      };
      localStorage.setItem("lc_user", JSON.stringify(u));
      setCurrentUser(u);
      window.history.replaceState({}, "", window.location.pathname);
    } catch (err) {
      console.error("SSO token parse failed:", err);
    }
  }, []);
  const [page, setPage] = useState("dashboard");
  const [showHelp, setShowHelp] = useState(false);
  const gPressed = useRef(false);
  const gTimer   = useRef(null);

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const NAV_KEYS = { d: "dashboard", s: "sites", p: "pages", u: "users", i: "infra", f: "firms", t: "settings", c: "templates" };
    const onKey = (e) => {
      if (!currentUser) return; // not logged in — do nothing
      const inInput = ["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName) || e.target.isContentEditable;
      if (inInput || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") { e.preventDefault(); setShowHelp(v => !v); return; }
      if (e.key === "Escape") { setShowHelp(false); return; }
      if (e.key.toLowerCase() === "g") {
        e.preventDefault();
        gPressed.current = true;
        clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => { gPressed.current = false; }, 1000);
        return;
      }
      if (gPressed.current) {
        const dest = NAV_KEYS[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          gPressed.current = false;
          clearTimeout(gTimer.current);
          const visNav = NAV.filter(n => ROLES[currentUser.role]?.level >= n.minLevel);
          if (visNav.find(n => n.id === dest)) setPage(dest);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(gTimer.current); };
  }, [currentUser]);
const resetToken = new URLSearchParams(window.location.search).get("token");
  if (resetToken) return <ResetPasswordScreen token={resetToken} darkMode={darkMode} onDone={() => window.history.replaceState({}, '', '/app')} />;

  if (!currentUser) return <LoginScreen onLogin={login} darkMode={darkMode} />;

  const role = currentUser.role;
  const visibleNav = NAV.filter(n => ROLES[role]?.level >= n.minLevel);

  // Bounce to dashboard if current page isn't accessible for this role
  const pageAllowed = visibleNav.find(n => n.id === page);
  if (!pageAllowed && page !== "dashboard" && page !== "account" && page !== "firms") {
    setPage("dashboard");
  }


  return (
    <div style={{ display: "flex", minHeight: "100vh", background: darkMode ? "#0f1923" : "#F0EBE0", fontFamily: dyslexieFont ? "'OpenDyslexic', sans-serif" : "Source Sans 3, Segoe UI, sans-serif", color: darkMode ? "#E8E4DC" : "#1A1A2E" }}>

      {/* Sidebar */}
      <div style={{ width: 220, background: "#0B1D3A", borderRight: "1px solid #1e2432", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: "20px 18px 18px", borderBottom: "1px solid #1e2432" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 30, height: 30, background: "#C9A84C", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="shield" size={15} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.02em" }}>LexCommons</div>
              <div style={{ fontSize: 12, color: "#6B7B8D" }}>Admin Network</div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <AppSwitcher role={role} />
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "12px 10px", flex: 1 }}>
          {visibleNav.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", background: page === n.id ? "rgba(201,168,76,0.15)" : "transparent",
                border: "none", borderRadius: 6, color: page === n.id ? "#FFFFFF" : "#C4D0DE", cursor: "pointer",
                fontSize: 15, fontWeight: page === n.id ? 600 : 400, marginBottom: 2, textAlign: "left", transition: "all 0.15s" }}>
              <Icon name={n.icon} size={15} />
              {n.label}
              {page === n.id && <span style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", background: "#C9A84C" }} />}
            </button>
          ))}
        </nav>

        {/* User info */}
        <div style={{ padding: "14px 14px", borderTop: "1px solid #1e2432" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: ROLES[role]?.color + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: ROLES[role]?.color, flexShrink: 0 }}>
              {currentUser.name.split(" ").map(n => n[0]).join("").slice(0,2)}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUser.name}</div>
              <RoleBadge role={role} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
          <button onClick={() => setPage("account")}
            style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "7px 10px", background: page === "account" ? "rgba(201,168,76,0.15)" : "transparent", border: "1px solid #252c3a", borderRadius: 5, color: "#C9A84C", cursor: "pointer", fontSize: 13 }}>
            ⚙ Account & Preferences
          </button>
          <div style={{ display: "flex", gap: 6 }}>
          <button onClick={logout}
            style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, padding: "7px 10px", background: "#EDE7D4", border: "1px solid #252c3a", borderRadius: 5, color: "#C9A84C", cursor: "pointer", fontSize: 14 }}>
            <Icon name="logout" size={13} /> Sign Out
          </button>
          <button onClick={() => setShowHelp(true)} title="Keyboard shortcuts (?)"
            style={{ padding: "7px 9px", background: "transparent", border: "1px solid #252c3a", borderRadius: 5, color: "#6B7B8D", cursor: "pointer", fontSize: 13, fontWeight: 700, lineHeight: 1 }}>
            ?
          </button>
          </div>
          </div>
        </div>
      </div>

      {/* Shortcuts help modal */}
      {showHelp && (
        <div onClick={() => setShowHelp(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#0B1D3A", border: "1px solid #252c3a", borderRadius: 10, padding: "24px 28px", width: 420, maxWidth: "90vw", color: "#C4D0DE", fontFamily: "Source Sans 3, sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF" }}>Keyboard Shortcuts</div>
              <button onClick={() => setShowHelp(false)} style={{ background: "none", border: "none", color: "#6B7B8D", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>✕</button>
            </div>
            {[
              { group: "Navigation" },
              { key: "G → D", desc: "Go to Dashboard" },
              { key: "G → S", desc: "Go to Sites" },
              { key: "G → P", desc: "Go to Pages" },
              { key: "G → U", desc: "Go to Users" },
              { key: "G → T", desc: "Go to Settings" },
              { key: "?", desc: "Toggle this help panel" },
              { group: "Page Editor" },
              { key: "⌘S / Ctrl+S", desc: "Save page" },
              { key: "Esc", desc: "Back to Pages" },
              { key: "Del / ⌫", desc: "Delete selected block" },
              { key: "[", desc: "Move block up" },
              { key: "]", desc: "Move block down" },
            ].map((row, i) => row.group ? (
              <div key={i} style={{ fontSize: 11, color: "#8DA4BE", textTransform: "uppercase", letterSpacing: "0.09em", marginTop: i > 0 ? 16 : 0, marginBottom: 8 }}>{row.group}</div>
            ) : (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #1e2432" }}>
                <span style={{ fontSize: 14, color: "#C4D0DE" }}>{row.desc}</span>
                <kbd style={{ background: "#1e2838", border: "1px solid #3a4a5c", borderRadius: 4, padding: "2px 8px", fontSize: 12, color: "#C9A84C", fontFamily: "monospace", whiteSpace: "nowrap" }}>{row.key}</kbd>
              </div>
            ))}
            <div style={{ marginTop: 16, fontSize: 12, color: "#6B7B8D", textAlign: "center" }}>Press <kbd style={{ background: "#1e2838", border: "1px solid #3a4a5c", borderRadius: 3, padding: "1px 5px", fontSize: 11, color: "#C9A84C" }}>?</kbd> or <kbd style={{ background: "#1e2838", border: "1px solid #3a4a5c", borderRadius: 3, padding: "1px 5px", fontSize: 11, color: "#C9A84C" }}>Esc</kbd> to close</div>
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, overflow: "auto", background: darkMode ? "#0f1923" : "#F0EBE0" }}>
        <div style={{ padding: "28px 32px", maxWidth: 1100 }}>
          {page === "dashboard" && <Dashboard currentUser={currentUser} />}
          {page === "sites"     && <SitesPage currentRole={role} />}
          {page === "pages"     && <PagesPage currentRole={role} token={currentUser.token} currentUser={currentUser} />}
          {page === "users"     && can(role, "viewUsers") && <UsersPage currentRole={role} token={currentUser.token} currentUser={currentUser} />}
          {page === "settings"  && <SettingsPage currentRole={role} currentUser={currentUser} darkMode={darkMode} toggleDark={toggleDark} dyslexieFont={dyslexieFont} toggleDyslexie={toggleDyslexie} accentColor={accentColor} changeAccent={changeAccent} />}
          {page === "firms"     && ROLES[role]?.level >= 4 && <FirmsPage currentRole={role} token={currentUser.token} />}
          {page === "infra"     && ROLES[role]?.level >= 4 && <InfraPage currentRole={role} currentUser={currentUser} />}
          {page === "templates" && <TemplateLibrary onForkSuccess={() => setPage("pages")} /> }
          {page === "account"   && <AccountSettingsPage currentUser={currentUser} token={currentUser.token} darkMode={darkMode} toggleDark={toggleDark} dyslexieFont={dyslexieFont} toggleDyslexie={toggleDyslexie} accentColor={accentColor} changeAccent={changeAccent} />}
        </div>
      </div>
      <AIChatWidget token={currentUser.token} currentUser={currentUser} darkMode={darkMode} />
    </div>
  );
}
