-- Additive: no deletion or rewrite of existing tastings.
CREATE TABLE "TastingRequest" (
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TastingRequest_pkey" PRIMARY KEY ("idempotencyKey"),
    CONSTRAINT "TastingRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TastingRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TastingRequest_eventId_userId_idx" ON "TastingRequest"("eventId", "userId");
