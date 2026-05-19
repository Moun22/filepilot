"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../lib/api";
import s from "../auth.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await apiFetch<{ id: string; email: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("user", JSON.stringify(user));
      router.push("/dossiers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={s.shell}>
      <div className={s.card}>
        <div className={s.brandRow} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          Filepilot
        </div>
        <h1 className={s.heading}>Connexion</h1>
        <p className={s.sub}>Accédez à votre espace sécurisé</p>

        <form onSubmit={handleSubmit} className={s.form}>
          {error && (
            <p className={s.error} role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </p>
          )}

          <div className={s.field}>
            <label className={s.label} htmlFor="email">Adresse e-mail</label>
            <input id="email" className={s.input} type="email" placeholder="vous@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>

          <div className={s.field}>
            <label className={s.label} htmlFor="password">Mot de passe</label>
            <input id="password" className={s.input} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>

          <button type="submit" className={s.submit} disabled={loading}>
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{animation:"spin 0.8s linear infinite"}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Connexion…
              </>
            ) : "Se connecter"}
          </button>
        </form>

        <p className={s.footer}>
          Pas encore de compte ?{" "}
          <Link href="/register" className={s.footerLink}>Créer un compte</Link>
        </p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
