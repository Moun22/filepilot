import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    // 0) Admin bootstrap (idempotent)
    const adminEmail = process.env.ADMIN_EMAIL ?? "admin@filepilot.local";
    const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.upsert({
        where: { email: adminEmail },
        update: { role: "admin" },
        create: { email: adminEmail, passwordHash, role: "admin" },
    });

    // 1) Organizations
    const caf = await prisma.organization.upsert({
        where: { slug: "caf" },
        update: {},
        create: { name: "CAF", slug: "caf" },
    });

    const pref = await prisma.organization.upsert({
        where: { slug: "prefecture" },
        update: {},
        create: { name: "Préfecture", slug: "prefecture" },
    });

    // 2) Procedure Types
    const apl = await prisma.procedureType.upsert({
        where: { slug: "caf-apl" },
        update: { organizationId: caf.id, name: "APL", slug: "caf-apl" },
        create: { organizationId: caf.id, name: "APL", slug: "caf-apl" },
    });

    const renewal = await prisma.procedureType.upsert({
        where: { slug: "pref-renouvellement-titre" },
        update: { organizationId: pref.id, name: "Renouvellement titre de séjour", slug: "pref-renouvellement-titre" },
        create: { organizationId: pref.id, name: "Renouvellement titre de séjour", slug: "pref-renouvellement-titre" },
    });

    // 2bis) More organizations + reusable seeder
    type OrganizationId = typeof caf.id;

    type ChecklistItem = {
        key: string;
        label: string;
        required: boolean;
        condition?: string;
        examples?: string[];
    };

    async function upsertOrg(name: string, slug: string) {
        return prisma.organization.upsert({
            where: { slug },
            update: { name, slug },
            create: { name, slug },
        });
    }

    async function seedProcedure(input: {
        organizationId: OrganizationId;
        name: string;
        slug: string;
        version?: number;
        title: string;
        sourceUrls: string[];
        checklist: ChecklistItem[];
    }) {
        const version = input.version ?? 1;

        const procedureType = await prisma.procedureType.upsert({
            where: { slug: input.slug },
            update: {
                organizationId: input.organizationId,
                name: input.name,
                slug: input.slug,
            },
            create: {
                organizationId: input.organizationId,
                name: input.name,
                slug: input.slug,
            },
        });

        // Optionnel mais propre : une seule version active par procédure
        await prisma.procedureTemplate.updateMany({
            where: {
                procedureTypeId: procedureType.id,
                version: { not: version },
            },
            data: { isActive: false },
        });

        await prisma.procedureTemplate.upsert({
            where: {
                procedureTypeId_version: {
                    procedureTypeId: procedureType.id,
                    version,
                },
            },
            update: {
                title: input.title,
                isActive: true,
                rulesJson: {
                    sourceUrls: input.sourceUrls,
                    lastCheckedAt: "2026-05-21",
                    disclaimer:
                        "Checklist générique. Les pièces exactes peuvent varier selon la situation personnelle, la nationalité, le département ou la commune.",
                    checklist: input.checklist,
                },
            },
            create: {
                procedureTypeId: procedureType.id,
                version,
                title: input.title,
                isActive: true,
                rulesJson: {
                    sourceUrls: input.sourceUrls,
                    lastCheckedAt: "2026-05-21",
                    disclaimer:
                        "Checklist générique. Les pièces exactes peuvent varier selon la situation personnelle, la nationalité, le département ou la commune.",
                    checklist: input.checklist,
                },
            },
        });

        return procedureType;
    }

    const franceTravail = await upsertOrg("France Travail", "france-travail");
    const cpam = await upsertOrg("Assurance Maladie / CPAM", "cpam");
    const ants = await upsertOrg("ANTS", "ants");
    const mdph = await upsertOrg("MDPH", "mdph");
    const logementSocial = await upsertOrg("Demande Logement Social", "logement-social");
    const mairie = await upsertOrg("Mairie / État civil", "mairie-etat-civil");
    const interieur = await upsertOrg("Ministère de l’Intérieur", "ministere-interieur");

    // 3bis) Additional procedure templates

    await seedProcedure({
        organizationId: caf.id,
        name: "APL / Aide au logement",
        slug: "caf-apl",
        version: 2,
        title: "CAF - APL / Aide au logement - checklist v2",
        sourceUrls: [
            "https://www.caf.fr/allocataires/caf-du-nord/offre-de-service/thematique-libre/les-documents-necessaires-pour-la-demande-d-aide-au-logement",
        ],
        checklist: [
            { key: "id_doc", label: "Pièce d’identité : CNI, passeport ou titre de séjour", required: true },
            { key: "carte_vitale", label: "Carte Vitale ou attestation de droits", required: true },
            { key: "lease", label: "Bail / contrat de location", required: true },
            { key: "rib", label: "RIB / IBAN", required: true },
            { key: "rent_receipt", label: "Quittance de loyer ou attestation de loyer", required: false, condition: "Si demandé par la CAF" },
            { key: "savings_statements", label: "Relevés de comptes / patrimoine / épargne", required: false, condition: "Si patrimoine ou épargne à déclarer" },
            { key: "residence_permit", label: "Titre de séjour en cours de validité", required: false, condition: "Pour les ressortissants étrangers hors UE" },
            { key: "student_certificate", label: "Certificat de scolarité", required: false, condition: "Si étudiant" },
        ],
    });

    await seedProcedure({
        organizationId: caf.id,
        name: "RSA",
        slug: "caf-rsa",
        version: 1,
        title: "CAF - RSA - checklist v1",
        sourceUrls: [
            "https://www.caf.fr/allocataires/caf-de-l-aisne/offre-de-service/pratique-drsa-docs",
            "https://www.service-public.fr/particuliers/vosdroits/F19778",
        ],
        checklist: [
            { key: "id_doc", label: "Pièce d’identité : CNI, passeport ou titre de séjour", required: true },
            { key: "carte_vitale", label: "Carte Vitale ou attestation de droits", required: true },
            { key: "mutuelle", label: "Carte de mutuelle ou attestation de droits", required: false },
            { key: "income_3_months", label: "Justificatifs de ressources des 3 derniers mois du foyer", required: true },
            { key: "payslips", label: "Bulletins de salaire", required: false, condition: "Si activité salariée récente" },
            { key: "france_travail_payments", label: "Attestations de paiement France Travail", required: false, condition: "Si chômage ou allocation" },
            { key: "cpam_indemnities", label: "Indemnités CPAM / pension invalidité / retraite", required: false, condition: "Si concerné" },
            { key: "rib", label: "RIB / IBAN", required: true },
            { key: "tax_notice", label: "Dernier avis d’imposition", required: false, condition: "Souvent demandé selon situation" },
        ],
    });

    await seedProcedure({
        organizationId: caf.id,
        name: "Prime d’activité",
        slug: "caf-prime-activite",
        version: 1,
        title: "CAF - Prime d’activité - checklist v1",
        sourceUrls: [
            "https://www.caf.fr/allocataires/caf-du-nord/offre-de-service/thematique-libre/les-documents-necessaires-pour-la-demande-de-prime-d-activite",
            "https://www.service-public.fr/particuliers/vosdroits/R42724",
        ],
        checklist: [
            { key: "id_doc", label: "Pièce d’identité", required: true },
            { key: "ssn", label: "Numéro de sécurité sociale / carte Vitale", required: true },
            { key: "rib", label: "RIB / IBAN", required: true },
            { key: "income_3_months", label: "Ressources des 3 derniers mois des personnes du foyer", required: true },
            { key: "payslips_3_months", label: "Bulletins de salaire des 3 derniers mois", required: false, condition: "Si salarié" },
            { key: "tax_notice", label: "Dernier avis d’imposition", required: false },
            { key: "tax_notice_n_2", label: "Avis d’imposition N-2", required: false, condition: "Travailleur indépendant ou revenus mobiliers/immobiliers" },
        ],
    });

    await seedProcedure({
        organizationId: franceTravail.id,
        name: "Inscription demandeur d’emploi",
        slug: "france-travail-inscription",
        version: 1,
        title: "France Travail - Inscription / réinscription - checklist v1",
        sourceUrls: [
            "https://www.service-public.fr/particuliers/vosdroits/R49998",
            "https://www.service-public.fr/particuliers/vosdroits/F24465",
        ],
        checklist: [
            { key: "id_doc", label: "Pièce d’identité", required: true },
            { key: "ssn", label: "Numéro de sécurité sociale / carte Vitale", required: true },
            { key: "proof_address", label: "Justificatif de domicile", required: true },
            { key: "residence_permit_work", label: "Titre de séjour autorisant le travail", required: false, condition: "Pour les ressortissants étrangers hors UE" },
            { key: "rib", label: "RIB / IBAN", required: true },
            { key: "cv", label: "CV", required: false },
            { key: "diplomas", label: "Diplômes et qualifications", required: false },
            { key: "work_certificates", label: "Certificats de travail", required: false, condition: "Si expérience professionnelle antérieure" },
            { key: "payslips", label: "Fiches de paie récentes", required: false, condition: "Si activité salariée récente" },
            { key: "employer_certificate", label: "Attestation employeur / attestation France Travail", required: false, condition: "Pour demande d’allocation chômage" },
            { key: "sick_leave", label: "Arrêt maladie", required: false, condition: "Si concerné" },
        ],
    });

    await seedProcedure({
        organizationId: cpam.id,
        name: "Commande carte Vitale",
        slug: "cpam-carte-vitale",
        version: 1,
        title: "Assurance Maladie - Carte Vitale - checklist v1",
        sourceUrls: [
            "https://www.ameli.fr/assure/remboursements/etre-bien-rembourse/carte-vitale/carte-vitale-application/demander-sa-carte-vitale-conditions-et-demarches",
            "https://www.service-public.fr/particuliers/vosdroits/F265",
        ],
        checklist: [
            { key: "photo_identity", label: "Photo d’identité numérisée", required: true },
            { key: "id_doc", label: "Pièce d’identité numérisée", required: true },
            { key: "ameli_account", label: "Compte Ameli actif", required: false, condition: "Pour commande en ligne" },
        ],
    });

    await seedProcedure({
        organizationId: cpam.id,
        name: "Complémentaire santé solidaire",
        slug: "cpam-css",
        version: 1,
        title: "Assurance Maladie - Complémentaire santé solidaire - checklist v1",
        sourceUrls: [
            "https://www.service-public.fr/particuliers/vosdroits/R54651",
            "https://www.service-public.fr/particuliers/vosdroits/F10027",
        ],
        checklist: [
            { key: "cerfa_12504", label: "Formulaire CSS Cerfa 12504 complété", required: true },
            { key: "id_doc", label: "Pièce d’identité du demandeur", required: true },
            { key: "household_resources", label: "Justificatifs de ressources du foyer", required: true },
            { key: "tax_notice", label: "Avis d’imposition ou de non-imposition", required: false },
            { key: "caf_number", label: "Numéro d’allocataire CAF", required: false, condition: "Si allocataire CAF" },
            { key: "rsa_attestation", label: "Attestation de ressources CAF/MSA", required: false, condition: "Si demandeur ou bénéficiaire du RSA" },
            { key: "residence_permit", label: "Titre de séjour ou justificatif de régularité", required: false, condition: "Pour les ressortissants étrangers" },
        ],
    });

    await seedProcedure({
        organizationId: logementSocial.id,
        name: "Demande de logement social",
        slug: "logement-social-demande",
        version: 1,
        title: "Logement social - Demande HLM - checklist v1",
        sourceUrls: [
            "https://www.service-public.fr/particuliers/vosdroits/F10007",
        ],
        checklist: [
            { key: "id_docs_household", label: "Pièces d’identité de toutes les personnes du foyer", required: true },
            { key: "residence_permit", label: "Titre de séjour attestant la régularité du séjour", required: false, condition: "Pour les ressortissants étrangers" },
            { key: "tax_notice", label: "Avis d’imposition / non-imposition", required: true },
            { key: "income_docs", label: "Justificatifs de revenus et ressources du foyer", required: true },
            { key: "rent_receipt", label: "Quittance de loyer", required: false, condition: "Si locataire actuel" },
            { key: "lease", label: "Bail ou justificatif de logement actuel", required: false },
            { key: "professional_status", label: "Justificatif de situation professionnelle", required: false },
            { key: "family_status", label: "Livret de famille / jugement / justificatif de situation familiale", required: false },
            { key: "priority_reason", label: "Documents justifiant l’urgence ou la priorité", required: false, condition: "Handicap, expulsion, logement insalubre, violences, etc." },
        ],
    });

    await seedProcedure({
        organizationId: mdph.id,
        name: "Dossier MDPH",
        slug: "mdph-demande-droits",
        version: 1,
        title: "MDPH - Demande ou renouvellement de droits - checklist v1",
        sourceUrls: [
            "https://www.service-public.fr/particuliers/vosdroits/R19993",
        ],
        checklist: [
            { key: "cerfa_15692", label: "Formulaire MDPH Cerfa 15692 complété", required: true },
            { key: "medical_certificate", label: "Certificat médical MDPH de moins de 1 an", required: true },
            { key: "id_doc", label: "Photocopie recto-verso d’un justificatif d’identité", required: true },
            { key: "proof_address", label: "Justificatif de domicile", required: true },
            { key: "host_certificate", label: "Attestation d’hébergement + justificatif de l’hébergeant", required: false, condition: "Si hébergé par un tiers" },
            { key: "legal_protection", label: "Jugement de protection juridique", required: false, condition: "Si tutelle, curatelle ou protection juridique" },
            { key: "school_work_medical_docs", label: "Bilans médicaux, scolaires ou professionnels complémentaires", required: false },
        ],
    });

    await seedProcedure({
        organizationId: ants.id,
        name: "Renouvellement carte d’identité majeur",
        slug: "ants-renouvellement-cni-majeur",
        version: 1,
        title: "ANTS / Mairie - Renouvellement CNI majeur - checklist v1",
        sourceUrls: [
            "https://www.service-public.fr/particuliers/vosdroits/F21089",
        ],
        checklist: [
            { key: "current_id_card", label: "Carte nationale d’identité actuelle", required: true },
            { key: "passport", label: "Passeport", required: false, condition: "Si disponible ou demandé selon situation" },
            { key: "photo_identity", label: "Photo d’identité de moins de 6 mois conforme aux normes", required: true },
            { key: "proof_address", label: "Justificatif de domicile de moins de 1 an", required: true },
            { key: "predemande", label: "Numéro de pré-demande ou QR code ANTS", required: false, condition: "Si pré-demande faite en ligne" },
            { key: "birth_certificate", label: "Acte de naissance", required: false, condition: "Si aucune pièce d’identité récente ne suffit" },
            { key: "loss_theft_declaration", label: "Déclaration de perte ou de vol", required: false, condition: "Si carte perdue ou volée" },
        ],
    });

    await seedProcedure({
        organizationId: ants.id,
        name: "Renouvellement passeport majeur",
        slug: "ants-renouvellement-passeport-majeur",
        version: 1,
        title: "ANTS / Mairie - Renouvellement passeport majeur - checklist v1",
        sourceUrls: [
            "https://www.service-public.fr/particuliers/vosdroits/F21091",
        ],
        checklist: [
            { key: "current_passport", label: "Passeport actuel", required: true },
            { key: "photo_identity", label: "Photo d’identité de moins de 6 mois conforme aux normes", required: true },
            { key: "proof_address", label: "Justificatif de domicile", required: true },
            { key: "tax_stamp", label: "Timbre fiscal électronique", required: true },
            { key: "predemande", label: "Numéro de pré-demande ou QR code ANTS", required: false, condition: "Si pré-demande faite en ligne" },
            { key: "id_card", label: "Carte nationale d’identité", required: false, condition: "Selon situation" },
            { key: "loss_theft_declaration", label: "Déclaration de perte ou de vol", required: false, condition: "Si passeport perdu ou volé" },
        ],
    });

    await seedProcedure({
        organizationId: ants.id,
        name: "Carte grise véhicule d’occasion",
        slug: "ants-carte-grise-vehicule-occasion",
        version: 1,
        title: "ANTS - Certificat d’immatriculation véhicule d’occasion - checklist v1",
        sourceUrls: [
            "https://www.service-public.fr/particuliers/vosdroits/F1050",
            "https://www.service-public.fr/particuliers/vosdroits/R13567",
        ],
        checklist: [
            { key: "cerfa_13750", label: "Formulaire Cerfa 13750 de demande d’immatriculation", required: true },
            { key: "proof_address", label: "Justificatif de domicile de moins de 6 mois", required: true },
            { key: "old_registration", label: "Ancienne carte grise barrée, datée et signée par le vendeur", required: true },
            { key: "cession_certificate", label: "Certificat de cession du véhicule", required: true },
            { key: "technical_control", label: "Contrôle technique en cours de validité", required: false, condition: "Si véhicule concerné" },
            { key: "id_doc", label: "Justificatif d’identité", required: true },
            { key: "insurance_attestation", label: "Attestation d’assurance du véhicule", required: true },
            { key: "driving_license", label: "Permis de conduire correspondant à la catégorie du véhicule", required: true },
        ],
    });

    await seedProcedure({
        organizationId: ants.id,
        name: "Échange de permis étranger hors UE",
        slug: "ants-echange-permis-etranger-hors-ue",
        version: 1,
        title: "ANTS - Échange permis étranger hors UE - checklist v1",
        sourceUrls: [
            "https://www.service-public.fr/particuliers/vosdroits/F1460",
        ],
        checklist: [
            { key: "foreign_license", label: "Permis de conduire étranger original, recto-verso", required: true },
            { key: "translation", label: "Traduction officielle du permis", required: false, condition: "Si le permis n’est pas rédigé en français" },
            { key: "id_doc", label: "Justificatif d’identité", required: true },
            { key: "proof_address", label: "Justificatif de domicile de moins de 6 mois", required: true },
            { key: "residence_permit", label: "Titre de séjour ou justificatif de régularité", required: false, condition: "Pour les ressortissants étrangers" },
            { key: "arrival_date_proof", label: "Justificatif de date d’arrivée en France", required: true },
            { key: "residence_in_issuing_country", label: "Preuve de résidence normale dans le pays de délivrance du permis", required: false, condition: "Si vous n’avez pas la nationalité du pays qui a délivré le permis" },
            { key: "ephoto", label: "Photo-signature numérique / e-photo", required: true },
        ],
    });

    await seedProcedure({
        organizationId: pref.id,
        name: "Changement d’adresse titre de séjour",
        slug: "pref-changement-adresse-titre-sejour",
        version: 1,
        title: "ANEF / Préfecture - Changement d’adresse titre de séjour - checklist v1",
        sourceUrls: [
            "https://www.service-public.fr/particuliers/vosdroits/F35807",
        ],
        checklist: [
            { key: "current_permit", label: "Titre de séjour actuel", required: true },
            { key: "passport_pages", label: "Passeport : pages état civil, validité et cachets d’entrée", required: true },
            { key: "proof_address", label: "Justificatif de domicile de moins de 3 mois", required: true },
        ],
    });

    await seedProcedure({
        organizationId: pref.id,
        name: "Renouvellement titre de séjour étudiant",
        slug: "pref-renouvellement-titre-etudiant",
        version: 1,
        title: "ANEF / Préfecture - Renouvellement titre étudiant - checklist v1",
        sourceUrls: [
            "https://www.service-public.fr/particuliers/vosdroits/F2231",
        ],
        checklist: [
            { key: "current_permit_or_vls", label: "Visa long séjour ou titre de séjour en cours de validité", required: true },
            { key: "passport_pages", label: "Passeport : pages état civil, validité, visas et cachets", required: true },
            { key: "proof_address", label: "Justificatif de domicile de moins de 6 mois", required: true },
            { key: "ephoto", label: "Code e-photo", required: true },
            { key: "school_enrollment", label: "Inscription ou préinscription dans l’établissement d’enseignement", required: true },
            { key: "grades_previous_year", label: "Relevés de notes de l’année écoulée", required: true },
            { key: "last_diploma_france", label: "Dernier diplôme obtenu en France", required: false },
            { key: "resources", label: "Justificatifs de ressources suffisantes", required: true },
            { key: "third_party_support", label: "Attestation de prise en charge + justificatif d’identité du tiers", required: false, condition: "Si prise en charge par un tiers" },
            { key: "payslips", label: "3 dernières fiches de paie", required: false, condition: "Si l’étudiant travaille" },
        ],
    });

    await seedProcedure({
        organizationId: mairie.id,
        name: "PACS",
        slug: "mairie-pacs",
        version: 1,
        title: "Mairie / Notaire - PACS - checklist v1",
        sourceUrls: [
            "https://www.service-public.fr/particuliers/vosdroits/F1618",
            "https://www.service-public.fr/simulateur/calcul/ListeDocumentsPourUnPacs",
        ],
        checklist: [
            { key: "cerfa_15725", label: "Déclaration conjointe de PACS Cerfa 15725", required: true },
            { key: "pacs_agreement", label: "Convention de PACS", required: true },
            { key: "id_partner_1", label: "Pièce d’identité du partenaire 1", required: true },
            { key: "id_partner_2", label: "Pièce d’identité du partenaire 2", required: true },
            { key: "birth_certificate_partner_1", label: "Acte de naissance du partenaire 1", required: true },
            { key: "birth_certificate_partner_2", label: "Acte de naissance du partenaire 2", required: true },
            { key: "common_address_statement", label: "Attestation sur l’honneur de résidence commune", required: true },
            { key: "non_pacs_certificate", label: "Certificat de non-PACS", required: false, condition: "Pour certains partenaires étrangers nés à l’étranger" },
            { key: "custom_certificate", label: "Certificat de coutume", required: false, condition: "Pour certains partenaires étrangers" },
            { key: "translation_legalization", label: "Traduction ou légalisation/apostille des actes étrangers", required: false, condition: "Si acte étranger" },
        ],
    });

    await seedProcedure({
        organizationId: interieur.id,
        name: "Naturalisation française par décret",
        slug: "interieur-naturalisation-decret",
        version: 1,
        title: "Ministère de l’Intérieur - Naturalisation par décret - checklist v1",
        sourceUrls: [
            "https://www.service-public.fr/particuliers/vosdroits/R16995",
            "https://www.service-public.fr/simulateur/calcul/Naturalisation",
        ],
        checklist: [
            { key: "photos", label: "2 photos d’identité format 35 x 45 mm", required: true },
            { key: "id_doc", label: "Document officiel d’identité : passeport ou titre de séjour", required: true },
            { key: "civil_status", label: "Justificatifs d’état civil", required: true },
            { key: "nationality_docs", label: "Justificatifs de nationalité d’origine", required: true },
            { key: "proof_address", label: "Justificatifs de domicile", required: true },
            { key: "resources", label: "Justificatifs de ressources", required: true },
            { key: "tax_docs", label: "Justificatifs fiscaux / avis d’imposition", required: true },
            { key: "french_language", label: "Diplôme ou attestation de niveau de français", required: true },
            { key: "civic_exam", label: "Attestation de réussite à l’examen civique", required: true },
            { key: "family_docs", label: "Actes de mariage, divorce, naissance des enfants", required: false, condition: "Selon situation familiale" },
            { key: "translations", label: "Traductions assermentées des documents étrangers", required: false, condition: "Si documents étrangers non rédigés en français" },
        ],
    });

    // 3) Templates v1 (rulesJson minimal)
    await prisma.procedureTemplate.upsert({
        where: { procedureTypeId_version: { procedureTypeId: apl.id, version: 1 } },
        update: { isActive: true },
        create: {
            procedureTypeId: apl.id,
            version: 1,
            title: "CAF APL - checklist v1",
            isActive: true,
            rulesJson: {
                checklist: [
                    { key: "id_doc", label: "Pièce d’identité (CNI/Passeport/Titre)", required: true },
                    { key: "proof_address", label: "Justificatif de domicile < 3 mois", required: true },
                    { key: "rent_receipt", label: "Quittance de loyer / Attestation d’hébergement", required: true },
                    { key: "income", label: "Justificatifs de ressources", required: true }
                ]
            }
        }
    });

    await prisma.procedureTemplate.upsert({
        where: { procedureTypeId_version: { procedureTypeId: renewal.id, version: 1 } },
        update: { isActive: true },
        create: {
            procedureTypeId: renewal.id,
            version: 1,
            title: "Préfecture - Renouvellement titre - checklist v1",
            isActive: true,
            rulesJson: {
                checklist: [
                    { key: "passport", label: "Passeport (pages identité + tampons)", required: true },
                    { key: "current_permit", label: "Titre de séjour actuel", required: true },
                    { key: "proof_address", label: "Justificatif de domicile < 3 mois", required: true },
                    { key: "photos", label: "Photos d’identité", required: true },
                    { key: "work_contract", label: "Contrat / attestation employeur", required: false }
                ]
            }
        }
    });

    console.log("✅ Seed done");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => prisma.$disconnect());