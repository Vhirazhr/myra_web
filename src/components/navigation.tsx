import { useEffect, useState } from "react";
import { Icon, type IconName } from "./ui";
export const nav = [
  { section: "Overview", items: [["Dashboard", "grid", "dashboard"], ["AI Usage & Costs", "spark", "usage"]] },
  { section: "Character Studio", items: [
    ["All Characters", "users", "characters"], ["Create Character", "plus", "character-new"],
    ["Personality Lab", "brain", "personality"], ["Appearance Studio", "image", "appearance"], ["Voice Studio", "mic", "voice"],
  ]},
  { section: "Universe Studio", items: [
    ["All Universes", "globe", "universes"], ["Create Universe", "plus", "universe-new"],
    ["Lore Manager", "book", "lore"], ["Timeline Editor", "clock", "timeline"], ["Location Manager", "map", "locations"], ["Crossover Studio", "share", "crossover"],
  ]},
  { section: "Social System", items: [
    ["Social Graph", "share", "social"], ["Friends & Relationships", "heart", "relationships"], ["Group Manager", "group", "groups"], ["Character Interactions", "message", "interactions"],
  ]},
  { section: "Life Simulation", items: [
    ["Daily Schedules", "calendar", "schedules"], ["Character Activities", "activity", "activities"], ["Emotional State", "smile", "emotions"], ["Event Scheduler", "clock", "events"], ["Life Simulation Settings", "settings", "simulation"],
  ]},
  { section: "Stories & Media", items: [
    ["Story Studio", "play", "stories"], ["Story Scheduler", "calendar", "story-scheduler"], ["Media Library", "image", "media"], ["Character Media Studio", "image", "character-media"], ["Gallery Manager", "image", "gallery"],
  ]},
  { section: "AI Engine", items: [
    ["Multi-AI Providers", "spark", "providers"], ["Google AI Engine", "spark", "google-ai"], ["Memory Engine", "brain", "memory"], ["Language Engine", "globe", "language"], ["Response Behavior", "message", "response"], ["Context Management", "database", "context"],
  ]},
  { section: "Communication", items: [
    ["Conversations", "message", "chat"], ["Notification Manager", "bell", "notifications"], ["Proactive Messaging", "message", "proactive"], ["Voice Calls", "phone", "calls"],
  ]},
  { section: "System", items: [
    ["Backup & Restore", "database", "backup"], ["Security", "shield", "security"], ["General Settings", "settings", "environment"],
  ]},
] as const;
export function Sidebar({
  email, page, navigate, collapsed, setCollapsed,
}: {
  email: string; page: string; navigate: (p: string) => void;
  collapsed: boolean; setCollapsed: (v: boolean) => void;
}) {
  const activeSection = nav.find((group) => group.items.some((item) => item[2] === page))?.section;
  const [expanded, setExpanded] = useState<string[]>(() =>
    activeSection ? ["Overview", activeSection] : ["Overview"],
  );
  useEffect(() => {
    if (!activeSection) return;
    setExpanded((current) => current.includes(activeSection) ? current : [...current, activeSection]);
  }, [activeSection]);
  function toggleSection(section: string) {
    setExpanded((current) => current.includes(section)
      ? current.filter((item) => item !== section) : [...current, section]);
  }
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="side-brand">
        <span className="brand-mark"><img src="/myra-logo.png" alt="MYRA logo" /></span>
        {!collapsed && <div className="brand-name">MYRA</div>}
        <button type="button" title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}>
          <Icon name="chevron" size={16} />
        </button>
      </div>
      <nav id="main-navigation" aria-label="Main navigation">
        {nav.map((group) => {
          const isExpanded = expanded.includes(group.section);
          return (
            <div className="nav-group" key={group.section}>
              {!collapsed && <button type="button" className="nav-group-toggle"
                aria-expanded={isExpanded} onClick={() => toggleSection(group.section)}>
                <span>{group.section}</span><Icon name="chevron" size={13} />
              </button>}
              {(collapsed || isExpanded) && group.items.map((item) => (
                <button type="button" title={item[0]} key={item[2]}
                  className={page === item[2] ? "active" : ""}
                  aria-current={page === item[2] ? "page" : undefined}
                  onClick={() => navigate(item[2])}>
                  <Icon name={item[1] as IconName} />
                  {!collapsed && <span>{item[0]}</span>}
                </button>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="side-profile">
        <div className="avatar">{email.slice(0, 2).toUpperCase()}</div>
        {!collapsed && <div><b>{email}</b><small>Administrator</small></div>}
      </div>
    </aside>
  );
}
