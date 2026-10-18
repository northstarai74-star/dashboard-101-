-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "config" TEXT NOT NULL DEFAULT '{}',
    "secretsEnc" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "accountLabel" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);
