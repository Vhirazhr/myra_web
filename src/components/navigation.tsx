import { Icon, type IconName } from "./ui";
export const nav = [
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
      ["Conversations", "message", "chat"],
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

export function Sidebar({
  email,
  page,
  navigate,
  collapsed,
  setCollapsed,
}: {
  email: string;
  page: string;
  navigate: (p: string) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="side-brand">
        <span className="brand-mark">
          <img src="/myra-logo.png" alt="MYRA logo" />
        </span>
        {!collapsed && <div className="brand-name">MYRA</div>}
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
        <div className="avatar">{email.slice(0, 2).toUpperCase()}</div>
        {!collapsed && (
          <div>
            <b>{email}</b>
            <small>Administrator</small>
          </div>
        )}
      </div>
    </aside>
  );
}
