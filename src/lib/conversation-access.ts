import { prisma } from "../config/prisma";

export const isUserInConversation = async (userId: string, conversationId: string): Promise<boolean> => {
  const row = await prisma.conversationMember.findFirst({
    where: { userId, conversationId },
    select: { id: true }
  });
  return Boolean(row);
};
