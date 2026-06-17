import { prisma } from "../config/prisma";

/**
 * Returns an existing 1:1 conversation between two users, or creates one.
 */
export async function findOrCreateDirectConversation(userIdA: string, userIdB: string) {
  const candidates = await prisma.conversation.findMany({
    where: {
      AND: [{ members: { some: { userId: userIdA } } }, { members: { some: { userId: userIdB } } }]
    },
    include: { members: true }
  });

  const match = candidates.find((c) => c.members.length === 2);
  if (match) {
    return match;
  }

  return prisma.conversation.create({
    data: {
      members: {
        create: [{ userId: userIdA }, { userId: userIdB }]
      }
    }
  });
}
