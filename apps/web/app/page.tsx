import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.shell}>
      {/* NAV */}
      <nav className={styles.nav}>
        <span className={styles.navBrand}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          Filepilot
        </span>
        <div className={styles.navActions}>
          <Link href="/login" className={styles.navLink}>Connexion</Link>
          <Link href="/register" className={styles.btnNav}>Commencer</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          MVP v0.1 disponible
        </div>
        <h1 className={styles.heroTitle}>Votre coffre<br/>administratif intelligent</h1>
        <p className={styles.heroSub}>
          Centralisez vos documents, suivez vos démarches (CAF, Préfecture, France Travail…)
          et exportez vos dossiers complets en un clic.
        </p>
        <div className={styles.heroActions}>
          <Link href="/register" className={styles.btnPrimary}>
            Créer mon espace gratuit
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
          <Link href="/login" className={styles.btnSecondary}>J&apos;ai déjà un compte</Link>
        </div>
      </section>

      {/* FEATURES */}
      <section className={styles.features} aria-label="Fonctionnalités">
        <div className={styles.feature}>
          <div className={styles.featureIconWrap} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <h3 className={styles.featureTitle}>Checklists guidées</h3>
          <p className={styles.featureDesc}>Chaque démarche génère automatiquement la liste des pièces à fournir selon le template officiel.</p>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIconWrap} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <h3 className={styles.featureTitle}>Upload & Organisation</h3>
          <p className={styles.featureDesc}>Déposez vos fichiers, associez-les à votre dossier. PDF, images — tout est accepté.</p>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIconWrap} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <h3 className={styles.featureTitle}>Multi-administrations</h3>
          <p className={styles.featureDesc}>CAF, Préfecture, France Travail… toutes vos procédures réunies au même endroit.</p>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIconWrap} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <h3 className={styles.featureTitle}>Export ZIP</h3>
          <p className={styles.featureDesc}>Exportez votre dossier complet avec checklist incluse pour le déposer en un clic.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} Filepilot · <Link href="/login" className={styles.footerLink}>Connexion</Link></p>
      </footer>
    </div>
  );
}
