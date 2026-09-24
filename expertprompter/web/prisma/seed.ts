// Seeds the Template table from the in-code catalog. Idempotent (upsert by key).
import { PrismaClient } from '@prisma/client';
import { TEMPLATES } from '../lib/server/services/promptTemplates';

const prisma = new PrismaClient();

async function main() {
  for (const t of TEMPLATES) {
    const baseStructure = {
      mode: t.mode,
      role: t.role,
      sections: t.sections.map((s) => ({ label: s.label, detail: s.detail })),
      defaultFormat: t.defaultFormat,
      defaultTone: t.defaultTone,
      qualityChecks: t.qualityChecks,
    };
    await prisma.template.upsert({
      where: { key: t.key },
      update: { name: t.name, category: t.category, baseStructure },
      create: { key: t.key, name: t.name, category: t.category, baseStructure, createdBy: 'SYSTEM' },
    });
  }
  console.log(`Seeded ${TEMPLATES.length} templates`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
