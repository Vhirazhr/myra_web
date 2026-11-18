import { FormEvent, ReactNode, useMemo, useState } from "react";

type IconName =
  | "grid"
  | "chart"
  | "spark"
  | "users"
  | "plus"
  | "brain"
  | "image"
  | "mic"
  | "globe"
  | "book"
  | "clock"
  | "map"
  | "share"
  | "heart"
  | "group"
  | "message"
  | "calendar"
  | "activity"
  | "smile"
  | "play"
  | "bell"
  | "phone"
  | "settings"
  | "database"
  | "shield"
  | "search"
  | "sun"
  | "moon"
  | "chevron"
  | "more"
  | "check"
  | "x"
  | "arrow"
  | "eye"
  | "edit"
  | "copy"
  | "trash";

const paths: Record<IconName, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-7" />
      <path d="M22 19H2" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3-1.2 4.8L6 9l4.8 1.2L12 15l1.2-4.8L18 9l-4.8-1.2L12 3Z" />
      <path d="m5 16-.6 2.4L2 19l2.4.6L5 22l.6-2.4L8 19l-2.4-.6L5 16Z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <path d="M16 4a4 4 0 0 1 0 8" />
      <path d="M18 15a6 6 0 0 1 4 6" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  brain: (
    <>
      <path d="M9.5 4.5A3 3 0 0 0 5 7a3 3 0 0 0-1 5.5A3.5 3.5 0 0 0 7.5 18H9" />
      <path d="M14.5 4.5A3 3 0 0 1 19 7a3 3 0 0 1 1 5.5 3.5 3.5 0 0 1-3.5 5.5H15" />
      <path d="M12 3v18M8 9h4M12 14h4" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 15-4-4L6 20" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a3 3 0 0 1 3-2h5v17H7a3 3 0 0 0-3 2V5Z" />
      <path d="M20 5a3 3 0 0 0-3-2h-5v17h5a3 3 0 0 1 3 2V5Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
      <path d="M9 3v15M15 6v15" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4" />
    </>
  ),
  heart: (
    <>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    </>
  ),
  group: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="8" r="3" />
      <path d="M2 20v-2a5 5 0 0 1 10 0v2M12 18a5 5 0 0 1 10 0v2" />
    </>
  ),
  message: (
    <>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  activity: (
    <>
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8 6 4-6 4V8Z" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  phone: (
    <>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  arrow: <path d="m5 12 5 5L20 7" />,
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5" />
    </>
  ),
};
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

const nav = [
  {
    section: "Overview",
    items: [
      ["Dashboard", "grid", "dashboard"],
      ["Analytics", "chart", "analytics"],
      ["AI Usage & Costs", "spark", "usage"],
    ],
  },
  {
    section: "Character Studio",
    items: [
      ["All Characters", "users", "characters"],
      ["Create Character", "plus", "character-new"],
      ["Personality Lab", "brain", "personality"],
      ["Appearance Studio", "image", "appearance"],
      ["Voice Studio", "mic", "voice"],
    ],
  },
  {
    section: "Universe Studio",
    items: [
      ["All Universes", "globe", "universes"],
      ["Create Universe", "plus", "universe-new"],
      ["Lore Manager", "book", "lore"],
      ["Timeline Editor", "clock", "timeline"],
      ["Location Manager", "map", "locations"],
      ["Crossover Studio", "share", "crossover"],
    ],
  },
  {
    section: "Social System",
    items: [
      ["Social Graph", "share", "social"],
      ["Friends & Relationships", "heart", "relationships"],
      ["Group Manager", "group", "groups"],
      ["Character Interactions", "message", "interactions"],
    ],
  },
  {
    section: "Life Simulation",
    items: [
      ["Daily Schedules", "calendar", "schedules"],
      ["Character Activities", "activity", "activities"],
      ["Emotional State", "smile", "emotions"],
      ["Event Scheduler", "clock", "events"],
      ["Life Simulation Settings", "settings", "simulation"],
    ],
  },
  {
    section: "Stories & Media",
    items: [
      ["Story Studio", "play", "stories"],
      ["Story Scheduler", "calendar", "story-scheduler"],
      ["Media Library", "image", "media"],
      ["Gallery Manager", "image", "gallery"],
    ],
  },
  {
    section: "AI Engine",
    items: [
      ["AI Providers", "spark", "providers"],
      ["Model Configuration", "settings", "models"],
      ["Memory Engine", "brain", "memory"],
      ["Language Engine", "globe", "language"],
      ["Response Behavior", "message", "response"],
      ["Context Management", "database", "context"],
    ],
  },
  {
    section: "Communication",
    items: [
      ["Notification Manager", "bell", "notifications"],
      ["Proactive Messaging", "message", "proactive"],
      ["Voice Call Configuration", "phone", "calls"],
      ["Voice Note Configuration", "mic", "voice-notes"],
    ],
  },
  {
    section: "System",
    items: [
      ["Conversation Logs", "message", "logs"],
      ["Storage Manager", "database", "storage"],
      ["Backup & Restore", "database", "backup"],
      ["Security", "shield", "security"],
      ["Environment Settings", "settings", "environment"],
    ],
  },
] as const;

const photos = [
  "https://images.unsplash.com/photo-1668608380298-00f7fbb572d3?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1653256170871-d0a26c41f49c?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1509650695346-96796d06faf7?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1618554881966-5d56ae909c12?auto=format&fit=crop&w=200&q=80",
];
const characters = [
  {
    name: "Elara Voss",
    meta: "She / Her · 24",
    universe: "Neon Meridian",
    relation: "Companion",
    status: "Active now",
    tags: ["Protective", "Playful"],
    image: photos[0],
  },
  {
    name: "Sora Akiyama",
    meta: "She / Her · 22",
    universe: "Aether Bloom",
    relation: "Best friend",
    status: "8 min ago",
    tags: ["Shy", "Romantic"],
    image: photos[1],
  },
  {
    name: "Kael Rowan",
    meta: "He / Him · 27",
    universe: "Ashen Crown",
    relation: "Rival",
    status: "34 min ago",
    tags: ["Confident", "Cold"],
    image: photos[2],
  },
  {
    name: "Mira Sol",
    meta: "She / Her · 25",
    universe: "Neon Meridian",
    relation: "Crush",
    status: "1 hr ago",
    tags: ["Funny", "Extrovert"],
    image: photos[3],
  },
];
const pageTitle: Record<string, [string, string]> = {
  analytics: ["Analytics", "Explore platform engagement, retention, and growth."],
  usage: ["AI Usage & Costs", "Monitor token consumption and estimated provider spend."],
  appearance: ["Appearance Studio", "Build and manage visual identities for every character."],
  lore: ["Lore Manager", "Keep canon, world history, and biographies consistent."],
  locations: ["Location Manager", "Organize worlds, scenes, and important places."],
  crossover: ["Crossover Studio", "Bring universes together without mixing their core memories."],
  relationships: ["Friends & Relationships", "Shape trust, familiarity, and shared histories."],
  interactions: ["Character Interactions", "Review and guide autonomous social behavior."],
  schedules: ["Daily Schedules", "Plan work, rest, meals, and meaningful social time."],
  activities: ["Character Activities", "Track what everyone is doing across every world."],
  emotions: ["Emotional State", "Understand moods, triggers, and behavioral consequences."],
  events: ["Event Scheduler", "Create milestones, occasions, and randomized world events."],
  simulation: ["Life Simulation Settings", "Tune the heartbeat of your autonomous worlds."],
  ["story-scheduler"]: ["Story Scheduler", "Plan autonomous publishing and approval flows."],
  media: ["Media Library", "Manage generated images, videos, and audio."],
  gallery: ["Gallery Manager", "Curate collections shown throughout the companion app."],
  models: ["Model Configuration", "Choose models by capability and workload."],
  memory: ["Memory Engine", "Control how experiences are stored, retrieved, and summarized."],
  language: ["Language Engine", "Configure multilingual conversation and learning."],
  response: ["Response Behavior", "Tune creativity, style, and personality consistency."],
  context: ["Context Management", "Allocate context windows across memories and lore."],
  proactive: ["Proactive Messaging", "Configure when characters initiate conversation."],
  calls: ["Voice Call Configuration", "Tune prototype voice-call behavior and limits."],
  ["voice-notes"]: ["Voice Note Configuration", "Manage voice note generation and delivery."],
  logs: ["Conversation Logs", "Review message activity and moderation signals."],
  storage: ["Storage Manager", "Monitor media, conversation, and memory storage."],
  backup: ["Backup & Restore", "Protect and transfer your control center configuration."],
  security: ["Security", "Manage sessions, admin access, and masked credentials."],
  environment: ["Environment Settings", "Review prototype service and integration settings."],
};

