ALTER TABLE "Quote"
    ADD COLUMN "duration_minutes" INTEGER,
    ADD COLUMN "payment_terms" TEXT,
    ADD COLUMN "cancellation_terms" TEXT,
    ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
