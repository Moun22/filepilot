"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  apiFetch,
  apiFetchRaw,
  clearSessionUser,
  getSessionUser,
} from "../../lib/api";
import s from "../dossiers.module.css";

const MAX_DOCS_PER_ITEM = 5;

interface ChecklistItem {
  id: string;
  key: string;
  label: string;
  required: boolean;
  status: string;
}
interface Document {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  checklistItemId: string | null;
}
interface Dossier {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  templateVersion: number;
  procedureType: { name: string; slug: string; organization: { name: string } };
  checklistItems: ChecklistItem[];
}

function formatSize(b: number) {
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`;
  return `${(b / (1024 * 1024)).toFixed(1)} Mo`;
}

function statusLabel(status: string) {
  if (status === "ok") return "Validé";
  if (status === "na") return "N/A";
  return "À faire";
}

export default function DossierDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [role, setRole] = useState<string>("user");

  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const pendingItemId = useRef<string | null>(null);
  const pendingReplaceDoc = useRef<Document | null>(null);

  useEffect(() => {
    const current = getSessionUser();
    if (!current) {
      router.push("/login");
      return;
    }
    setUserId(current.id);
    setRole(current.role);
  }, [router]);

  useEffect(() => {
    if (userId === undefined) return;
    Promise.all([
      apiFetch<Dossier>(`/dossiers/${id}`),
      apiFetch<Document[]>(`/files/dossier/${id}`),
    ])
      .then(([d, docs]) => {
        setDossier(d);
        setDocuments(docs);
      })
      .catch(() => router.push("/dossiers"))
      .finally(() => setLoading(false));
  }, [id, router, userId]);

  function setItemStatus(itemId: string | null, next: string) {
    if (!itemId) return;
    setDossier((prev) =>
      prev
        ? {
            ...prev,
            checklistItems: prev.checklistItems.map((c) =>
              c.id === itemId ? { ...c, status: next } : c,
            ),
          }
        : prev,
    );
  }

  async function updateChecklist(item: ChecklistItem) {
    if (!dossier) return;
    const next =
      item.status === "todo" ? "ok" : item.status === "ok" ? "na" : "todo";
    setUpdatingKey(item.key);
    try {
      await apiFetch(`/dossiers/${dossier.id}/checklist/${item.key}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      setItemStatus(item.id, next);
    } catch {
      setError("Impossible de mettre à jour l'élément");
    } finally {
      setUpdatingKey(null);
    }
  }

  function openAddDialog(itemId: string | null) {
    pendingItemId.current = itemId;
    addInputRef.current?.click();
  }

  function openReplaceDialog(doc: Document) {
    pendingReplaceDoc.current = doc;
    replaceInputRef.current?.click();
  }

  async function handleAddChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    const target = pendingItemId.current;
    pendingItemId.current = null;
    if (picked.length === 0) {
      if (addInputRef.current) addInputRef.current.value = "";
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const file of picked) {
        const form = new FormData();
        form.append("file", file);
        form.append("dossierId", id);
        if (target) form.append("checklistItemId", target);
        const r = await apiFetchRaw(`/files/upload`, {
          method: "POST",
          body: form,
        });
        if (!r.ok) {
          const msg = (await r.json().catch(() => null))?.message ?? "Erreur upload";
          throw new Error(msg);
        }
        const doc = (await r.json()) as Document;
        setDocuments((prev) => [doc, ...prev]);
        if (target) setItemStatus(target, "ok");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setBusy(false);
      if (addInputRef.current) addInputRef.current.value = "";
    }
  }

  async function handleReplaceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    const doc = pendingReplaceDoc.current;
    pendingReplaceDoc.current = null;
    if (!picked || !doc) {
      if (replaceInputRef.current) replaceInputRef.current.value = "";
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", picked);
      const r = await apiFetchRaw(`/files/${doc.id}/replace`, {
        method: "PUT",
        body: form,
      });
      if (!r.ok) {
        const msg = (await r.json().catch(() => null))?.message ?? "Erreur";
        throw new Error(msg);
      }
      const updated = (await r.json()) as Document;
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de remplacer le fichier");
    } finally {
      setBusy(false);
      if (replaceInputRef.current) replaceInputRef.current.value = "";
    }
  }

  async function handleDeleteDoc(doc: Document) {
    if (!confirm(`Supprimer "${doc.filename}" ?`)) return;
    setBusy(true);
    try {
      await apiFetch(`/files/${doc.id}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      if (doc.checklistItemId) {
        const remaining = documents.filter(
          (d) => d.id !== doc.id && d.checklistItemId === doc.checklistItemId,
        ).length;
        if (remaining === 0) setItemStatus(doc.checklistItemId, "todo");
      }
    } catch {
      setError("Impossible de supprimer le fichier");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadDoc(doc: Document) {
    try {
      const res = await apiFetchRaw(`/files/${doc.id}/download`);
      if (!res.ok) throw new Error("Erreur téléchargement");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Impossible de télécharger le fichier");
    }
  }

  async function handleExport() {
    if (!userId) return;
    setExporting(true);
    setError("");
    try {
      const res = await apiFetchRaw(`/exports/dossier/${id}/zip`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Erreur export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `filepilot-${dossier?.procedureType.slug ?? id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Impossible de générer l'export ZIP");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteDossier() {
    if (!confirm("Supprimer définitivement ce dossier et tous ses fichiers ?")) return;
    setDeleting(true);
    setError("");
    try {
      await apiFetch(`/dossiers/${id}`, { method: "DELETE" });
      router.push("/dossiers");
    } catch {
      setError("Impossible de supprimer le dossier");
      setDeleting(false);
    }
  }

  if (loading)
    return (
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
  const otherDocs = documents.filter((d) => !d.checklistItemId);

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
          {role === "admin" && (
            <Link href="/admin" className={s.sidebarItem}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Admin
            </Link>
          )}
        </nav>
        <button className={s.sidebarLogout} onClick={() => { clearSessionUser(); router.push("/login"); }} aria-label="Se déconnecter">
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
          <button className={s.btnDanger} onClick={handleDeleteDossier} disabled={deleting} aria-label="Supprimer définitivement le dossier">
            {deleting
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>}
            Supprimer
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
          <ul className={s.checklistCards} role="list">
            {dossier.checklistItems.map((item) => {
              const itemDocs = documents.filter((d) => d.checklistItemId === item.id);
              const canAdd = itemDocs.length < MAX_DOCS_PER_ITEM;
              const cardClass = item.status === "ok"
                ? `${s.checkCard} ${s.checkCardOk}`
                : item.status === "na"
                  ? `${s.checkCard} ${s.checkCardNa}`
                  : s.checkCard;
              return (
                <li key={item.id} className={cardClass}>
                  <div className={s.checkCardHeader}>
                    <span className={`${s.checkIcon} ${item.status === "ok" ? s.checkIconOk : item.status === "na" ? s.checkIconNa : ""}`} aria-hidden="true">
                      {item.status === "ok" && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                      {item.status === "na" && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>}
                    </span>
                    <span className={s.checkCardLabel}>
                      {item.label}
                      {item.required && <span className={s.checkRequired} aria-label="obligatoire"> *</span>}
                    </span>
                    <span className={s.checkStatus}>{statusLabel(item.status)}</span>
                    <div className={s.checkCardActions}>
                      <button
                        className={s.checkToggle}
                        onClick={() => updateChecklist(item)}
                        disabled={updatingKey === item.key}
                        aria-label={`Cycler le statut de ${item.label}`}
                        title="Cycler statut (À faire → Validé → N/A)"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
                        Statut
                      </button>
                      <button
                        className={s.checkAddBtn}
                        onClick={() => openAddDialog(item.id)}
                        disabled={busy || !canAdd}
                        aria-label={`Ajouter un document à ${item.label}`}
                        title={canAdd ? `Ajouter (${itemDocs.length}/${MAX_DOCS_PER_ITEM})` : `Limite ${MAX_DOCS_PER_ITEM} atteinte`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        {itemDocs.length}/{MAX_DOCS_PER_ITEM}
                      </button>
                    </div>
                  </div>
                  {itemDocs.length === 0 ? (
                    <p className={s.checkCardEmpty}>Aucun document attaché. Cliquez sur + pour en ajouter un.</p>
                  ) : (
                    <ul className={s.checkCardBody} role="list">
                      {itemDocs.map((doc) => (
                        <li key={doc.id} className={s.checkDoc}>
                          <span className={s.checkDocIcon} aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                          </span>
                          <span className={s.checkDocName}>{doc.filename}</span>
                          <span className={s.checkDocMeta}>{formatSize(doc.sizeBytes)}</span>
                          <div className={s.checkDocActions}>
                            <button className={s.checkDocBtn} onClick={() => handleDownloadDoc(doc)} disabled={busy} aria-label={`Télécharger ${doc.filename}`} title="Télécharger">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            </button>
                            <button className={s.checkDocBtn} onClick={() => openReplaceDialog(doc)} disabled={busy} aria-label={`Remplacer ${doc.filename}`} title="Remplacer">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            </button>
                            <button className={`${s.checkDocBtn} ${s.checkDocBtnDanger}`} onClick={() => handleDeleteDoc(doc)} disabled={busy} aria-label={`Supprimer ${doc.filename}`} title="Supprimer">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="docs-heading" className={s.docsSection}>
          <div className={s.docsSectionTop}>
            <h2 className={s.sectionTitle} id="docs-heading">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              Autres documents ({otherDocs.length})
            </h2>
            <button className={`${s.btnUpload} ${busy ? s.btnUploadLoading : ""}`} onClick={() => openAddDialog(null)} disabled={busy} aria-label="Ajouter un document non rattaché à la checklist">
              {busy
                ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Traitement…</>
                : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>Ajouter un document</>}
            </button>
          </div>

          {otherDocs.length === 0 ? (
            <div className={s.docsEmpty}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              <p>Aucun document hors checklist.</p>
            </div>
          ) : (
            <ul className={s.docList} role="list">
              {otherDocs.map((doc) => (
                <li key={doc.id} className={s.docItem}>
                  <span className={s.docIcon} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  </span>
                  <span className={s.docName}>{doc.filename}</span>
                  <span className={s.docMeta}>{formatSize(doc.sizeBytes)}</span>
                  <button onClick={() => handleDownloadDoc(doc)} className={s.docAction} aria-label={`Télécharger ${doc.filename}`} title="Télécharger">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  </button>
                  <button onClick={() => openReplaceDialog(doc)} className={s.docAction} aria-label={`Remplacer ${doc.filename}`} title="Remplacer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                  <button className={s.docActionDanger} onClick={() => handleDeleteDoc(doc)} aria-label={`Supprimer ${doc.filename}`} title="Supprimer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <input ref={addInputRef} type="file" multiple onChange={handleAddChange} className={s.fileInputHidden} tabIndex={-1} aria-hidden="true" />
        <input ref={replaceInputRef} type="file" onChange={handleReplaceChange} className={s.fileInputHidden} tabIndex={-1} aria-hidden="true" />
      </main>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
