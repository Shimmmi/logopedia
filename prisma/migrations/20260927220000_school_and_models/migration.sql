ALTER TYPE "FileKind" ADD VALUE IF NOT EXISTS 'SCHOOL';

CREATE TYPE "WeekParity" AS ENUM ('BOTH', 'NUMERATOR', 'DENOMINATOR');
CREATE TYPE "LessonFormat" AS ENUM ('INDIVIDUAL', 'GROUP');
CREATE TYPE "SchoolRowStatus" AS ENUM ('DRAFT', 'ACCEPTED');
CREATE TYPE "ModelKind" AS ENUM ('TEXT', 'IMAGE');

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "textModel" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "imageModel" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "protectedSubjects" TEXT NOT NULL DEFAULT 'русский язык,математика,алгебра,геометрия';

ALTER TABLE "Pupil" ADD COLUMN IF NOT EXISTS "pullFromLessons" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Pupil" ADD COLUMN IF NOT EXISTS "sessionsPerWeek" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Pupil" ADD COLUMN IF NOT EXISTS "lessonFormat" "LessonFormat" NOT NULL DEFAULT 'INDIVIDUAL';
ALTER TABLE "Pupil" ADD COLUMN IF NOT EXISTS "lessonMinutes" INTEGER NOT NULL DEFAULT 40;
ALTER TABLE "Pupil" ADD COLUMN IF NOT EXISTS "shift" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Pupil" ADD COLUMN IF NOT EXISTS "bellTemplateId" TEXT;

ALTER TABLE "AiUsage" ADD COLUMN IF NOT EXISTS "costRub" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "BellTemplate" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shift" INTEGER NOT NULL DEFAULT 1,
  "lessons" JSONB NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BellTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BellTemplate_userId_name_shift_key" ON "BellTemplate"("userId", "name", "shift");
ALTER TABLE "BellTemplate" DROP CONSTRAINT IF EXISTS "BellTemplate_userId_fkey";
ALTER TABLE "BellTemplate" ADD CONSTRAINT "BellTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "SchoolLesson" (
  "id" TEXT NOT NULL,
  "pupilId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startMin" INTEGER NOT NULL,
  "endMin" INTEGER NOT NULL,
  "subject" TEXT NOT NULL,
  "parity" "WeekParity" NOT NULL DEFAULT 'BOTH',
  "status" "SchoolRowStatus" NOT NULL DEFAULT 'DRAFT',
  "warned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolLesson_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SchoolLesson_pupilId_status_idx" ON "SchoolLesson"("pupilId", "status");
ALTER TABLE "SchoolLesson" DROP CONSTRAINT IF EXISTS "SchoolLesson_pupilId_fkey";
ALTER TABLE "SchoolLesson" ADD CONSTRAINT "SchoolLesson_pupilId_fkey" FOREIGN KEY ("pupilId") REFERENCES "Pupil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Pupil" DROP CONSTRAINT IF EXISTS "Pupil_bellTemplateId_fkey";
ALTER TABLE "Pupil" ADD CONSTRAINT "Pupil_bellTemplateId_fkey" FOREIGN KEY ("bellTemplateId") REFERENCES "BellTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "PlanModelAllow" (
  "id" TEXT NOT NULL,
  "plan" "Plan" NOT NULL,
  "modelId" TEXT NOT NULL,
  "kind" "ModelKind" NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "fallbackRub" DOUBLE PRECISION NOT NULL DEFAULT 8,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanModelAllow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanModelAllow_plan_modelId_kind_key" ON "PlanModelAllow"("plan", "modelId", "kind");
