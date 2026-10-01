-- CreateTable
CREATE TABLE "PointReset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "resetAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointReset_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PointReset_memberId_resetAt_idx" ON "PointReset"("memberId", "resetAt");
