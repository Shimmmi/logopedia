-- AlterEnum
ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'RESCHEDULED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "a11yReduceMotion" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "ip" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Consent" ADD COLUMN IF NOT EXISTS "signedBy" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TotpBackupCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TotpBackupCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PupilContact" (
    "id" TEXT NOT NULL,
    "pupilId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Мама',
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PupilContact_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TotpBackupCode" ADD CONSTRAINT "TotpBackupCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PupilContact" ADD CONSTRAINT "PupilContact_pupilId_fkey" FOREIGN KEY ("pupilId") REFERENCES "Pupil"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Data migration: parent fields -> PupilContact
INSERT INTO "PupilContact" ("id", "pupilId", "fullName", "role", "phone", "email", "isPrimary")
SELECT
  gen_random_uuid()::text,
  p."id",
  p."parentName",
  'Мама',
  p."parentPhone",
  p."parentEmail",
  true
FROM "Pupil" p
WHERE p."parentName" IS NOT NULL
  AND p."parentName" <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "PupilContact" c WHERE c."pupilId" = p."id"
  );
