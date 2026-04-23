import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main() {
  const prisma = new PrismaClient();
  const orgName = process.env.SEED_ORG_NAME ?? 'BisCRM Demo';
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';

  const org =
    (await prisma.organization.findFirst({ where: { name: orgName } })) ??
    (await prisma.organization.create({ data: { name: orgName } }));

  const existing = await prisma.user.findFirst({
    where: { organizationId: org.id, email },
  });

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        organizationId: org.id,
        email,
        passwordHash,
        role: Role.ADMIN,
      },
    });
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

