import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

/**
 * Minimal bootstrap: one admin account. All other users, campaigns, and posts are created in the app.
 */
async function main() {
  const passwordHash = await bcrypt.hash("Password@123", 10);

  await prisma.user.upsert({
    where: { email: "admin@dogar.org" },
    update: {},
    create: {
      email: "admin@dogar.org",
      passwordHash,
      role: UserRole.ADMIN,
      profile: {
        create: {
          fullName: "Administrator",
          city: "—",
          bio: "Use this account to manage the platform. Add content and users through the app."
        }
      }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
