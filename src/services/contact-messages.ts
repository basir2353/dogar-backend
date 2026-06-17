import { z } from "zod";
import { ContactMessageStatus } from "@prisma/client";
import { prisma } from "../config/prisma";

export const contactSubmitSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional(),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(5000)
});

export async function createContactMessage(
  input: z.infer<typeof contactSubmitSchema>,
  userId?: string
) {
  return prisma.contactMessage.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone?.trim() || null,
      subject: input.subject,
      message: input.message,
      userId: userId ?? null,
      status: ContactMessageStatus.NEW
    }
  });
}

export async function listContactMessages(options?: { status?: ContactMessageStatus; limit?: number }) {
  const take = Math.min(200, Math.max(1, options?.limit ?? 100));
  return prisma.contactMessage.findMany({
    where: options?.status ? { status: options.status } : undefined,
    orderBy: { createdAt: "desc" },
    take
  });
}

export async function countNewContactMessages() {
  return prisma.contactMessage.count({ where: { status: ContactMessageStatus.NEW } });
}

export async function updateContactMessageStatus(id: string, status: ContactMessageStatus) {
  return prisma.contactMessage.update({
    where: { id },
    data: { status }
  });
}

export async function deleteContactMessage(id: string) {
  return prisma.contactMessage.delete({ where: { id } });
}
