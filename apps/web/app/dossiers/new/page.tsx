"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, clearSessionUser, getSessionUser } from "../../lib/api";
import s from "../dossiers.module.css";

interface Template {
  id: string;
  version: number;
  title: string;
  isActive: boolean;
}

interface ProcedureType {
  id: string;
  name: string;
  slug: string;
  templates: Template[];
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  procedureTypes: ProcedureType[];
}

export default function NewDossierPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!getSessionUser()) {
      router.push("/login");
      return;
    }
    apiFetch<Organization[]>("/procedure-types")
      .then((data) => {
        setOrganizations(data ?? []);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les démarches"
        );
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleCreate(procedureTypeId: string) {
    if (!getSessionUser()) {
      router.push("/login");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const dossier = await apiFetch<{ id: string }>("/dossiers", {
        method: "POST",
        body: JSON.stringify({
          procedureTypeId,
          title: title || undefined,
        }),
      });
      router.push(`/dossiers/${dossier.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création");
      setCreating(false);
    }
  }

  return (
    <div className={s.shell}>
      {/* SIDEBAR */}
      <aside className={s.sidebar} aria-label="Navigation principale">
        <div className={s.sidebarBrand}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Filepilot
        </div>
        <nav className={s.sidebarNav}>
          <Link href="/dossiers" className={s.sidebarItem}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            Mes dossiers
          </Link>
        </nav>
        <button
          className={s.sidebarLogout}
          onClick={() => {
            clearSessionUser();
            router.push("/login");
          }}
          aria-label="Se déconnecter"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Déconnexion
        </button>
      </aside>

      <main className={s.main}>
        {loading ? (
          <div className={s.loader}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: "spin 0.8s linear infinite" }}
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Chargement des démarches…
          </div>
        ) : (
          <>
            <nav aria-label="Fil d'Ariane" className={s.breadcrumb}>
              <Link href="/dossiers" className={s.breadLink}>
                Mes dossiers
              </Link>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span>Nouveau dossier</span>
            </nav>

            <div className={s.topbar}>
              <h1 className={s.title}>Nouveau dossier</h1>
            </div>

            {error && (
              <p className={s.error} role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </p>
            )}

            <div className={s.section}>
              <label className={s.fieldLabel} htmlFor="dossier-title">
                Nom du dossier (optionnel)
              </label>
              <input
                id="dossier-title"
                className={s.input}
                type="text"
                placeholder="ex : Dossier APL septembre 2025"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className={s.section}>
              <h2 className={s.sectionTitle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                Choisissez une démarche
              </h2>

              {!error && organizations.length === 0 && (
                <p className={s.error} role="alert">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Aucune démarche disponible. Vérifiez que la base de données a été initialisée (seed).
                </p>
              )}

              {organizations.map((org) => (
                <div key={org.id} className={s.orgGroup}>
                  <div className={s.orgName}>{org.name}</div>
                  <ul className={s.procList}>
                    {org.procedureTypes.map((pt) => (
                      <li key={pt.id}>
                        <button
                          className={s.procBtn}
                          onClick={() => handleCreate(pt.id)}
                          disabled={creating}
                          aria-label={`Créer un dossier pour ${pt.name}`}
                        >
                          <span>{pt.name}</span>
                          {pt.templates[0] && (
                            <span className={s.procVersion}>
                              v{pt.templates[0].version}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
