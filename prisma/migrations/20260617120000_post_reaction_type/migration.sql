-- AlterTable
ALTER TABLE "PostLike" ADD COLUMN IF NOT EXISTS "reactionType" TEXT NOT NULL DEFAULT 'like';
