import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Icon } from "../components/ui";
import { client, db } from "../lib/supabase";
function result(r: { error: { message: string } | null }) {
  if (r.error) throw new Error(r.error.message);
}
export function Auth({
  recover = false,
  denied = false,
  email: current = "",
  onRecovered,
}: {
  recover?: boolean;
  denied?: boolean;
  email?: string;
  onRecovered?: () => void;
}) {
  const [email, setEmail] = useState(current),
    [password, setPassword] = useState(""),
    [show, toggle] = useState(false),
    [reset, setReset] = useState(false),
    [notice, notify] = useState("");
  const submit = useMutation({
    mutationFn: async () => {
      if (denied) {
        result(await db().auth.signOut({ scope: "local" }));
        return;
      }
      if (recover) {
        result(await db().auth.updateUser({ password }));
        onRecovered?.();
        return;
      }
      if (reset) {
        result(
          await db().auth.resetPasswordForEmail(email, {
            redirectTo: location.origin + "/recover",
          }),
        );
        notify("Check your email for the recovery link.");
        return;
      }
      result(await db().auth.signInWithPassword({ email, password }));
    },
  });
  return (
    <main className="login">
      <div className="login-orb orb-a" />
      <div className="login-orb orb-b" />
      <div className="login-brand">
        <span className="brand-mark">
          <img src="/myra-logo.png" alt="MYRA logo" />
        </span>
        <span className="brand-name">MYRA</span>
      </div>
      <form
        className="login-card"
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
      >
        <div className="login-symbol">
          <img src="/myra-logo.png" alt="MYRA" />
        </div>
        <p className="eyebrow">Private administration</p>
        <h1>
          {!client
            ? "Connect Supabase"
            : denied
              ? "Access restricted"
              : recover
                ? "Choose a new password"
                : reset
                  ? "Recover your account"
                  : "Welcome back"}
        </h1>
        <p className="muted">
          {!client
            ? "Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your deployment."
            : denied
              ? "This account needs to be provisioned by the MYRA owner."
              : recover
                ? "Save a new password for this account."
                : reset
                  ? "We’ll send a recovery link to your email."
                  : "Enter your credentials to access MYRA."}
        </p>
        {client && (
          <>
            {!denied && !recover && (
              <label>
                Email address
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            )}
            {!denied && !reset && (
              <label>
                {recover ? "New password" : "Password"}
                <div className="input-wrap">
                  <input
                    type={show ? "text" : "password"}
                    autoComplete={recover ? "new-password" : "current-password"}
                    minLength={recover ? 8 : 1}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" aria-label="Show password" onClick={() => toggle(!show)}>
                    <Icon name="eye" />
                  </button>
                </div>
              </label>
            )}
            {!denied && !recover && (
              <div className="remember">
                <button
                  type="button"
                  onClick={() => {
                    setReset(!reset);
                    notify("");
                    submit.reset();
                  }}
                >
                  {reset ? "Back to sign in" : "Forgot password?"}
                </button>
              </div>
            )}
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending
                ? "Please wait…"
                : denied
                  ? "Sign out"
                  : recover
                    ? "Save password"
                    : reset
                      ? "Send recovery link"
                      : "Enter MYRA"}
            </Button>
          </>
        )}
        {submit.error && (
          <p className="form-error" role="alert">
            {submit.error.message}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
      </form>
      <div className="login-foot">MYRA · Secure admin portal</div>
    </main>
  );
}
