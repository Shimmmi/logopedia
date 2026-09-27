-- AlterEnum
ALTER TYPE "FileKind" ADD VALUE IF NOT EXISTS 'PMPK';

-- AlterEnum
ALTER TYPE "AnalysisSource" ADD VALUE IF NOT EXISTS 'PMPK';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AnalysisStatus" AS ENUM ('NONE', 'QUEUED', 'RUNNING', 'DONE', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PicturePosition" AS ENUM ('START', 'MIDDLE', 'END');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ImageSetKind" AS ENUM ('SOUND_CARDS', 'ODD_ONE', 'LOTO', 'COLORING', 'STORY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ImageJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiPmpkConsentAt" TIMESTAMP(3);

ALTER TABLE "PupilContact" ADD COLUMN IF NOT EXISTS "links" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "PupilAttachment" ADD COLUMN IF NOT EXISTS "textEnc" TEXT;
ALTER TABLE "PupilAttachment" ADD COLUMN IF NOT EXISTS "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "PupilAttachment" ADD COLUMN IF NOT EXISTS "analysisError" TEXT;
ALTER TABLE "PupilAttachment" ADD COLUMN IF NOT EXISTS "analysisId" TEXT;
ALTER TABLE "PupilAttachment" ADD COLUMN IF NOT EXISTS "encrypted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "encrypted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AiUsage" ADD COLUMN IF NOT EXISTS "imagesCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PictureWord" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "word" TEXT NOT NULL,
    "sound" TEXT NOT NULL,
    "position" "PicturePosition" NOT NULL,
    "syllables" INTEGER NOT NULL DEFAULT 1,
    "ageFrom" INTEGER NOT NULL DEFAULT 5,
    "promptEn" TEXT NOT NULL,
    "descriptionRu" TEXT NOT NULL,
    "sounds" TEXT[],
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PictureWord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PictureWord_sound_position_idx" ON "PictureWord"("sound", "position");

CREATE TABLE IF NOT EXISTS "AiImageSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pupilId" TEXT,
    "kind" "ImageSetKind" NOT NULL,
    "params" JSONB NOT NULL,
    "status" "ImageJobStatus" NOT NULL DEFAULT 'QUEUED',
    "seed" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiImageSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiImage" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "word" TEXT,
    "promptEn" TEXT NOT NULL,
    "filePath" TEXT,
    "modelUsed" TEXT,
    "status" "ImageJobStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PictureWord" ADD CONSTRAINT "PictureWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AiImageSet" ADD CONSTRAINT "AiImageSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AiImageSet" ADD CONSTRAINT "AiImageSet_pupilId_fkey" FOREIGN KEY ("pupilId") REFERENCES "Pupil"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AiImage" ADD CONSTRAINT "AiImage_setId_fkey" FOREIGN KEY ("setId") REFERENCES "AiImageSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AiImage" ADD CONSTRAINT "AiImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
