-- CreateTable
CREATE TABLE "MatrimonialImage" (
    "id" TEXT NOT NULL,
    "matrimonialProfileId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isBanner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatrimonialImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatrimonialImage_matrimonialProfileId_idx" ON "MatrimonialImage"("matrimonialProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "MatrimonialImage_matrimonialProfileId_sortOrder_key" ON "MatrimonialImage"("matrimonialProfileId", "sortOrder");

-- AddForeignKey
ALTER TABLE "MatrimonialImage" ADD CONSTRAINT "MatrimonialImage_matrimonialProfileId_fkey" FOREIGN KEY ("matrimonialProfileId") REFERENCES "MatrimonialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Message (optional image on chat messages; body may be empty when image is set)
ALTER TABLE "Message" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Message" ALTER COLUMN "body" SET DEFAULT '';
