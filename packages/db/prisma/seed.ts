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