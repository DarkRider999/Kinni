import { Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Segmented } from "../components/ui";
import { useApp } from "../lib/app-state";

export function Login() {
  const { login } = useApp();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("pro");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, plan);
      nav("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login glass" onSubmit={submit}>
        <div className="row">
          <div className="logo-mark" style={{ color: "var(--cyan)" }}>
            <Sparkles />
          </div>
          <h1>NeonForge AI</h1>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Studio-grade AI photo &amp; video editing — one file or thousands.
        </p>
        <label className="field">
          <span>Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
        </label>
        <Segmented
          label="Plan (dev sign-in)"
          value={plan}
          options={[
            { value: "free", label: "Free" },
            { value: "pro", label: "Pro" },
            { value: "studio", label: "Studio" },
          ]}
          onChange={setPlan}
        />
        {error && <div className="error-text">{error}</div>}
        <button className="btn primary" disabled={busy || !email}>
          {busy ? "Signing in…" : "Continue"}
        </button>
        <p className="small muted" style={{ margin: 0 }}>
          Development sign-in. Production uses Google / Apple / email OTP.
        </p>
      </form>
    </div>
  );
}
