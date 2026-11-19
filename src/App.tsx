import { useEffect, useState } from "react";
import { BrowserRouter, useLocation, useNavigate, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { client, db } from "./lib/supabase";
import { cache, refresh, result, save, useRows } from "./services/workspace";
import { nav, Sidebar } from "./components/navigation";
import { Icon, Button, Card } from "./components/ui";
import { Auth } from "./pages/Auth";
import { Editor } from "./components/Editor";
import { Heading, Records } from "./components/Records";
import { catalog, character, universe } from "./services/catalog";
import {
  Backup,
  CharacterLab,
  Dashboard,
  Library,
  Settings,
  Social,
  Stories,
} from "./pages/Studios";
import { Conversations, CallStudio } from "./pages/Conversations";
const items = nav.flatMap((g) =>
  g.items.map((i) => ({ name: i[0], id: i[2] as string, section: g.section })),
);
function Page({ page }: { page: string }) {
  const navigate = useNavigate(),
    item = items.find((i) => i.id === page);
  if (["dashboard", "analytics", "usage"].includes(page)) return <Dashboard page={page} />;
  if (["character-new", "universe-new"].includes(page)) {
    const spec = page === "character-new" ? character : universe;
    return (
      <div className="page wizard-page">
        <Heading section={item!.section} title={"Create " + spec.singular} />
        <Editor wizard={spec === character} spec={spec} done={() => navigate("/" + spec.table)} />
      </div>
    );
  }
  if (["personality", "appearance", "voice", "voice-notes"].includes(page))
    return <CharacterLab page={page} />;
  if (page === "social") return <Social />;
  if (["stories", "story-scheduler"].includes(page))
    return <Stories scheduler={page === "story-scheduler"} />;
  if (["simulation", "context", "response", "proactive", "language", "environment"].includes(page))
    return <Settings page={page} title={item!.name} />;
  if (["media", "gallery", "storage"].includes(page)) return <Library page={page} />;
  if (page === "calls") return <CallStudio />;
  if (page === "backup") return <Backup />;
  if (page === "logs" || page === "chat") return <Conversations />;
  if (page === "security")
    return (
      <Records
        title="Security audit"
        section="System"
        spec={{
          table: "audit_logs",
          singular: "audit event",
          fields: [
            { key: "entity", label: "Table" },
            { key: "operation", label: "Operation" },
            { key: "record_id", label: "Record" },
          ],
          label: "entity",
          readOnly: true,
        }}
      />
    );
  if (page === "notifications") return <Notifications />;
  if (page === "emotions")
    return (
      <Records
        title="Emotional State"
        section="Life Simulation"
        spec={catalog.activities}
        filter={(r) => !!r.mood}
      />
    );
  if (catalog[page])
    return <Records title={item!.name} section={item!.section} spec={catalog[page]} />;
  return <Navigate replace to="/dashboard" />;
}
function Notifications() {
  const action = useMutation({
    mutationFn: async (id: string) => {
      await save("notifications", { read_at: new Date().toISOString() }, id);
      await refresh();
    },
  });
  return (
    <Records
      title="Notification Manager"
      section="Communication"
      spec={catalog.notifications}
      actions={(r) => (
        <Button
          secondary
          disabled={!!r.read_at || action.isPending}
          onClick={() => action.mutate(r.id)}
        >
          {r.read_at ? "Read" : "Mark read"}
        </Button>
      )}
    >
      {action.error && <p role="alert">{action.error.message}</p>}
    </Records>
  );
}
function Shell({ session }: { session: Session }) {
  const location = useLocation(),
    navigate = useNavigate(),
    page = location.pathname.split("/")[1] || "dashboard",
    title = items.find((i) => i.id === page)?.name || "Dashboard";
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 780),
    [dark, setDark] = useState(true),
    [search, setSearch] = useState(""),
    [realtime, setRealtime] = useState("");
  const chars = useRows("characters"),
    worlds = useRows("universes");
  const logout = useMutation({
    mutationFn: async () => {
      const { error } = await db().auth.signOut();
      if (error) throw error;
    },
  });
  useEffect(() => {
    const channel = db()
      .channel("myra-" + session.user.id)
      .on("postgres_changes", { event: "*", schema: "public" }, () => void refresh())
      .subscribe((s) => setRealtime(s));
    return () => {
      void db().removeChannel(channel);
    };
  }, [session.user.id]);
  const go = (id: string) => {
    navigate("/" + id);
    setSearch("");
    window.scrollTo(0, 0);
  };
  const matches = [
    ...items.map((i) => ({ name: i.name, id: i.id })),
    ...(chars.data || []).map((c) => ({
      name: c.name,
      id: "characters?q=" + encodeURIComponent(c.name),
    })),
    ...(worlds.data || []).map((r) => ({
      name: r.name,
      id: "universes?q=" + encodeURIComponent(r.name),
    })),
  ]
    .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 10);
  return (
    <div className={dark ? "app dark" : "app light"}>
      <Sidebar
        page={page}
        email={session.user.email || "Admin"}
        navigate={go}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
      <div className="shell">
        <header className="topbar">
          <div className="top-title">
            <span>MYRA</span>
            <Icon name="chevron" size={12} />
            <b>{title}</b>
          </div>
          <div className="global-search">
            <Icon name="search" />
            <input
              aria-label="Search workspace"
              placeholder="Search characters, universes, settings…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearch("");
                if (e.key === "Enter" && matches[0]) go(matches[0].id);
              }}
            />
            {search && (
              <div className="search-results">
                {matches.map((m, i) => (
                  <button key={i} onClick={() => go(m.id)}>
                    {m.name}
                  </button>
                ))}
                {!matches.length && <small>No results</small>}
              </div>
            )}
          </div>
          <div className="top-actions">
            <small title="Realtime subscription">
              {realtime === "SUBSCRIBED"
                ? "Live updates"
                : realtime === "CHANNEL_ERROR" || realtime === "TIMED_OUT"
                  ? "Reconnecting…"
                  : ""}
            </small>
            <button
              className="icon-btn"
              aria-label="Notifications"
              onClick={() => go("notifications")}
            >
              <Icon name="bell" />
            </button>
            <button className="icon-btn" aria-label="Toggle theme" onClick={() => setDark(!dark)}>
              <Icon name={dark ? "sun" : "moon"} />
            </button>
            <Button secondary onClick={() => logout.mutate()}>
              Sign out
            </Button>
          </div>
        </header>
        {logout.error && <p role="alert">{logout.error.message}</p>}
        <main className="content">
          <Routes>
            <Route path="/chat/:id" element={<Conversations />} />
            <Route
              path="*"
              element={<Page key={location.pathname + location.search} page={page} />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}