function Button({
  children,
  icon,
  secondary = false,
  onClick,
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  icon?: IconName;
  secondary?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`btn ${secondary ? "btn-secondary" : ""}`}
    >
      {icon && <Icon name={icon} size={16} />} {children}
    </button>
  );
}
function Badge({
  children,
  tone = "pink",
}: {
  children: ReactNode;
  tone?: "pink" | "green" | "gold" | "gray";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}
function Toggle({ on, setOn }: { on: boolean; setOn: (v: boolean) => void }) {
  return (
    <button
      aria-label="Toggle setting"
      onClick={() => setOn(!on)}
      className={`toggle ${on ? "on" : ""}`}
    >
      <span />
    </button>
  );
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("admin@companion.ai"),
    [pass, setPass] = useState("controlcenter"),
    [show, setShow] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@") || pass.length < 6) {
      setError("Enter a valid email and a password with at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    setTimeout(onLogin, 800);
  }
  return (
    <main className="login">
      <div className="login-orb orb-a" />
      <div className="login-orb orb-b" />
      <div className="login-brand">
        <span className="brand-mark">
          <Icon name="spark" size={20} />
        </span>
        <span>
          AI COMPANION
          <br />
          <b>CONTROL CENTER</b>
        </span>
      </div>
      <form className="login-card" onSubmit={submit}>
        <div className="login-symbol">
          <Icon name="shield" size={25} />
        </div>
        <p className="eyebrow">Private administration</p>
        <h1>Welcome back</h1>
        <p className="muted">Enter your credentials to access the control center.</p>
        {error && (
          <div className="form-error">
            <Icon name="x" size={16} />
            {error}
          </div>
        )}
        <label>
          Email address
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="admin@companion.ai"
          />
        </label>
        <label>
          Password
          <div className="input-wrap">
            <input
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              type={show ? "text" : "password"}
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShow(!show)}>
              <Icon name="eye" size={17} />
            </button>
          </div>
        </label>
        <div className="remember">
          <label>
            <input type="checkbox" defaultChecked /> Remember this device
          </label>
          <span>Protected access</span>
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Authenticating…" : "Enter control center"}{" "}
          {!loading && <Icon name="chevron" size={16} />}
        </Button>
        <small>This is a simulated prototype login. No credentials are transmitted.</small>
      </form>
      <div className="login-foot">
        <span className="live-dot" /> All systems operational <i /> Secure admin portal
      </div>
    </main>
  );
}

