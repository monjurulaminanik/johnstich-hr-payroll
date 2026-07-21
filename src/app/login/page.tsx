"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, Sparkles, Users, Wallet, Shield } from "lucide-react";
import { DEMO_ADMIN } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function demoLogin() {
    setLoading(true);
    setError("");
    setEmail(DEMO_ADMIN.email);
    setPassword(DEMO_ADMIN.password);
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: DEMO_ADMIN.email,
        password: DEMO_ADMIN.password,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          router.push("/");
          router.refresh();
        } else {
          setError(data.error || "Demo login failed");
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }

  return (
    <div className="login-page">
      <div className="login-orb login-orb-a" />
      <div className="login-orb login-orb-b" />
      <div className="login-orb login-orb-c" />

      <div className="login-grid">
        {/* Brand panel */}
        <section className="login-brand">
          <div className="login-brand-inner">
            <div className="login-logo-ring">
              <Image
                src="/logo-256.png"
                alt="Jhonstitch"
                width={88}
                height={88}
                className="login-logo"
                priority
              />
            </div>
            <p className="login-eyebrow">Enterprise HR Suite</p>
            <h1 className="login-title">
              Jhonstitch
              <span> Knitting & Dyeing</span>
            </h1>
            <p className="login-tagline">
              Wages, salary, attendance & payroll — one beautiful platform for your
              entire workforce.
            </p>

            <div className="login-features">
              <div className="login-feature">
                <div className="login-feature-icon">
                  <Users size={18} />
                </div>
                <div>
                  <strong>202 employees</strong>
                  <span>Wages + salary staff</span>
                </div>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon">
                  <Wallet size={18} />
                </div>
                <div>
                  <strong>Live payroll</strong>
                  <span>June 2026 · MongoDB</span>
                </div>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon">
                  <Shield size={18} />
                </div>
                <div>
                  <strong>Secure & persistent</strong>
                  <span>Cloud database</span>
                </div>
              </div>
            </div>

            <p className="login-location">Khadun · Rupshi · Narayanganj</p>
          </div>
        </section>

        {/* Form panel */}
        <section className="login-form-panel">
          <div className="login-card">
            <div className="login-card-head">
              <h2>Welcome back</h2>
              <p>Sign in to manage your mill workforce</p>
            </div>

            {error && <div className="login-error">{error}</div>}

            <form onSubmit={login} className="login-form">
              <div className="login-field">
                <label htmlFor="email">
                  <Mail size={15} /> Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@gmail.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="login-field">
                <label htmlFor="password">
                  <Lock size={15} /> Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
              <button type="submit" className="btn btn-login" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>

            <div className="login-divider">
              <span>or try instantly</span>
            </div>

            <button
              type="button"
              className="btn btn-demo"
              onClick={demoLogin}
              disabled={loading}
            >
              <Sparkles size={18} />
              Demo Admin Login
              <span className="btn-demo-hint">admin@gmail.com</span>
            </button>

            <p className="login-footnote">
              Demo credentials are pre-filled. One click to explore the full system.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
