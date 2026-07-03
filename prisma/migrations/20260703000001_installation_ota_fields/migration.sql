-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Installation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT,
    "licenseKey" TEXT,
    "licenseStatus" TEXT NOT NULL DEFAULT 'UNLICENSED',
    "licensePlan" TEXT,
    "licenseValidUntil" DATETIME,
    "lastLicenseCheckAt" DATETIME,
    "appVersion" TEXT,
    "updateChannel" TEXT NOT NULL DEFAULT 'stable',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Installation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Installation" ("createdAt", "familyId", "id", "lastLicenseCheckAt", "licenseKey", "licensePlan", "licenseStatus", "licenseValidUntil") SELECT "createdAt", "familyId", "id", "lastLicenseCheckAt", "licenseKey", "licensePlan", "licenseStatus", "licenseValidUntil" FROM "Installation";
DROP TABLE "Installation";
ALTER TABLE "new_Installation" RENAME TO "Installation";
CREATE UNIQUE INDEX "Installation_familyId_key" ON "Installation"("familyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

