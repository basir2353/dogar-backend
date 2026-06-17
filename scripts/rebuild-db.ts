import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";

const prisma = new PrismaClient();

async function main() {
  console.log("Dropping old public schema...");
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS public CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO postgres`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public`);
  await prisma.$disconnect();

  console.log("Applying migrations...");
  execSync("npx prisma migrate deploy", { stdio: "inherit", cwd: process.cwd() });

  console.log("Seeding...");
  execSync("npx prisma db seed", { stdio: "inherit", cwd: process.cwd() });

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
