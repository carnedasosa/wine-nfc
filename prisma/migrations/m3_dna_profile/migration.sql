-- CreateTable
CREATE TABLE "DnaProfile" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "versionHash" TEXT NOT NULL,
    "testo" TEXT NOT NULL,
    "fallback" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DnaProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DnaProfile_eventId_userId_versionHash_key" ON "DnaProfile"("eventId", "userId", "versionHash");

-- AddForeignKey
ALTER TABLE "DnaProfile" ADD CONSTRAINT "DnaProfile_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnaProfile" ADD CONSTRAINT "DnaProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
