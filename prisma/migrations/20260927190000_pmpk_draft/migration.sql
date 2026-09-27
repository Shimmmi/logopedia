CREATE TABLE IF NOT EXISTS "PmpkDraft" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "encrypted" BOOLEAN NOT NULL DEFAULT true,
  "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
  "analysisError" TEXT,
  "resultJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PmpkDraft_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PmpkDraft_userId_idx" ON "PmpkDraft"("userId");
