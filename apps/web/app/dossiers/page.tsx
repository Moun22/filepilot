"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  apiFetch,
  clearSessionUser,
  getSessionUser,
  type SessionUser,
} from "../lib/api";
import s from "./dossiers.module.css";

interface ChecklistItem { id: string; key: string; label: string; required: boolean; status: string; }

interface Dossier {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  procedureType: { name: string; organization: { name: string } };
  checklistItems: ChecklistItem[];
}

export default function DossiersPage() {
  const router = useRouter();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const current = getSessionUser();
    if (!current) { router.push("/login"); return; }
    setUser(current);

    apiFetch<Dossier[]>(`/dossiers`)
      .then(setDossiers)
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    clearSessionUser();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className={s.shell}>
        <div className={s.loader}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{animation:"spin 0.8s linear infinite"}} aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          Chargement…
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div className={s.shell}>
      {/* SIDEBAR */}
      <aside className={s.sidebar} aria-label="Navigation principale">
        <div className={s.sidebarBrand}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          Filepilot
        </div>
        <nav className={s.sidebarNav}>
          <span className={s.sidebarItem} aria-current="page">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            Mes dossiers
          </span>
          {user?.role === "admin" && (
            <Link href="/admin" className={s.sidebarItem}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Admin
            </Link>
          )}
        </nav>
        <button className={s.sidebarLogout} onClick={handleLogout} aria-label="Se déconnecter">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Déconnexion
        </button>
      </aside>

      {/* MAIN */}
      <main className={s.main}>
        <div className={s.topbar}>
          <h1 className={s.title}>Mes dossiers</h1>
          <Link href="/dossiers/new" className={s.btnNew}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nouveau dossier
          </Link>
        </div>

        {dossiers.length === 0 ? (
          <div className={s.empty}>
            <div className={s.emptyIcon} aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </div>
            <p className={s.emptyTitle}>Aucun dossier pour le moment</p>
            <p className={s.emptyDesc}>Créez votre premier dossier pour commencer à organiser vos démarches.</p>
            <Link href="/dossiers/new" className={s.btnNewLg}>Créer mon premier dossier</Link>
          </div>
        ) : (
          <ul className={s.list} role="list">
            {dossiers.map((d) => {
              const done = d.checklistItems.filter((c) => c.status === "ok" || c.status === "na").length;
              const total = d.checklistItems.length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const isReady = pct === 100;
              return (
                <li key={d.id}>
                  <Link href={`/dossiers/${d.id}`} className={s.card} aria-label={`Dossier ${d.procedureType.name} — ${pct}% complété`}>
                    <div className={s.cardTop}>
                      <span className={s.cardOrg}>{d.procedureType.organization.name}</span>
                      <span className={`${s.badge} ${isReady ? s.badgeReady : s.badgeDraft}`}>
                        {isReady ? "Prêt" : d.status}
                      </span>
                    </div>
                    <p className={s.cardName}>{d.title ?? d.procedureType.name}</p>
                    <div className={s.cardBottom}>
                      <div className={s.progressWrap} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct}% complété`}>
                        <div className={s.progressBar} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={s.cardMeta}>{done}/{total} pièces</span>
                      <span className={s.cardMeta}>
                        {new Date(d.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
