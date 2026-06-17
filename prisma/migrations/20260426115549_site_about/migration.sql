-- CreateTable
CREATE TABLE "SiteAbout" (
    "id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteAbout_pkey" PRIMARY KEY ("id")
);
