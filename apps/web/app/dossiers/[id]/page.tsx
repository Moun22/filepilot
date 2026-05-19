"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import s from "../dossiers.module.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ChecklistItem { id: string; key: string; label: string; required: boolean; status: string; }
interface Document { id: string; filename: string; mimeType: string; sizeBytes: number; createdAt: string; }
interface Dossier {
  id: string; title: string | null; status: string; createdAt: string; templateVersion: number;
  procedureType: { name: string; slug: string; organization: { name: string } };
  checklistItems: ChecklistItem[];
}

function formatSize(b: number) {
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`;
  return `${(b / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function DossierDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { router.push("/login"); return; }
    const parsed = JSON.parse(stored) as { id?: string };
    setUserId(parsed.id);
  }, [router]);

  useEffect(() => {
    if (userId === undefined) return; // attend l'init
    Promise.all([
      apiFetch<Dossier>(`/dossiers/${id}`),
      apiFetch<Document[]>(`/files/dossier/${id}`),
    ])
      .then(([d, docs]) => { setDossier(d); setDocuments(docs); })
      .catch(() => router.push("/dossiers"))
      .finally(() => setLoading(false));
  }, [id, router, userId]);

  async function updateChecklist(key: string, current: string) {
    if (!dossier) return;
    const next = current === "todo" ? "ok" : current === "ok" ? "na" : "todo";
    setUpdatingKey(key);
    try {
      await apiFetch(`/dossiers/${dossier.id}/checklist/${key}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      setDossier((prev) => prev ? { ...prev, checklistItems: prev.checklistItems.map((c) => c.key === key ? { ...c, status: next } : c) } : prev);
    } catch { setError("Impossible de mettre à jour l'élément"); }
    finally { setUpdatingKey(null); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length || !userId) return;
    setUploading(true); setError("");
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        form.append("dossierId", id);
        form.append("ownerUserId", userId);
        const doc = await fetch(`${API}/files/upload`, { method: "POST", body: form })
          .then(async (r) => { if (!r.ok) throw new Error("Erreur upload"); return r.json() as Promise<Document>; });
        setDocuments((prev) => [doc, ...prev]);
      }
    } catch { setError("Erreur lors de l'upload"); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  async function handleDeleteDoc(docId: string) {
    if (!confirm("Supprimer ce fichier ?")) return;
    try {
      await apiFetch(`/files/${docId}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch { setError("Impossible de supprimer le fichier"); }
  }

  async function handleExport() {
    if (!userId) return;
    setExporting(true); setError("");
    try {
      const res = await fetch(`${API}/exports/dossier/${id}/zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerUserId: userId }),
      });
      if (!res.ok) throw new Error("Erreur export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `filepilot-${dossier?.procedureType.slug ?? id}.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch { setError("Impossible de générer l'export ZIP"); }
    finally { setExporting(false); }
  }

  if (loading) return (
    <div className={s.shell}>
      <div className={s.loader}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 0.8s linear infinite" }} aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
        Chargement…
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!dossier) return null;

  const done = dossier.checklistItems.filter((c) => c.status === "ok" || c.status === "na").length;
  const total = dossier.checklistItems.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

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
        </nav>
        <button className={s.sidebarLogout} onClick={() => { localStorage.removeItem("user"); router.push("/login"); }} aria-label="Se déconnecter">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          Déconnexion
        </button>
      </aside>

      <main className={s.main}>
        <nav aria-label="Fil d'Ariane" className={s.breadcrumb}>
          <Link href="/dossiers" className={s.breadLink}>Mes dossiers</Link>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
          <span>{dossier.title ?? dossier.procedureType.name}</span>
        </nav>

        <div className={s.detailHeader}>
          <span className={s.detailOrg}>{dossier.procedureType.organization.name}</span>
          <h1 className={s.detailTitle}>{dossier.title ?? dossier.procedureType.name}</h1>
          <div className={s.detailMeta}>
            <span>Template v{dossier.templateVersion}</span>
            <span>Créé le {new Date(dossier.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
        </div>

        <div className={s.scoreCard}>
          <div className={s.scoreLeft}>
            <span className={s.scoreValue}>{pct}%</span>
            <span className={s.scoreLabel}>Complétude</span>
          </div>
          <div className={s.scoreRight}>
            <div className={s.scoreBar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct}% complété`}>
              <div className={s.scoreBarFill} style={{ width: `${pct}%` }} />
            </div>
            <span className={s.scoreSub}>{done} sur {total} pièces validées</span>
          </div>
          <button className={s.btnExport} onClick={handleExport} disabled={exporting || documents.length === 0} aria-label="Exporter le dossier en ZIP">
            {exporting
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>}
            Export ZIP
          </button>
        </div>

        {error && <p className={s.errorBanner} role="alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          {error}
        </p>}

        <section aria-labelledby="checklist-heading">
          <h2 className={s.sectionTitle} id="checklist-heading">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
            Checklist des pièces
          </h2>
          <ul className={s.checklist} role="list">
            {dossier.checklistItems.map((item) => (
              <li key={item.id}>
                <button
                  className={`${s.checkItem} ${item.status === "ok" ? s.checkItemOk : item.status === "na" ? s.checkItemNa : ""}`}
                  onClick={() => updateChecklist(item.key, item.status)}
                  disabled={updatingKey === item.key}
                  aria-pressed={item.status === "ok"}
                >
                  <span className={`${s.checkIcon} ${item.status === "ok" ? s.checkIconOk : item.status === "na" ? s.checkIconNa : ""}`} aria-hidden="true">
                    {item.status === "ok" && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    {item.status === "na" && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>}
                  </span>
                  <span className={s.checkLabel}>
                    {item.label}
                    {item.required && <span className={s.checkRequired} aria-label="obligatoire"> *</span>}
                  </span>
                  <span className={s.checkStatus}>{item.status === "ok" ? "Validé" : item.status === "na" ? "N/A" : "À faire"}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="docs-heading" className={s.docsSection}>
          <div className={s.docsSectionTop}>
            <h2 className={s.sectionTitle} id="docs-heading">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              Documents ({documents.length})
            </h2>
            <label className={`${s.btnUpload} ${uploading ? s.btnUploadLoading : ""}`}>
              {uploading
                ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Upload…</>
                : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>Ajouter des fichiers</>}
              <input ref={fileInputRef} type="file" multiple onChange={handleUpload} disabled={uploading} className={s.fileInputHidden} tabIndex={-1} />
            </label>
          </div>

          {documents.length === 0 ? (
            <div className={s.docsEmpty}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              <p>Aucun fichier uploadé pour ce dossier.</p>
            </div>
          ) : (
            <ul className={s.docList} role="list">
              {documents.map((doc) => (
                <li key={doc.id} className={s.docItem}>
                  <span className={s.docIcon} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  </span>
                  <span className={s.docName}>{doc.filename}</span>
                  <span className={s.docMeta}>{formatSize(doc.sizeBytes)}</span>
                  <a href={`${API}/files/${doc.id}/download`} className={s.docAction} aria-label={`Télécharger ${doc.filename}`} target="_blank" rel="noopener noreferrer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  </a>
                  <button className={s.docActionDanger} onClick={() => handleDeleteDoc(doc.id)} aria-label={`Supprimer ${doc.filename}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