function Gate() {
  const [session, setSession] = useState<Session | null | undefined>(undefined),
    [error, fail] = useState(""),
    [recovery, recover] = useState(false);
  const navigate = useNavigate(),
    location = useLocation();
  useEffect(() => {
    if (!client) {
      setSession(null);
      return;
    }
    let alive = true,
      seen = false,
      last: string | undefined;
    const subscription = client.auth.onAuthStateChange((event, s) => {
      if (!alive) return;
      seen = true;
      if (s?.user.id !== last) {
        cache.clear();
        last = s?.user.id;
      }
      setSession(s);
      if (event === "PASSWORD_RECOVERY") recover(true);
    }).data.subscription;
    void client.auth.getSession().then((r) => {
      if (alive && !seen) {
        if (r.error) fail(r.error.message);
        setSession(r.data.session);
      }
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  const admin = useQuery({
    queryKey: ["admin", session?.user.id],
    enabled: !!session,
    queryFn: async () => result(await db().rpc("is_myra_admin")) as boolean,
  });
  if (error || admin.error)
    return (
      <main className="login">
        <Card className="wizard-form">
          <h2>Connection unavailable</h2>
          <p role="alert">{error || admin.error?.message}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </Card>
      </main>
    );
  if (session === undefined || (session && admin.isPending))
    return (
      <main className="login">
        <p>Opening MYRA…</p>
      </main>
    );
  if (!session) return <Auth />;
  if (!admin.data) return <Auth denied email={session.user.email} />;
  if (recovery || location.pathname === "/recover")
    return (
      <Auth
        recover
        onRecovered={() => {
          recover(false);
          navigate("/dashboard", { replace: true });
        }}
      />
    );
  if (["/login", "/"].includes(location.pathname)) return <Navigate replace to="/dashboard" />;
  return <Shell session={session} />;
}
export default function App() {
  return (
    <QueryClientProvider client={cache}>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
