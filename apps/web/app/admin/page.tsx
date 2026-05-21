"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  apiFetch,
  clearSessionUser,
  getSessionUser,
  type SessionUser,
} from "../lib/api";
import s from "../dossiers/dossiers.module.css";
import a from "./admin.module.css";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  _count: { dossiers: number };
}

interface AdminDossier {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  owner: { id: string; email: string };
  procedureType: { name: string; organization: { name: string } };
  _count: { documents: number; checklistItems: number };
}

interface Stats {
  users: number;
  dossiers: number;
  documents: number;
  exports: number;
}

type Tab = "users" | "dossiers";

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [dossiers, setDossiers] = useState<AdminDossier[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [u, d, st] = await Promise.all([
        apiFetch<AdminUser[]>("/admin/users"),
        apiFetch<AdminDossier[]>("/admin/dossiers"),
        apiFetch<Stats>("/admin/stats"),
      ]);
      setUsers(u);
      setDossiers(d);
      setStats(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    }
  }, []);

  useEffect(() => {
    const current = getSessionUser();
    if (!current) { router.push("/login"); return; }
    if (current.role !== "admin") { router.push("/dossiers"); return; }
    setMe(current);
    refresh().finally(() => setLoading(false));
  }, [router, refresh]);

  async function toggleRole(target: AdminUser) {
    if (target.id === me?.id) return;
    const nextRole = target.role === "admin" ? "user" : "admin";
    setBusyId(target.id);
    try {
      await apiFetch(`/admin/users/${target.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole }),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, role: nextRole } : u)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(target: AdminUser) {
    if (target.id === me?.id) return;
    if (!confirm(`Supprimer ${target.email} et tous ses dossiers ?`)) return;
    setBusyId(target.id);
    try {
      await apiFetch(`/admin/users/${target.id}`, { method: "DELETE" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteDossier(target: AdminDossier) {
    if (!confirm(`Supprimer le dossier de ${target.owner.email} ?`)) return;
    setBusyId(target.id);
    try {
      await apiFetch(`/dossiers/${target.id}`, { method: "DELETE" });
      setDossiers((prev) => prev.filter((d) => d.id !== target.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className={s.shell}>
        <div className={s.loader}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 0.8s linear infinite" }} aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          Chargement…
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div className={s.shell}>
      <aside className={s.sidebar} aria-label="Navigation principale">
        <div className={s.sidebarBrand}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
          Filepilot
        </div>
        <nav className={s.sidebarNav}>
          <Link href="/dossiers" className={s.sidebarItem}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
            Mes dossiers
          </Link>
          <span className={s.sidebarItem} aria-current="page" style={{ background: "rgba(99,102,241,0.15)", color: "#fff" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            Admin
          </span>
        </nav>
        <button className={s.sidebarLogout} onClick={() => { clearSessionUser(); router.push("/login"); }} aria-label="Se déconnecter">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          Déconnexion
        </button>
      </aside>

      <main className={`${s.main} ${a.mainWide}`}>
        <div className={s.topbar}>
          <h1 className={s.title}>Administration</h1>
        </div>

        {stats && (
          <div className={a.statsGrid} role="list">
            <div className={a.statCard} role="listitem">
              <span className={a.statValue}>{stats.users}</span>
              <span className={a.statLabel}>Utilisateurs</span>
            </div>
            <div className={a.statCard} role="listitem">
              <span className={a.statValue}>{stats.dossiers}</span>
              <span className={a.statLabel}>Dossiers</span>
            </div>
            <div className={a.statCard} role="listitem">
              <span className={a.statValue}>{stats.documents}</span>
              <span className={a.statLabel}>Documents</span>
            </div>
            <div className={a.statCard} role="listitem">
              <span className={a.statValue}>{stats.exports}</span>
              <span className={a.statLabel}>Exports ZIP</span>
            </div>
          </div>
        )}

        {error && (
          <p className={s.errorBanner} role="alert">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            {error}
          </p>
        )}

        <div className={a.tabs} role="tablist">
          <button role="tab" aria-selected={tab === "users"} className={`${a.tab} ${tab === "users" ? a.tabActive : ""}`} onClick={() => setTab("users")}>
            Utilisateurs ({users.length})
          </button>
          <button role="tab" aria-selected={tab === "dossiers"} className={`${a.tab} ${tab === "dossiers" ? a.tabActive : ""}`} onClick={() => setTab("dossiers")}>
            Dossiers ({dossiers.length})
          </button>
        </div>

        {tab === "users" && (
          <section className={a.section} aria-labelledby="users-heading">
            <div className={a.sectionHeader}>
              <h2 className={a.sectionHeaderTitle} id="users-heading">Gestion des utilisateurs</h2>
            </div>
            {users.length === 0 ? (
              <p className={a.empty}>Aucun utilisateur.</p>
            ) : (
              <div className={a.tableWrap}>
                <table className={a.table}>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th className={a.colShrink}>Rôle</th>
                      <th className={a.colNum}>Dossiers</th>
                      <th className={a.colShrink}>Inscrit le</th>
                      <th className={a.colActions}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className={a.colTruncate} title={u.email}>
                          <span className={a.cellStrong}>{u.email}</span>
                          {u.id === me?.id && <span className={a.cellSecondary}> · vous</span>}
                        </td>
                        <td className={a.colShrink}>
                          <span className={`${a.rolePill} ${u.role === "admin" ? a.roleAdmin : a.roleUser}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className={a.colNum}>{u._count.dossiers}</td>
                        <td className={a.colDate}>{new Date(u.createdAt).toLocaleDateString("fr-FR")}</td>
                        <td className={a.colActions}>
                          <div className={a.actionRow}>
                            <button
                              className={a.iconBtn}
                              onClick={() => toggleRole(u)}
                              disabled={u.id === me?.id || busyId === u.id}
                              aria-label={u.role === "admin" ? "Rétrograder" : "Promouvoir admin"}
                            >
                              {u.role === "admin" ? "→ user" : "→ admin"}
                            </button>
                            <button
                              className={`${a.iconBtn} ${a.iconBtnDanger}`}
                              onClick={() => deleteUser(u)}
                              disabled={u.id === me?.id || busyId === u.id}
                              aria-label={`Supprimer ${u.email}`}
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "dossiers" && (
          <section className={a.section} aria-labelledby="dossiers-heading">
            <div className={a.sectionHeader}>
              <h2 className={a.sectionHeaderTitle} id="dossiers-heading">Tous les dossiers</h2>
            </div>
            {dossiers.length === 0 ? (
              <p className={a.empty}>Aucun dossier.</p>
            ) : (
              <div className={a.tableWrap}>
                <table className={a.table}>
                  <thead>
                    <tr>
                      <th>Propriétaire</th>
                      <th>Démarche</th>
                      <th>Titre</th>
                      <th className={a.colShrink}>Pièces</th>
                      <th className={a.colShrink}>Créé le</th>
                      <th className={a.colActions}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossiers.map((d) => (
                      <tr key={d.id}>
                        <td className={a.colTruncate} title={d.owner.email}>
                          <span className={a.cellStrong}>{d.owner.email}</span>
                        </td>
                        <td className={a.colTruncate} title={`${d.procedureType.organization.name} — ${d.procedureType.name}`}>
                          {d.procedureType.organization.name} — {d.procedureType.name}
                        </td>
                        <td className={a.colTruncate} title={d.title ?? ""}>
                          {d.title ?? <span className={a.cellSecondary}>—</span>}
                        </td>
                        <td className={a.colShrink}>
                          <span className={a.cellStrong}>{d._count.documents}</span>
                          <span className={a.cellSecondary}> doc · {d._count.checklistItems} items</span>
                        </td>
                        <td className={a.colDate}>{new Date(d.createdAt).toLocaleDateString("fr-FR")}</td>
                        <td className={a.colActions}>
                          <div className={a.actionRow}>
                            <Link href={`/dossiers/${d.id}`} className={a.iconBtn}>Voir</Link>
                            <button
                              className={`${a.iconBtn} ${a.iconBtnDanger}`}
                              onClick={() => deleteDossier(d)}
                              disabled={busyId === d.id}
                              aria-label={`Supprimer ${d.title ?? d.procedureType.name}`}
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
