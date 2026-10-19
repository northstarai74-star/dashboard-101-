-- CreateTable
CREATE TABLE "DebateResult" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'offline',
    "verdict" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "advisors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebateResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DebateResult_createdAt_idx" ON "DebateResult"("createdAt");
