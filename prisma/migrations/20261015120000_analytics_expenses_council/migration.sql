
-- CreateTable
CREATE TABLE "MetricEntry" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetricEntry_channel_metric_date_idx" ON "MetricEntry"("channel", "metric", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MetricEntry_channel_metric_date_source_key" ON "MetricEntry"("channel", "metric", "date", "source");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");
