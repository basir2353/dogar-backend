import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  console.log("Connected OK");

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  console.log("Tables:", tables.map((t) => t.tablename).join(", ") || "(none)");

  try {
    const users = await prisma.user.count();
    console.log("User count:", users);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    console.error("User query failed:", err.code, err.message);
  }

  try {
    const campaigns = await prisma.campaign.count();
    console.log("Campaign count:", campaigns);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    console.error("Campaign query failed:", err.code, err.message);
  }
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