function Sidebar({
  page,
  navigate,
  collapsed,
  setCollapsed,
}: {
  page: string;
  navigate: (p: string) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="side-brand">
        <span className="brand-mark">
          <Icon name="spark" size={18} />
        </span>
        {!collapsed && (
          <div>
            <b>AI COMPANION</b>
            <small>CONTROL CENTER</small>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)}>
          <Icon name="chevron" size={16} />
        </button>
      </div>
      <nav>
        {nav.map((g) => (
          <div className="nav-group" key={g.section}>
            {!collapsed && <p>{g.section}</p>}
            {g.items.map((item) => (
              <button
                title={item[0]}
                key={item[2]}
                className={page === item[2] ? "active" : ""}
                onClick={() => navigate(item[2])}
              >
                <Icon name={item[1] as IconName} />
                {!collapsed && <span>{item[0]}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="side-profile">
        <div className="avatar">AR</div>
        {!collapsed && (
          <div>
            <b>Alex Rivera</b>
            <small>Primary owner</small>
          </div>
        )}
        {!collapsed && <Icon name="more" size={18} />}
      </div>
    </aside>
  );
}

function Header({
  title,
  dark,
  setDark,
  onToast,
  navigate,
}: {
  title: string;
  dark: boolean;
  setDark: (v: boolean) => void;
  onToast: (s: string) => void;
  navigate: (s: string) => void;
}) {
  return (
    <header className="topbar">
      <div className="top-title">
        <span>Control Center</span>
        <Icon name="chevron" size={12} />
        <b>{title}</b>
      </div>
      <div className="global-search">
        <Icon name="search" size={17} />
        <input placeholder="Search characters, universes, settings…" />
        <kbd>⌘ K</kbd>
      </div>
      <div className="top-actions">
        <div className="health">
          <span /> Systems healthy
        </div>
        <button onClick={() => onToast("You’re all caught up.")} className="icon-btn">
          <Icon name="bell" />
          <i />
        </button>
        <button onClick={() => setDark(!dark)} className="icon-btn">
          <Icon name={dark ? "sun" : "moon"} />
        </button>
        <button onClick={() => navigate("environment")} className="avatar">
          AR
        </button>
      </div>
    </header>
  );
}

function Sparkline({ type = "area" }: { type?: "area" | "bars" }) {
  if (type === "bars")
    return (
      <div className="mini-bars">
        {[31, 48, 43, 62, 55, 76, 64, 83, 70, 88, 72, 94].map((h, i) => (
          <i key={i} style={{ height: h + "%" }} className={i === 11 ? "hot" : ""} />
        ))}
      </div>
    );
  return (
    <svg className="sparkline" viewBox="0 0 180 50" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pinkfade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3a9c4" stopOpacity=".35" />
          <stop offset="1" stopColor="#f3a9c4" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 43 C18 38,26 45,40 32 S67 35,80 25 S102 31,116 18 S143 23,180 5 L180 50 L0 50Z"
        fill="url(#pinkfade)"
      />
      <path
        d="M0 43 C18 38,26 45,40 32 S67 35,80 25 S102 31,116 18 S143 23,180 5"
        fill="none"
        stroke="#f3a9c4"
        strokeWidth="2"
      />
    </svg>
  );
}

function Dashboard({ navigate }: { navigate: (p: string) => void }) {
  const metrics = [
    ["Total Characters", "128", "+12.4%", "users"],
    ["Active Universes", "12", "+2 this month", "globe"],
    ["Conversations", "24.8K", "+18.2%", "message"],
    ["AI Requests", "186K", "+9.6%", "spark"],
    ["Token Usage", "42.6M", "$1,842 est.", "brain"],
    ["Voice Minutes", "8,429", "+22.1%", "mic"],
    ["Media Storage", "68.4 GB", "of 250 GB", "database"],
    ["Active Groups", "36", "+4 this week", "group"],
  ];
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Monday, June 16</p>
          <h1>Good morning, Alex</h1>
          <p>Here’s what’s happening across your companion universe.</p>
        </div>
        <div>
          <Button secondary icon="calendar">
            Last 30 days
          </Button>
          <Button icon="plus" onClick={() => navigate("character-new")}>
            Create character
          </Button>
        </div>
      </div>
      <div className="metrics">
        {metrics.map((m, i) => (
          <Card key={m[0]}>
            <div className="metric-icon">
              <Icon name={m[3] as IconName} />
            </div>
            <div>
              <p>{m[0]}</p>
              <h2>{m[1]}</h2>
              <small className={i === 4 || i === 6 ? "plain" : ""}>{m[2]}</small>
            </div>
          </Card>
        ))}
      </div>
      <div className="dash-grid">
        <Card className="usage-chart">
          <div className="card-head">
            <div>
              <h3>AI usage overview</h3>
              <p>Requests across all connected providers</p>
            </div>
            <div className="legend">
              <span>
                <i className="pink" />
                Requests
              </span>
              <span>
                <i className="purple" />
                Tokens
              </span>
              <button>
                <Icon name="more" />
              </button>
            </div>
          </div>
          <div className="chart-summary">
            <b>186,240</b>
            <Badge tone="green">+9.6%</Badge>
            <span>vs previous period</span>
          </div>
          <div className="big-chart">
            <div className="y-labels">
              <span>30K</span>
              <span>20K</span>
              <span>10K</span>
              <span>0</span>
            </div>
            <svg viewBox="0 0 700 190" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#F3A9C4" stopOpacity=".28" />
                  <stop offset="1" stopColor="#F3A9C4" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g className="gridlines">
                <path d="M0 10H700M0 66H700M0 123H700M0 180H700" />
              </g>
              <path
                d="M0 155 C45 150 55 118 100 128 S150 105 190 112 S235 65 280 88 S350 55 390 65 S450 30 490 51 S555 18 600 32 S650 20 700 8 L700 180H0Z"
                fill="url(#chartFill)"
              />
              <path
                d="M0 155 C45 150 55 118 100 128 S150 105 190 112 S235 65 280 88 S350 55 390 65 S450 30 490 51 S555 18 600 32 S650 20 700 8"
                fill="none"
                stroke="#F3A9C4"
                strokeWidth="3"
              />
              <path
                d="M0 170 C55 161 90 168 125 147 S190 155 230 128 S300 140 340 117 S410 121 450 94 S510 100 555 75 S620 84 700 45"
                fill="none"
                stroke="#a68ae8"
                strokeWidth="2"
                strokeDasharray="5 5"
              />
            </svg>
            <div className="x-labels">
              <span>May 18</span>
              <span>May 24</span>
              <span>May 30</span>
              <span>Jun 5</span>
              <span>Jun 11</span>
              <span>Jun 16</span>
            </div>
          </div>
        </Card>
        <Card className="health-card">
          <div className="card-head">
            <div>
              <h3>System health</h3>
              <p>Live service status</p>
            </div>
            <Badge tone="green">Operational</Badge>
          </div>
          <div className="health-score">
            <div className="ring">
              <b>99.9%</b>
              <span>Uptime</span>
            </div>
            <div>
              <div>
                <span>API latency</span>
                <b>148 ms</b>
              </div>
              <div>
                <span>Queue depth</span>
                <b>24</b>
              </div>
              <div>
                <span>Error rate</span>
                <b>0.03%</b>
              </div>
            </div>
          </div>
          <div className="providers">
            <p>Provider connections</p>
            {[
              ["OpenAI", "Connected"],
              ["Anthropic", "Connected"],
              ["ElevenLabs", "Prototype"],
            ].map((x, i) => (
              <div key={x[0]}>
                <span>
                  <i className={i === 2 ? "warn" : ""} />
                  {x[0]}
                </span>
                <small>{x[1]}</small>
              </div>
            ))}
          </div>
        </Card>
        <Card className="active-card">
          <div className="card-head">
            <div>
              <h3>Most active characters</h3>
              <p>By conversations this week</p>
            </div>
            <button onClick={() => navigate("characters")}>View all</button>
          </div>
          {characters.slice(0, 4).map((c, i) => (
            <div className="active-row" key={c.name}>
              <b>{i + 1}</b>
              <img src={c.image} />
              <div>
                <strong>{c.name}</strong>
                <small>{c.universe}</small>
              </div>
              <span>
                {[2842, 2196, 1884, 1432][i].toLocaleString()}
                <small>messages</small>
              </span>
            </div>
          ))}
        </Card>
        <Card className="events-card">
          <div className="card-head">
            <div>
              <h3>Recent events</h3>
              <p>Live simulation activity</p>
            </div>
            <button>
              <Icon name="more" />
            </button>
          </div>
          {[
            ["Elara completed her night shift", "Neon Meridian · 2 min ago", "activity"],
            ["Sora formed a new memory", "Conversation · 8 min ago", "brain"],
            ["Moonlight Festival started", "Aether Bloom · 24 min ago", "spark"],
            ["Mira posted a new story", "Story Studio · 38 min ago", "play"],
          ].map((e, i) => (
            <div className="event-row" key={e[0]}>
              <span className={`event-icon e${i}`}>
                <Icon name={e[2] as IconName} />
              </span>
              <div>
                <b>{e[0]}</b>
                <small>{e[1]}</small>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function Characters({
  navigate,
  toast,
}: {
  navigate: (p: string) => void;
  toast: (s: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All universes"),
    [selected, setSelected] = useState<string | null>(null),
    [deleteName, setDeleteName] = useState<string | null>(null);
  const filtered = characters.filter(
    (c) =>
      (c.name + c.universe).toLowerCase().includes(query.toLowerCase()) &&
      (filter === "All universes" || c.universe === filter),
  );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Character Studio</p>
          <h1>All characters</h1>
          <p>Manage identities, personalities, relationships, and companion behavior.</p>
        </div>
        <Button icon="plus" onClick={() => navigate("character-new")}>
          Create character
        </Button>
      </div>
      <div className="stats-strip">
        {[
          ["128", "Total characters"],
          ["94", "Active"],
          ["22", "In simulation"],
          ["12", "Archived"],
        ].map((s, i) => (
          <div key={s[1]}>
            <span className={`stat-dot s${i}`} />
            <b>{s[0]}</b>
            <small>{s[1]}</small>
          </div>
        ))}
      </div>
      <Card>
        <div className="table-tools">
          <div className="search-box">
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search characters…"
            />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option>All universes</option>
            <option>Neon Meridian</option>
            <option>Aether Bloom</option>
            <option>Ashen Crown</option>
          </select>
          <select>
            <option>All statuses</option>
            <option>Active</option>
            <option>Archived</option>
          </select>
          <select>
            <option>Last active</option>
            <option>Name A–Z</option>
          </select>
          <span className="result-count">{filtered.length} results</span>
        </div>
        <div className="char-table">
          <div className="tr th">
            <span>
              <input type="checkbox" />
            </span>
            <span>Character</span>
            <span>Universe</span>
            <span>Personality</span>
            <span>Relationship</span>
            <span>Status</span>
            <span />
          </div>
          {filtered.map((c) => (
            <div className="tr" key={c.name}>
              <span>
                <input type="checkbox" />
              </span>
              <span className="char-cell">
                <img src={c.image} />
                <i className="online" />
                <span>
                  <b>{c.name}</b>
                  <small>{c.meta}</small>
                </span>
              </span>
              <span>{c.universe}</span>
              <span className="tags">
                {c.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </span>
              <span>{c.relation}</span>
              <span>
                <Badge tone="green">{c.status}</Badge>
              </span>
              <span className="row-actions">
                <button title="Preview" onClick={() => setSelected(c.name)}>
                  <Icon name="eye" />
                </button>
                <button title="Edit" onClick={() => setSelected(c.name)}>
                  <Icon name="edit" />
                </button>
                <button title="Duplicate" onClick={() => toast(`${c.name} duplicated as a draft.`)}>
                  <Icon name="copy" />
                </button>
                <button title="Delete" onClick={() => setDeleteName(c.name)}>
                  <Icon name="trash" />
                </button>
              </span>
            </div>
          ))}
        </div>
      </Card>
      {selected && (
        <Modal title="Character profile" close={() => setSelected(null)}>
          <div className="profile-modal">
            <img src={characters.find((c) => c.name === selected)?.image} />
            <div>
              <Badge tone="green">Active companion</Badge>
              <h2>{selected}</h2>
              <p>
                Independent, observant, and fiercely protective. Values authentic connection and
                remembers small personal details.
              </p>
              <div className="profile-info">
                <span>
                  <small>Universe</small>
                  <b>Neon Meridian</b>
                </span>
                <span>
                  <small>Relationship</small>
                  <b>Companion</b>
                </span>
                <span>
                  <small>Memories</small>
                  <b>1,284</b>
                </span>
                <span>
                  <small>Conversations</small>
                  <b>3,842</b>
                </span>
              </div>
              <Button onClick={() => toast("Character changes saved.")}>Edit character</Button>
            </div>
          </div>
        </Modal>
      )}
      {deleteName && (
        <Modal title="Archive character?" close={() => setDeleteName(null)}>
          <p className="modal-copy">
            Archive <b>{deleteName}</b>? Their memories and conversation history will remain safe
            and can be restored later.
          </p>
          <div className="modal-actions">
            <Button secondary onClick={() => setDeleteName(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast(`${deleteName} archived.`);
                setDeleteName(null);
              }}
            >
              Archive character
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const wizardSteps = [
  "Identity",
  "Appearance",
  "Personality",
  "Relationship",
  "Communication",
  "Voice",
  "Background",
  "Scenario",
];
function CharacterWizard({
  navigate,
  toast,
}: {
  navigate: (p: string) => void;
  toast: (s: string) => void;
}) {
  const [step, setStep] = useState(0),
    [name, setName] = useState("Nova Rei"),
    [style, setStyle] = useState("Realistic"),
    [traits, setTraits] = useState({
      Romantic: 62,
      Protective: 84,
      Playful: 71,
      Jealous: 28,
      Confident: 76,
      Introverted: 44,
    });
  const content = [
    <div className="form-grid" key="identity">
      <label className="span2">
        Character name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Gender
        <select>
          <option>Female</option>
          <option>Male</option>
          <option>Non-binary</option>
        </select>
      </label>
      <label>
        Age
        <input type="number" defaultValue="24" />
      </label>
      <label>
        Pronouns
        <input defaultValue="She / Her" />
      </label>
      <label>
        Primary universe
        <select>
          <option>Neon Meridian</option>
          <option>Aether Bloom</option>
        </select>
      </label>
      <label className="span2">
        Biography
        <textarea defaultValue="A brilliant systems architect with a quiet sense of humor and a talent for noticing what others overlook." />
      </label>
      <label className="upload span2">
        <Icon name="image" />
        <b>Upload profile image</b>
        <small>PNG or JPG · up to 10 MB</small>
        <input type="file" />
      </label>
    </div>,
    <div className="step-stack" key="appearance">
      <div className="style-select">
        <button
          className={style === "Realistic" ? "selected" : ""}
          onClick={() => setStyle("Realistic")}
        >
          <span className="style-real" />
          <b>Realistic</b>
          <small>Cinematic, lifelike rendering</small>
        </button>
        <button className={style === "Anime" ? "selected" : ""} onClick={() => setStyle("Anime")}>
          <span className="style-anime" />
          <b>Anime</b>
          <small>Stylized illustrated rendering</small>
        </button>
      </div>
      <div className="form-grid">
        <label>
          Hair
          <input defaultValue="Long, deep rose waves" />
        </label>
        <label>
          Eyes
          <input defaultValue="Warm amber" />
        </label>
        <label>
          Clothing
          <input defaultValue="Minimal black techwear" />
        </label>
        <label>
          Physical appearance
          <input defaultValue="Athletic, 168 cm" />
        </label>
        <label className="span2">
          Detailed visual prompt
          <textarea defaultValue="Soft expressive features, elegant posture, understated futuristic details, warm cinematic lighting." />
        </label>
      </div>
    </div>,
    <div className="trait-editor" key="personality">
      {Object.entries(traits).map(([t, v]) => (
        <label key={t}>
          <span>
            <b>{t}</b>
            <small>{v}%</small>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={v}
            onChange={(e) => setTraits({ ...traits, [t]: +e.target.value })}
          />
        </label>
      ))}
    </div>,
    <div className="choice-grid" key="relationship">
      {[
        "Boyfriend",
        "Girlfriend",
        "Husband",
        "Wife",
        "Best friend",
        "Crush",
        "Rival",
        "Custom",
      ].map((r, i) => (
        <button className={i === 5 ? "selected" : ""} key={r}>
          <Icon name={i === 6 ? "spark" : "heart"} />
          <b>{r}</b>
          <small>{i === 6 ? "Competitive tension" : "Relationship preset"}</small>
        </button>
      ))}
    </div>,
    <div className="form-grid" key="comm">
      <label>
        Language
        <select>
          <option>English (US)</option>
          <option>Indonesian</option>
          <option>Japanese</option>
        </select>
      </label>
      <label>
        Texting style
        <select>
          <option>Natural & warm</option>
          <option>Brief & casual</option>
          <option>Expressive</option>
        </select>
      </label>
      <label>
        Response length
        <select>
          <option>Balanced</option>
          <option>Short</option>
          <option>Detailed</option>
        </select>
      </label>
      <label>
        Emoji frequency
        <select>
          <option>Occasional</option>
          <option>Never</option>
          <option>Frequent</option>
        </select>
      </label>
      <label className="span2">
        Slang and speech notes
        <textarea defaultValue="Uses light contemporary slang, but never forces it. Occasionally teases with affection." />
      </label>
    </div>,
    <div className="step-stack" key="voice">
      <div className="voice-choice selected">
        <button className="play-btn">
          <Icon name="play" />
        </button>
        <div>
          <b>Aria</b>
          <small>Warm · Expressive · Young adult</small>
        </div>
        <span>00:08</span>
        <Badge>Selected</Badge>
      </div>
      <div className="voice-choice">
        <button className="play-btn">
          <Icon name="play" />
        </button>
        <div>
          <b>Celeste</b>
          <small>Soft · Calm · Mid-range</small>
        </div>
        <span>00:09</span>
      </div>
      <div className="form-grid">
        <label>
          Accent
          <select>
            <option>Neutral American</option>
          </select>
        </label>
        <label>
          Speaking style
          <select>
            <option>Conversational</option>
          </select>
        </label>
        <label>
          Pitch
          <input type="range" defaultValue="54" />
        </label>
        <label>
          Speed
          <input type="range" defaultValue="48" />
        </label>
      </div>
    </div>,
    <div className="form-grid" key="background">
      <label>
        Occupation
        <input defaultValue="Systems architect" />
      </label>
      <label>
        Education
        <input defaultValue="Meridian Institute of Design" />
      </label>
      <label>
        Family
        <input defaultValue="Older brother, distant parents" />
      </label>
      <label>
        Hobbies
        <input defaultValue="Night cycling, synth music" />
      </label>
      <label className="span2">
        Personal history
        <textarea defaultValue="Raised in the lower Meridian district, Nova became known for repairing forgotten machines and building unexpected friendships." />
      </label>
      <label className="span2">
        Daily schedule
        <textarea defaultValue="08:00 Coffee · 09:00 Studio · 18:00 Walk · 22:00 Personal projects" />
      </label>
    </div>,
    <div className="form-grid" key="scenario">
      <label className="span2">
        Relationship scenario
        <textarea defaultValue="You are long-time friends whose connection has recently begun to feel deeper. Neither has said it aloud yet." />
      </label>
      <label>
        World setting
        <select>
          <option>Near-future city</option>
        </select>
      </label>
      <label>
        Roleplay style
        <select>
          <option>Natural hybrid</option>
        </select>
      </label>
      <label className="span2">
        Background story
        <textarea defaultValue="After reconnecting during a citywide blackout, Nova begins making more space for you in her carefully ordered life." />
      </label>
    </div>,
  ];
  return (
    <div className="page wizard-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Character Studio</p>
          <h1>Create a new character</h1>
          <p>Build a richly detailed companion identity.</p>
        </div>
        <Button secondary onClick={() => navigate("characters")}>
          Save draft & exit
        </Button>
      </div>
      <div className="wizard-steps">
        {wizardSteps.map((s, i) => (
          <button
            key={s}
            className={`${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
            onClick={() => setStep(i)}
          >
            <span>{i < step ? <Icon name="check" size={14} /> : i + 1}</span>
            <small>{s}</small>
          </button>
        ))}
      </div>
      <div className="wizard-layout">
        <Card className="wizard-form">
          <div className="step-heading">
            <span>Step {step + 1} of 8</span>
            <h2>{wizardSteps[step]}</h2>
            <p>
              {
                [
                  "Define the essentials of who this character is.",
                  "Shape their visual identity and signature style.",
                  "Balance traits to create a nuanced personality.",
                  "Choose how they connect to the primary user.",
                  "Set the rhythm and tone of every conversation.",
                  "Give your character a distinctive voice.",
                  "Create the life they have beyond conversation.",
                  "Set the story that brings you together.",
                ][step]
              }
            </p>
          </div>
          {content[step]}
          <div className="wizard-actions">
            <Button secondary onClick={() => (step ? setStep(step - 1) : navigate("characters"))}>
              {step ? "Back" : "Cancel"}
            </Button>
            <Button
              onClick={() => {
                if (step < 7) setStep(step + 1);
                else {
                  toast(`${name} created in prototype mode.`);
                  navigate("characters");
                }
              }}
            >
              {step === 7 ? "Create character" : "Continue"}
              <Icon name="chevron" size={15} />
            </Button>
          </div>
        </Card>
        <Card className="preview-panel">
          <p className="eyebrow">Live preview</p>
          <div className="preview-photo">
            <img src={photos[0]} />
            <span>
              <i />
              Online
            </span>
          </div>
          <h2>{name || "Untitled character"}</h2>
          <p>Neon Meridian · 24 · She / Her</p>
          <div className="preview-tags">
            {Object.entries(traits)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map((x) => (
                <Badge key={x[0]}>{x[0]}</Badge>
              ))}
          </div>
          <div className="sample-chat">
            <span>Nova</span>
            <p>I was wondering when you’d show up. I saved you the seat with the best view.</p>
            <small>Preview response · Prototype</small>
          </div>
          <div className="completion">
            <span>
              <b>Profile strength</b>
              <small>{42 + step * 7}%</small>
            </span>
            <i>
              <b style={{ width: 42 + step * 7 + "%" }} />
            </i>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Personality({ toast }: { toast: (s: string) => void }) {
  const [vals, setVals] = useState({
      Warmth: 76,
      Humor: 62,
      Initiative: 84,
      Romance: 58,
      Jealousy: 24,
      Empathy: 91,
      Spontaneity: 68,
      Assertiveness: 55,
    }),
    [msg, setMsg] = useState("I had a difficult day today."),
    [response, setResponse] = useState(
      "That sounds like a lot to carry. Come sit with me for a minute—what part felt the hardest?",
    );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Character Studio</p>
          <h1>Personality lab</h1>
          <p>Fine-tune behavior and test how it feels in conversation.</p>
        </div>
        <div>
          <select className="character-select">
            <option>Elara Voss</option>
            <option>Sora Akiyama</option>
          </select>
          <Button secondary onClick={() => toast("Personality reset to last saved version.")}>
            Reset
          </Button>
          <Button onClick={() => toast("Personality configuration saved.")}>Save changes</Button>
        </div>
      </div>
      <div className="lab-layout">
        <Card>
          <div className="card-head">
            <div>
              <h3>Personality spectrum</h3>
              <p>Core traits influence every response and action.</p>
            </div>
            <Badge>Balanced profile</Badge>
          </div>
          <div className="trait-editor large">
            {Object.entries(vals).map(([k, v]) => (
              <label key={k}>
                <span>
                  <b>{k}</b>
                  <small>{v}</small>
                </span>
                <input
                  type="range"
                  value={v}
                  onChange={(e) => setVals({ ...vals, [k]: +e.target.value })}
                />
                <div className="range-ends">
                  <small>{k === "Warmth" ? "Reserved" : "Low"}</small>
                  <small>{k === "Warmth" ? "Affectionate" : "High"}</small>
                </div>
              </label>
            ))}
          </div>
        </Card>
        <div className="lab-right">
          <Card>
            <div className="card-head">
              <div>
                <h3>Live response test</h3>
                <p>Simulated preview using current values</p>
              </div>
              <span className="prototype">PROTOTYPE</span>
            </div>
            <div className="test-chat">
              <div className="test-person">
                <img src={photos[0]} />
                <div>
                  <b>Elara Voss</b>
                  <small>Personality preview</small>
                </div>
              </div>
              <div className="user-bubble">{msg}</div>
              <div className="ai-bubble">{response}</div>
            </div>
            <div className="test-input">
              <input value={msg} onChange={(e) => setMsg(e.target.value)} />
              <button
                onClick={() =>
                  setResponse(
                    vals.Empathy > 70
                      ? "I’m here. You don’t have to make it sound okay for me—tell me what happened, one piece at a time."
                      : "I hear you. Want to talk about what happened?",
                  )
                }
              >
                <Icon name="arrow" />
              </button>
            </div>
          </Card>
          <Card>
            <h3>Behavior configuration</h3>
            {[
              "Initiates conversations",
              "Remembers emotional details",
              "Challenges user opinions",
              "Uses affectionate language",
            ].map((x, i) => (
              <SettingRow key={x} label={x} initial={i !== 2} />
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Universes({ navigate }: { navigate: (p: string) => void }) {
  const items = [
    [
      "Neon Meridian",
      "Cyberpunk · Original",
      "24 characters · 18 locations",
      "https://images.unsplash.com/photo-1514775205983-11df6177191e?auto=format&fit=crop&w=900&q=80",
    ],
    [
      "Aether Bloom",
      "Fantasy · Original",
      "18 characters · 31 locations",
      "https://images.unsplash.com/photo-1665422668725-a26fd45ed24a?auto=format&fit=crop&w=900&q=80",
    ],
    [
      "Ashen Crown",
      "Dark fantasy · Original",
      "16 characters · 22 locations",
      "https://images.unsplash.com/photo-1573483947614-046b00534c6c?auto=format&fit=crop&w=900&q=80",
    ],
  ];
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Universe Studio</p>
          <h1>All universes</h1>
          <p>Manage living worlds, canon, locations, and connected stories.</p>
        </div>
        <Button icon="plus" onClick={() => navigate("universe-new")}>
          Create universe
        </Button>
      </div>
      <div className="universe-grid">
        {items.map((u, i) => (
          <Card key={u[0]}>
            <div className="universe-image">
              <img src={u[3]} />
              <Badge tone={i === 1 ? "gold" : "green"}>{i === 1 ? "Evolving" : "Active"}</Badge>
            </div>
            <div className="universe-body">
              <div>
                <p>{u[1]}</p>
                <h2>{u[0]}</h2>
                <span>{u[2]}</span>
              </div>
              <p>
                {
                  [
                    "A rain-soaked city where memory is currency and every neon street keeps a secret.",
                    "Floating islands, ancient gardens, and a magic system rooted in shared emotion.",
                    "A fractured kingdom rebuilding after a century-long winter finally begins to thaw.",
                  ][i]
                }
              </p>
              <div className="universe-stats">
                <span>
                  <Icon name="book" /> {[142, 98, 117][i]} lore entries
                </span>
                <span>
                  <Icon name="clock" /> {[36, 24, 42][i]} events
                </span>
              </div>
              <div className="card-buttons">
                <Button secondary onClick={() => navigate("lore")}>
                  Open world
                </Button>
                <button>
                  <Icon name="more" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function UniverseNew({
  navigate,
  toast,
}: {
  navigate: (p: string) => void;
  toast: (s: string) => void;
}) {
  const [step, setStep] = useState(0);
  const steps = [
    "Identity",
    "World",
    "Locations",
    "History",
    "Rules",
    "Roster",
    "Social",
    "Scenarios",
  ];
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Universe Studio</p>
          <h1>Create universe</h1>
          <p>Build an original world for characters to inhabit.</p>
        </div>
        <Button secondary onClick={() => navigate("universes")}>
          Save draft
        </Button>
      </div>
      <div className="wizard-steps compact">
        {steps.map((s, i) => (
          <button className={i === step ? "active" : ""} onClick={() => setStep(i)} key={s}>
            <span>{i + 1}</span>
            <small>{s}</small>
          </button>
        ))}
      </div>
      <Card className="universe-form">
        <div className="step-heading">
          <span>Step {step + 1} of 8</span>
          <h2>{steps[step]}</h2>
          <p>Define the {steps[step].toLowerCase()} of this living world.</p>
        </div>
        <div className="form-grid">
          <label className="span2">
            {step === 0 ? "Universe name" : `${steps[step]} title`}
            <input
              defaultValue={step === 0 ? "Velvet Horizon" : ""}
              placeholder={`Enter ${steps[step].toLowerCase()}…`}
            />
          </label>
          <label>
            Genre
            <select>
              <option>Science fantasy</option>
              <option>Cyberpunk</option>
              <option>Romance</option>
            </select>
          </label>
          <label>
            Timeline
            <select>
              <option>Near future</option>
              <option>Contemporary</option>
              <option>Alternate history</option>
            </select>
          </label>
          <label className="span2">
            World description
            <textarea defaultValue="A warm coastal megacity where dreams leave physical traces in the waking world." />
          </label>
          <label className="span2">
            Key notes
            <textarea placeholder="Important canon, constraints, or creative direction…" />
          </label>
        </div>
        <div className="wizard-actions">
          <Button secondary onClick={() => (step ? setStep(step - 1) : navigate("universes"))}>
            Back
          </Button>
          <Button
            onClick={() =>
              step < 7
                ? setStep(step + 1)
                : (toast("Universe created in prototype mode."), navigate("universes"))
            }
          >
            {step === 7 ? "Create universe" : "Continue"}
            <Icon name="chevron" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Timeline({ toast }: { toast: (s: string) => void }) {
  const events = [
    ["2041", "The Meridian Accord", "Founding event", "All districts"],
    ["2047", "First memory market opens", "Technology", "Old Harbor"],
    ["2053", "The Glass Rain", "World event", "North Quarter"],
    ["2058", "Elara arrives in Meridian", "Character", "Neon District"],
  ];
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Universe Studio</p>
          <h1>Timeline editor</h1>
          <p>Keep chronology, character moments, and world events aligned.</p>
        </div>
        <Button icon="plus" onClick={() => toast("New timeline event added.")}>
          Add event
        </Button>
      </div>
      <div className="timeline-layout">
        <Card>
          <div className="table-tools">
            <select>
              <option>Neon Meridian</option>
            </select>
            <select>
              <option>All event types</option>
            </select>
            <span className="result-count">Drag to reorder</span>
          </div>
          <div className="timeline">
            {events.map((e, i) => (
              <div className="timeline-event" key={e[1]}>
                <div className="drag">⠿</div>
                <time>{e[0]}</time>
                <i />
                <div>
                  <Badge>{e[2]}</Badge>
                  <h3>{e[1]}</h3>
                  <p>
                    {e[3]} · {i + 2} linked characters
                  </p>
                </div>
                <button>
                  <Icon name="edit" />
                </button>
                <button>
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
        </Card>
        <Card className="timeline-side">
          <h3>Timeline health</h3>
          <div className="ring small">
            <b>94%</b>
            <span>Consistent</span>
          </div>
          <p>No major canon conflicts found. Two events have soft date overlaps.</p>
          <Button secondary>Review conflicts</Button>
          <hr />
          <h3>World era</h3>
          <label>
            Current year
            <input defaultValue="2058" />
          </label>
          <label>
            Calendar system
            <select>
              <option>Standard Gregorian</option>
            </select>
          </label>
        </Card>
      </div>
    </div>
  );
}

function SocialGraph() {
  const [selected, setSelected] = useState("Elara Voss"),
    [trust, setTrust] = useState(82);
  const nodes = [
    ["Elara Voss", 50, 49, photos[0]],
    ["Sora", 23, 24, photos[1]],
    ["Kael", 78, 22, photos[2]],
    ["Mira", 79, 72, photos[3]],
    ["Nova", 22, 76, photos[0]],
  ];
  return (
    <div className="page social-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Social System</p>
          <h1>Social graph</h1>
          <p>Explore and shape every relationship across your worlds.</p>
        </div>
        <div>
          <select>
            <option>Neon Meridian</option>
            <option>All universes</option>
          </select>
          <Button icon="plus">Add relationship</Button>
        </div>
      </div>
      <div className="graph-layout">
        <Card className="graph-card">
          <div className="graph-tools">
            <div>
              <button className="active">All</button>
              <button>Romantic</button>
              <button>Friends</button>
              <button>Rivals</button>
            </div>
            <span>
              <i className="friend" /> Friendship <i className="romance" /> Romance{" "}
              <i className="rival" /> Rivalry
            </span>
          </div>
          <div className="graph-canvas">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <path
                className="line friend"
                d="M50 49 L23 24 M50 49 L78 22 M50 49 L79 72 M50 49 L22 76 M23 24 L78 22 M79 72 L22 76"
              />
              <path className="line romance" d="M50 49 L79 72" />
              <path className="line rival" d="M50 49 L78 22" />
            </svg>
            {nodes.map((n, i) => (
              <button
                key={n[0]}
                className={`graph-node ${selected === n[0] ? "selected" : ""}`}
                style={{ left: n[1] + "%", top: n[2] + "%" }}
                onClick={() => setSelected(n[0])}
              >
                <img src={n[3]} />
                <span>{n[0]}</span>
                {i === 0 && <i />}
              </button>
            ))}
          </div>
        </Card>
        <Card className="relation-panel">
          <div className="relation-person">
            <img src={photos[nodes.findIndex((n) => n[0] === selected)] || photos[0]} />
            <div>
              <small>Relationship editor</small>
              <h2>{selected}</h2>
            </div>
            <button>
              <Icon name="more" />
            </button>
          </div>
          <label>
            Relationship type
            <select>
              <option>Close friend</option>
              <option>Romantic</option>
              <option>Rival</option>
            </select>
          </label>
          <div className="trait-editor">
            <label>
              <span>
                <b>Trust</b>
                <small>{trust}%</small>
              </span>
              <input type="range" value={trust} onChange={(e) => setTrust(+e.target.value)} />
            </label>
            <label>
              <span>
                <b>Familiarity</b>
                <small>68%</small>
              </span>
              <input type="range" defaultValue="68" />
            </label>
          </div>
          <label>
            Relationship history
            <textarea defaultValue="Met during the Meridian blackout. Their friendship grew through late-night walks and shared confidences." />
          </label>
          <div className="shared">
            <span>
              <Icon name="brain" />
            </span>
            <div>
              <b>124 shared memories</b>
              <small>Last formed 8 minutes ago</small>
            </div>
            <Icon name="chevron" />
          </div>
          <Button>Save relationship</Button>
        </Card>
      </div>
    </div>
  );
}

function Groups({ toast }: { toast: (s: string) => void }) {
  const [selected, setSelected] = useState(0),
    [freq, setFreq] = useState(64);
  const groups = [
    ["Night Shift", "Neon Meridian", 4, "2.8K", "Natural Chat"],
    ["Bloom Council", "Aether Bloom", 7, "6.1K", "Cinematic Roleplay"],
    ["The Wanderers", "Cross-universe", 5, "1.4K", "Hybrid"],
  ];
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Social System</p>
          <h1>Group manager</h1>
          <p>Design dynamic group conversations and autonomous social activity.</p>
        </div>
        <Button icon="plus" onClick={() => toast("New group draft created.")}>
          Create group
        </Button>
      </div>
      <div className="group-layout">
        <Card className="group-list">
          <div className="search-box">
            <Icon name="search" />
            <input placeholder="Search groups…" />
          </div>
          {groups.map((g, i) => (
            <button
              className={selected === i ? "selected" : ""}
              onClick={() => setSelected(i)}
              key={g[0]}
            >
              <div className={`group-avatar g${i}`}>
                <Icon name="group" />
              </div>
              <div>
                <b>{g[0]}</b>
                <small>
                  {g[1]} · {g[2]} members
                </small>
              </div>
              <span>
                <b>{g[3]}</b>
                <small>messages</small>
              </span>
            </button>
          ))}
        </Card>
        <Card className="group-editor">
          <div className="card-head">
            <div>
              <Badge tone="green">Active group</Badge>
              <h2>{groups[selected][0]}</h2>
              <p>{groups[selected][1]} · Last activity 4 minutes ago</p>
            </div>
            <Button secondary icon="edit">
              Edit details
            </Button>
          </div>
          <div className="member-stack">
            {photos.map((p, i) => (
              <img src={p} key={p} style={{ zIndex: 5 - i }} />
            ))}
            <button>
              <Icon name="plus" />
            </button>
            <span>4 participating characters</span>
          </div>
          <h3>Conversation mode</h3>
          <div className="mode-grid">
            {["Natural Chat", "Cinematic Roleplay", "Hybrid"].map((x) => (
              <button className={groups[selected][4] === x ? "selected" : ""} key={x}>
                <Icon name={x === "Natural Chat" ? "message" : x === "Hybrid" ? "spark" : "book"} />
                <b>{x}</b>
                <small>
                  {x === "Hybrid"
                    ? "Blends natural chat with scenes"
                    : x === "Natural Chat"
                      ? "Casual, flowing conversation"
                      : "Immersive narrated scenes"}
                </small>
              </button>
            ))}
          </div>
          <div className="settings-grid">
            <SettingRow label="@Mention behavior" initial />
            <SettingRow label="Group memory" initial />
            <SettingRow label="Automatic event generation" initial={selected === 1} />
            <label>
              <span>
                <b>Response frequency</b>
                <small>{freq}%</small>
              </span>
              <input type="range" value={freq} onChange={(e) => setFreq(+e.target.value)} />
            </label>
          </div>
        </Card>
        <Card className="conversation-preview">
          <div className="card-head">
            <div>
              <h3>Conversation preview</h3>
              <p>Prototype simulation</p>
            </div>
            <span className="live-dot" />
          </div>
          <div className="group-chat">
            <div>
              <img src={photos[0]} />
              <p>
                <b>Elara</b>The east bridge is quiet tonight. Too quiet, maybe.
              </p>
            </div>
            <div>
              <img src={photos[3]} />
              <p>
                <b>Mira</b>Or maybe the city finally decided to give us a break.
              </p>
            </div>
            <div>
              <img src={photos[2]} />
              <p>
                <b>Kael</b>It never does. Stay alert.
              </p>
            </div>
          </div>
          <div className="chat-input">
            <input placeholder="Preview a group message…" />
            <button>
              <Icon name="arrow" />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Simulation({ toast }: { toast: (s: string) => void }) {
  const schedule = [
    ["07:30", "Morning run", "Riverwalk", "Complete"],
    ["09:00", "Studio work", "Meridian Lab", "Now"],
    ["13:00", "Lunch with Mira", "Copper Café", "Upcoming"],
    ["18:30", "Night market", "Old Harbor", "Upcoming"],
    ["23:00", "Personal project", "Apartment", "Upcoming"],
  ];
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Life Simulation</p>
          <h1>Simulation control center</h1>
          <p>Observe daily life, emotional changes, and autonomous events.</p>
        </div>
        <div className="sim-status">
          <span className="live-dot" />
          Simulation running
          <Button secondary onClick={() => toast("Simulation paused.")}>
            Pause
          </Button>
        </div>
      </div>
      <div className="sim-metrics">
        <Card>
          <Icon name="activity" />
          <div>
            <b>84</b>
            <small>Characters active</small>
          </div>
          <Sparkline />
        </Card>
        <Card>
          <Icon name="calendar" />
          <div>
            <b>312</b>
            <small>Events today</small>
          </div>
          <Sparkline type="bars" />
        </Card>
        <Card>
          <Icon name="smile" />
          <div>
            <b>Positive</b>
            <small>Overall mood</small>
          </div>
          <Badge tone="green">+8%</Badge>
        </Card>
        <Card>
          <Icon name="share" />
          <div>
            <b>1,248</b>
            <small>Social interactions</small>
          </div>
          <Sparkline />
        </Card>
      </div>
      <div className="sim-layout">
        <Card>
          <div className="card-head">
            <div>
              <h3>Elara’s day</h3>
              <p>Monday, June 16 · Local time</p>
            </div>
            <select>
              <option>Elara Voss</option>
              <option>Sora Akiyama</option>
            </select>
          </div>
          <div className="schedule">
            {schedule.map((s, i) => (
              <div className={s[3] === "Now" ? "now" : ""} key={s[0]}>
                <time>{s[0]}</time>
                <i />
                <span>
                  <b>{s[1]}</b>
                  <small>
                    <Icon name="map" size={13} />
                    {s[2]}
                  </small>
                </span>
                <Badge tone={s[3] === "Complete" ? "gray" : s[3] === "Now" ? "green" : "pink"}>
                  {s[3]}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
        <div>
          <Card className="mood-card">
            <div className="card-head">
              <div>
                <h3>Emotional state</h3>
                <p>Updated 4 minutes ago</p>
              </div>
              <Icon name="smile" />
            </div>
            <div className="mood-main">
              <span>Calm</span>
              <b>+12%</b>
            </div>
            {[
              ["Joy", 78],
              ["Energy", 64],
              ["Stress", 22],
              ["Affection", 84],
            ].map((x) => (
              <div className="mood-bar" key={x[0]}>
                <span>{x[0]}</span>
                <i>
                  <b style={{ width: x[1] + "%" }} />
                </i>
                <small>{x[1]}%</small>
              </div>
            ))}
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h3>Background engine</h3>
                <p>Autonomous processes</p>
              </div>
              <Badge tone="green">Healthy</Badge>
            </div>
            {["Social simulation", "Memory consolidation", "Event generation"].map((x) => (
              <SettingRow key={x} label={x} initial />
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stories({ toast }: { toast: (s: string) => void }) {
  const [tab, setTab] = useState("Published"),
    [modal, setModal] = useState(false);
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Stories & Media</p>
          <h1>Story studio</h1>
          <p>Create, schedule, and review stories from every world.</p>
        </div>
        <Button icon="plus" onClick={() => setModal(true)}>
          Create story
        </Button>
      </div>
      <div className="tabs">
        {["Published", "Scheduled", "Drafts", "Archived"].map((t) => (
          <button onClick={() => setTab(t)} className={tab === t ? "active" : ""} key={t}>
            {t}
            <span>
              {[18, 6, 4, 22][["Published", "Scheduled", "Drafts", "Archived"].indexOf(t)]}
            </span>
          </button>
        ))}
      </div>
      <div className="story-grid">
        {[
          [
            "Elara Voss",
            "Midnight walks hit different in Meridian.",
            "https://images.unsplash.com/photo-1514775205983-11df6177191e?auto=format&fit=crop&w=700&q=80",
            "12.4K",
            "2.1K",
          ],
          [
            "Sora Akiyama",
            "The gardens woke up early today.",
            "https://images.unsplash.com/photo-1665422668725-a26fd45ed24a?auto=format&fit=crop&w=700&q=80",
            "9.8K",
            "1.8K",
          ],
          [
            "Mira Sol",
            "Found something beautiful in the old district.",
            "https://images.unsplash.com/photo-1520052205864-92d242b3a76b?auto=format&fit=crop&w=700&q=80",
            "8.2K",
            "1.2K",
          ],
        ].map((s, i) => (
          <Card key={s[0]}>
            <div className="story-media">
              <img src={s[2]} />
              <span>
                <Icon name={i === 1 ? "image" : "play"} />
              </span>
              <Badge tone="green">{tab}</Badge>
            </div>
            <div className="story-copy">
              <div>
                <img src={photos[i]} />
                <span>
                  <b>{s[0]}</b>
                  <small>2 hours ago</small>
                </span>
                <button>
                  <Icon name="more" />
                </button>
              </div>
              <p>{s[1]}</p>
              <div>
                <span>
                  <Icon name="eye" />
                  {s[3]}
                </span>
                <span>
                  <Icon name="heart" />
                  {s[4]}
                </span>
                <span>
                  <Icon name="message" />
                  {[284, 198, 142][i]}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {modal && (
        <Modal title="Create story" close={() => setModal(false)}>
          <div className="story-types">
            {["Image story", "Video story", "Text story", "Character story"].map((x, i) => (
              <button className={i === 0 ? "selected" : ""} key={x}>
                <Icon name={i === 1 ? "play" : i === 2 ? "message" : "image"} />
                <b>{x}</b>
              </button>
            ))}
          </div>
          <label className="upload">
            <Icon name="image" />
            <b>Add story media</b>
            <small>Image or video preview</small>
          </label>
          <label>
            Caption
            <textarea defaultValue="The city feels softer after midnight." />
          </label>
          <div className="form-grid">
            <label>
              Character
              <select>
                <option>Elara Voss</option>
              </select>
            </label>
            <label>
              Audience
              <select>
                <option>All users</option>
              </select>
            </label>
          </div>
          <SettingRow label="Automatic publishing" initial={false} />
          <div className="modal-actions">
            <Button secondary onClick={() => setModal(false)}>
              Save draft
            </Button>
            <Button
              onClick={() => {
                setModal(false);
                toast("Story published in prototype mode.");
              }}
            >
              Publish story
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Voice({ toast }: { toast: (s: string) => void }) {
  const [playing, setPlaying] = useState<string | null>(null),
    [pitch, setPitch] = useState(54);
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Character Studio</p>
          <h1>Voice studio</h1>
          <p>Curate voice profiles and configure expressive delivery.</p>
        </div>
        <Button icon="plus" onClick={() => toast("Voice profile draft created.")}>
          New voice profile
        </Button>
      </div>
      <div className="voice-layout">
        <Card>
          <div className="card-head">
            <div>
              <h3>Voice library</h3>
              <p>Placeholder previews · no provider connected</p>
            </div>
            <div className="search-box">
              <Icon name="search" />
              <input placeholder="Search voices…" />
            </div>
          </div>
          {[
            ["Aria", "Warm · Expressive", "American"],
            ["Celeste", "Soft · Calm", "British"],
            ["Noah", "Deep · Grounded", "American"],
            ["Ren", "Bright · Playful", "Japanese"],
          ].map((v, i) => (
            <div className={`voice-row ${i === 0 ? "selected" : ""}`} key={v[0]}>
              <button
                className="play-btn"
                onClick={() => {
                  setPlaying(v[0]);
                  setTimeout(() => setPlaying(null), 1200);
                }}
              >
                {playing === v[0] ? <span className="playing" /> : <Icon name="play" />}
              </button>
              <div>
                <b>{v[0]}</b>
                <small>
                  {v[1]} · {v[2]}
                </small>
              </div>
              <div className="wave">
                {[4, 9, 14, 7, 18, 11, 6, 15, 9, 13, 5, 16, 10].map((h, j) => (
                  <i style={{ height: h }} key={j} />
                ))}
              </div>
              {i === 0 ? <Badge>Assigned to 4</Badge> : <Button secondary>Assign</Button>}
            </div>
          ))}
        </Card>
        <Card className="voice-config">
          <div className="voice-person">
            <img src={photos[0]} />
            <div>
              <small>Configuring voice for</small>
              <h3>Elara Voss</h3>
            </div>
          </div>
          <label>
            Assigned voice
            <select>
              <option>Aria — Warm & expressive</option>
            </select>
          </label>
          <label>
            Accent
            <select>
              <option>Neutral American</option>
              <option>Soft British</option>
            </select>
          </label>
          <div className="trait-editor">
            <label>
              <span>
                <b>Pitch</b>
                <small>{pitch}%</small>
              </span>
              <input value={pitch} onChange={(e) => setPitch(+e.target.value)} type="range" />
            </label>
            <label>
              <span>
                <b>Speaking speed</b>
                <small>0.96×</small>
              </span>
              <input defaultValue="48" type="range" />
            </label>
            <label>
              <span>
                <b>Expressiveness</b>
                <small>72%</small>
              </span>
              <input defaultValue="72" type="range" />
            </label>
          </div>
          <SettingRow label="Allow voice calls" initial />
          <SettingRow label="Generate voice notes" initial />
          <Button onClick={() => toast("Voice settings saved.")}>Save voice settings</Button>
        </Card>
      </div>
    </div>
  );
}

function Providers({ toast }: { toast: (s: string) => void }) {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">AI Engine</p>
          <h1>AI providers</h1>
          <p>Configure prototype routing and future provider connections.</p>
        </div>
        <Button icon="plus" onClick={() => toast("Provider connection wizard opened.")}>
          Add provider
        </Button>
      </div>
      <div className="notice">
        <Icon name="shield" />
        <div>
          <b>Prototype configuration</b>
          <p>
            These controls simulate provider setup only. No live AI service or billing account is
            connected.
          </p>
        </div>
      </div>
      <div className="provider-grid">
        {[
          ["OpenAI", "Text · Vision · Realtime", "GPT-4.1", "Connected"],
          ["Anthropic", "Text · Reasoning", "Claude 3.7 Sonnet", "Connected"],
          ["ElevenLabs", "Voice · Speech", "Multilingual v2", "Prototype"],
          ["Gemini", "Text · Vision", "Gemini 2.5 Pro", "Not configured"],
        ].map((p, i) => (
          <Card key={p[0]}>
            <div className={`provider-logo p${i}`}>{p[0][0]}</div>
            <div className="provider-title">
              <div>
                <h3>{p[0]}</h3>
                <p>{p[1]}</p>
              </div>
              <Badge tone={i < 2 ? "green" : i === 2 ? "gold" : "gray"}>{p[3]}</Badge>
            </div>
            <hr />
            <span>
              <small>Default model</small>
              <b>{p[2]}</b>
            </span>
            <span>
              <small>Priority</small>
              <b>{i + 1}</b>
            </span>
            <span>
              <small>Fallback</small>
              <b>{i === 0 ? "Anthropic" : "OpenAI"}</b>
            </span>
            <Button secondary icon="settings" onClick={() => toast(`${p[0]} settings opened.`)}>
              Configure
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Notifications({ toast }: { toast: (s: string) => void }) {
  const rows = [
    ["Elara sent a proactive message", "Conversation inactivity", "2 minutes ago", "Delivered"],
    ["Moonlight Festival reminder", "Scheduled event", "24 minutes ago", "Delivered"],
    ["Night Shift group activity", "Group threshold", "1 hour ago", "Delivered"],
    ["Sora anniversary message", "Relationship milestone", "Tomorrow, 09:00", "Scheduled"],
  ];
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Communication</p>
          <h1>Notification manager</h1>
          <p>Orchestrate proactive messages, reminders, and quiet hours.</p>
        </div>
        <Button icon="plus" onClick={() => toast("New notification rule created.")}>
          Create rule
        </Button>
      </div>
      <div className="notification-layout">
        <Card>
          <div className="card-head">
            <div>
              <h3>Delivery rules</h3>
              <p>Control what reaches users and when.</p>
            </div>
            <Badge tone="green">12 active</Badge>
          </div>
          {[
            "Proactive character messages",
            "Event-triggered messages",
            "Anniversary reminders",
            "Group activity notifications",
            "Story notifications",
          ].map((x, i) => (
            <SettingRow key={x} label={x} initial={i !== 4} />
          ))}
        </Card>
        <Card>
          <h3>Quiet hours</h3>
          <p className="muted">Hold non-critical notifications during the user’s local night.</p>
          <SettingRow label="Enable quiet hours" initial />
          <div className="form-grid">
            <label>
              Starts
              <input type="time" defaultValue="22:00" />
            </label>
            <label>
              Ends
              <input type="time" defaultValue="08:00" />
            </label>
          </div>
          <label>
            Timezone
            <select>
              <option>Use user’s local timezone</option>
            </select>
          </label>
          <h3>Default priority</h3>
          <div className="priority">
            <button>Low</button>
            <button className="active">Normal</button>
            <button>High</button>
          </div>
        </Card>
      </div>
      <Card>
        <div className="card-head">
          <div>
            <h3>Notification history</h3>
            <p>Recent and upcoming prototype deliveries</p>
          </div>
          <Button secondary>Export history</Button>
        </div>
        <div className="simple-table">
          {rows.map((r) => (
            <div key={r[0]}>
              <span>
                <i className={r[3] === "Scheduled" ? "scheduled" : ""} />
                <b>{r[0]}</b>
                <small>{r[1]}</small>
              </span>
              <span>{r[2]}</span>
              <Badge tone={r[3] === "Delivered" ? "green" : "pink"}>{r[3]}</Badge>
              <button>
                <Icon name="more" />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function GenericPage({ type, toast }: { type: string; toast: (s: string) => void }) {
  const [title, desc] = pageTitle[type] || [
    "Control module",
    "Configure and manage this part of the companion universe.",
  ];
  const secure = type === "security",
    backup = type === "backup",
    storage = type === "storage",
    env = type === "environment";
  const sections = secure
    ? ["Admin access", "Active sessions", "Authentication settings", "API keys"]
    : backup
      ? ["Create backup", "Restore backup", "Export configuration", "Import configuration"]
      : storage
        ? ["Media storage", "Conversation storage", "Memory storage", "Temporary files"]
        : env
          ? [
              "Backend endpoint",
              "Database connection",
              "AI provider configuration",
              "Storage configuration",
            ]
          : [
              "Primary configuration",
              "Automation behavior",
              "Advanced controls",
              "Review & diagnostics",
            ];
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {secure || backup || storage || env ? "System" : "Control Center"}
          </p>
          <h1>{title}</h1>
          <p>{desc}</p>
        </div>
        <Button onClick={() => toast(`${title} settings saved.`)}>Save changes</Button>
      </div>
      {env && (
        <div className="notice">
          <Icon name="shield" />
          <div>
            <b>Prototype environment</b>
            <p>
              Status values are illustrative and no real secrets or backend credentials are exposed.
            </p>
          </div>
        </div>
      )}
      <div className="generic-grid">
        {sections.map((s, i) => (
          <Card key={s}>
            <div className="generic-head">
              <span>
                <Icon
                  name={
                    secure
                      ? "shield"
                      : backup || storage
                        ? "database"
                        : i === 1
                          ? "activity"
                          : "settings"
                  }
                />
              </span>
              <div>
                <h3>{s}</h3>
                <p>
                  {i === 0
                    ? "Core controls and operational status"
                    : "Manage preferences and system behavior"}
                </p>
              </div>
              {!backup && (
                <Badge tone={i === 3 ? "gold" : "green"}>{i === 3 ? "Review" : "Healthy"}</Badge>
              )}
            </div>
            {backup ? (
              <>
                <p className="muted">
                  {i % 2 === 0
                    ? "Generate a protected snapshot of your current prototype configuration."
                    : "Select a local configuration file to continue."}
                </p>
                <Button secondary icon={i < 2 ? "database" : "arrow"}>
                  {s}
                </Button>
              </>
            ) : (
              <>
                {[0, 1, 2].map((j) => (
                  <div className="config-row" key={j}>
                    <div>
                      <b>
                        {secure && i === 3
                          ? ["Primary API key", "Voice provider key", "Webhook signing key"][j]
                          : ["Service enabled", "Automatic management", "Diagnostic reporting"][j]}
                      </b>
                      <small>
                        {secure && i === 3
                          ? "•••• •••• •••• " + ["4F8A", "92CD", "18E2"][j]
                          : "Recommended prototype setting"}
                      </small>
                    </div>
                    <Toggle on={j !== 2} setOn={() => {}} />
                  </div>
                ))}
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button onClick={close}>
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function SettingRow({ label, initial }: { label: string; initial?: boolean }) {
  const [on, setOn] = useState(!!initial);
  return (
    <div className="setting-row">
      <div>
        <b>{label}</b>
        <small>{on ? "Enabled" : "Disabled"}</small>
      </div>
      <Toggle on={on} setOn={setOn} />
    </div>
  );
}

export default function App() {
  const initial = location.pathname.replace("/", "") || "dashboard";
  const [authed, setAuthed] = useState(initial !== "login"),
    [page, setPage] = useState(initial === "login" ? "dashboard" : initial),
    [dark, setDark] = useState(true),
    [collapsed, setCollapsed] = useState(false),
    [toast, setToast] = useState("");
  function navigate(p: string) {
    setPage(p);
    history.pushState({}, "", `/${p}`);
    window.scrollTo(0, 0);
  }
  function notify(s: string) {
    setToast(s);
    setTimeout(() => setToast(""), 3000);
  }
  const title = useMemo(
    () =>
      nav.flatMap((x) => x.items).find((x) => x[2] === page)?.[0] ||
      pageTitle[page]?.[0] ||
      "Control Center",
    [page],
  );
  if (!authed)
    return (
      <Login
        onLogin={() => {
          setAuthed(true);
          navigate("dashboard");
        }}
      />
    );
  let content: ReactNode;
  if (page === "dashboard") content = <Dashboard navigate={navigate} />;
  else if (page === "characters") content = <Characters navigate={navigate} toast={notify} />;
  else if (page === "character-new")
    content = <CharacterWizard navigate={navigate} toast={notify} />;
  else if (page === "personality") content = <Personality toast={notify} />;
  else if (page === "universes") content = <Universes navigate={navigate} />;
  else if (page === "universe-new") content = <UniverseNew navigate={navigate} toast={notify} />;
  else if (page === "timeline") content = <Timeline toast={notify} />;
  else if (page === "social") content = <SocialGraph />;
  else if (page === "groups") content = <Groups toast={notify} />;
  else if (["schedules", "activities", "emotions", "events", "simulation"].includes(page))
    content = <Simulation toast={notify} />;
  else if (page === "stories") content = <Stories toast={notify} />;
  else if (page === "voice") content = <Voice toast={notify} />;
  else if (page === "providers") content = <Providers toast={notify} />;
  else if (page === "notifications") content = <Notifications toast={notify} />;
  else content = <GenericPage type={page} toast={notify} />;
  return (
    <div className={dark ? "app dark" : "app light"}>
      <Sidebar page={page} navigate={navigate} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="shell">
        <Header title={title} dark={dark} setDark={setDark} onToast={notify} navigate={navigate} />
        <main className="content">{content}</main>
      </div>
      {toast && (
        <div className="toast">
          <span>
            <Icon name="check" />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}
