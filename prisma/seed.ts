// prisma/seed.ts
import 'dotenv/config';
import { PrismaClient, Role, TransactionType } from '../generated/prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  const adminPassword = await bcrypt.hash('Admin@123', 12);
  const analystPassword = await bcrypt.hash('Analyst@123', 12);
  const viewerPassword = await bcrypt.hash('Viewer@123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@finance.dev' },
    update: {},
    create: {
      email: 'admin@finance.dev',
      password: adminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: Role.ADMIN,
    },
  });

  const analyst = await prisma.user.upsert({
    where: { email: 'analyst@finance.dev' },
    update: {},
    create: {
      email: 'analyst@finance.dev',
      password: analystPassword,
      firstName: 'Jane',
      lastName: 'Analyst',
      role: Role.ANALYST,
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@finance.dev' },
    update: {},
    create: {
      email: 'viewer@finance.dev',
      password: viewerPassword,
      firstName: 'John',
      lastName: 'Viewer',
      role: Role.VIEWER,
    },
  });

  const categories = ['Salary', 'Freelance', 'Rent', 'Utilities', 'Food', 'Transport', 'Entertainment', 'Healthcare'];
  const now = new Date();

  const transactions = [];
  for (let i = 0; i < 50; i++) {
    const isIncome = Math.random() > 0.4;
    const date = new Date(now.getFullYear(), now.getMonth() - Math.floor(Math.random() * 6), Math.floor(Math.random() * 28) + 1);
    transactions.push({
      amount: parseFloat((Math.random() * 5000 + 100).toFixed(2)),
      type: isIncome ? TransactionType.INCOME : TransactionType.EXPENSE,
      category: categories[Math.floor(Math.random() * categories.length)],
      date,
      notes: `Seeded transaction #${i + 1}`,
      userId: [admin.id, analyst.id, viewer.id][Math.floor(Math.random() * 3)],
    });
  }

  await prisma.transaction.createMany({ data: transactions });

  console.log('✅ Seed complete');
  console.log(`  Admin:    admin@finance.dev / Admin@123`);
  console.log(`  Analyst:  analyst@finance.dev / Analyst@123`);
  console.log(`  Viewer:   viewer@finance.dev / Viewer@123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
