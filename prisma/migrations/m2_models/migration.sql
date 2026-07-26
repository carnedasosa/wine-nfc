-- DropForeignKey
ALTER TABLE "Tasting" DROP CONSTRAINT "Tasting_userId_fkey";

-- DropForeignKey
ALTER TABLE "Tasting" DROP CONSTRAINT "Tasting_wineId_fkey";

-- DropIndex
DROP INDEX "Tasting_userId_idx";

-- DropIndex
DROP INDEX "Tasting_wineId_idx";

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "inizio" TIMESTAMP(3) NOT NULL,
    "fine" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "stato" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventWine" (
    "eventId" TEXT NOT NULL,
    "wineId" TEXT NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "ordine" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventWine_pkey" PRIMARY KEY ("eventId","wineId")
);

-- CreateTable
CREATE TABLE "EventParticipant" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT,
    "consensoLeaderboard" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("eventId","userId")
);

-- BACKFILL LOGIC
INSERT INTO "Event" ("id", "nome", "slug", "inizio", "fine", "timezone", "stato", "createdAt")
VALUES ('legacy-event-id', 'Evento di Default (Legacy)', 'legacy-event', NOW(), NOW() + INTERVAL '10 years', 'UTC', 'active', NOW());

DELETE FROM "Tasting" T1
USING "Tasting" T2
WHERE T1."userId" = T2."userId"
  AND T1."wineId" = T2."wineId"
  AND (T1."createdAt" < T2."createdAt" OR (T1."createdAt" = T2."createdAt" AND T1.id < T2.id));

-- AlterTable
ALTER TABLE "Tasting" ADD COLUMN "eventId" TEXT NOT NULL DEFAULT 'legacy-event-id';
ALTER TABLE "Tasting" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Tasting" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Tasting" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Tasting" ALTER COLUMN "eventId" DROP DEFAULT;
ALTER TABLE "Tasting" ALTER COLUMN "updatedAt" DROP DEFAULT;

UPDATE "Tasting" SET "idempotencyKey" = gen_random_uuid()::text WHERE "idempotencyKey" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tasting_idempotencyKey_key" ON "Tasting"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Tasting_eventId_userId_createdAt_idx" ON "Tasting"("eventId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "Tasting_eventId_wineId_idx" ON "Tasting"("eventId", "wineId");

-- CreateIndex
CREATE INDEX "Tasting_eventId_createdAt_idx" ON "Tasting"("eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tasting_eventId_userId_wineId_key" ON "Tasting"("eventId", "userId", "wineId");

-- AddForeignKey
ALTER TABLE "EventWine" ADD CONSTRAINT "EventWine_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventWine" ADD CONSTRAINT "EventWine_wineId_fkey" FOREIGN KEY ("wineId") REFERENCES "Wine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tasting" ADD CONSTRAINT "Tasting_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tasting" ADD CONSTRAINT "Tasting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tasting" ADD CONSTRAINT "Tasting_wineId_fkey" FOREIGN KEY ("wineId") REFERENCES "Wine"("id") ON DELETE CASCADE ON UPDATE CASCADE;