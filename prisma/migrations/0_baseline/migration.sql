-- CreateTable
CREATE TABLE "Installation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT,
    "licenseKey" TEXT,
    "licenseStatus" TEXT NOT NULL DEFAULT 'UNLICENSED',
    "licensePlan" TEXT,
    "licenseValidUntil" DATETIME,
    "lastLicenseCheckAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Installation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "weatherLat" REAL,
    "weatherLon" REAL,
    "weatherLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "emoji" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "googleEmail" TEXT,
    "googleRefreshTokenEnc" TEXT,
    "googleAccessToken" TEXT,
    "googleAccessExpiresAt" DATETIME,
    "googleSyncToken" TEXT,
    "googleSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "caldavServerUrl" TEXT,
    "caldavUsername" TEXT,
    "caldavPasswordEnc" TEXT,
    "caldavCalendarUrl" TEXT,
    "caldavCalendarName" TEXT,
    "caldavCtag" TEXT,
    "caldavSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "caldavSyncedAt" DATETIME,
    "microsoftEmail" TEXT,
    "microsoftRefreshTokenEnc" TEXT,
    "microsoftAccessToken" TEXT,
    "microsoftAccessExpiresAt" DATETIME,
    "microsoftCalendarId" TEXT,
    "microsoftDeltaLink" TEXT,
    "microsoftSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "microsoftSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Member_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'LOCAL',
    "googleEventId" TEXT,
    "googleCalendarId" TEXT,
    "caldavUid" TEXT,
    "caldavEtag" TEXT,
    "caldavHref" TEXT,
    "caldavSyncedAt" DATETIME,
    "microsoftEventId" TEXT,
    "microsoftCalendarId" TEXT,
    "microsoftEtag" TEXT,
    "microsoftSyncedAt" DATETIME,
    "color" TEXT,
    "rrule" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "masterId" TEXT NOT NULL,
    "recurrenceId" TEXT NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "description" TEXT,
    "location" TEXT,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "allDay" BOOLEAN,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventOverride_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Chore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "rrule" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Chore_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Chore_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChoreCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "choreId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChoreCompletion_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChoreCompletion_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Todo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Todo_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Todo_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "authorMemberId" TEXT,
    "body" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'sun',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Note_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Note_authorMemberId_fkey" FOREIGN KEY ("authorMemberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "servings" INTEGER,
    "prepMinutes" INTEGER,
    "cookMinutes" INTEGER,
    "instructions" TEXT,
    "sourceUrl" TEXT,
    "imageUrl" TEXT,
    "tags" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recipe_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "unit" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Ingredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "slot" TEXT NOT NULL,
    "recipeId" TEXT,
    "customName" TEXT,
    "notes" TEXT,
    "memberId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MealPlan_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MealPlan_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MealPlan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GroceryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "unit" TEXT,
    "category" TEXT,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GroceryItem_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PushSubscription_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MobileDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "fcmToken" TEXT,
    "apnsToken" TEXT,
    "lastSeenAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MobileDevice_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MobileDevice_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PairingCode" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PairingCode_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PairingCode_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Installation_familyId_key" ON "Installation"("familyId");

-- CreateIndex
CREATE INDEX "Member_familyId_idx" ON "Member"("familyId");

-- CreateIndex
CREATE INDEX "Event_familyId_startsAt_idx" ON "Event"("familyId", "startsAt");

-- CreateIndex
CREATE INDEX "Event_memberId_startsAt_idx" ON "Event"("memberId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Event_memberId_googleEventId_key" ON "Event"("memberId", "googleEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_memberId_caldavUid_key" ON "Event"("memberId", "caldavUid");

-- CreateIndex
CREATE UNIQUE INDEX "Event_memberId_microsoftEventId_key" ON "Event"("memberId", "microsoftEventId");

-- CreateIndex
CREATE INDEX "EventOverride_masterId_idx" ON "EventOverride"("masterId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOverride_masterId_recurrenceId_key" ON "EventOverride"("masterId", "recurrenceId");

-- CreateIndex
CREATE INDEX "Chore_familyId_idx" ON "Chore"("familyId");

-- CreateIndex
CREATE INDEX "ChoreCompletion_memberId_completedAt_idx" ON "ChoreCompletion"("memberId", "completedAt");

-- CreateIndex
CREATE INDEX "Todo_familyId_done_idx" ON "Todo"("familyId", "done");

-- CreateIndex
CREATE INDEX "Note_familyId_pinned_idx" ON "Note"("familyId", "pinned");

-- CreateIndex
CREATE INDEX "Photo_familyId_idx" ON "Photo"("familyId");

-- CreateIndex
CREATE INDEX "Recipe_familyId_idx" ON "Recipe"("familyId");

-- CreateIndex
CREATE INDEX "Ingredient_recipeId_idx" ON "Ingredient"("recipeId");

-- CreateIndex
CREATE INDEX "MealPlan_familyId_date_idx" ON "MealPlan"("familyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlan_familyId_date_slot_key" ON "MealPlan"("familyId", "date", "slot");

-- CreateIndex
CREATE INDEX "GroceryItem_familyId_checked_idx" ON "GroceryItem"("familyId", "checked");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_familyId_idx" ON "PushSubscription"("familyId");

-- CreateIndex
CREATE INDEX "MobileDevice_familyId_idx" ON "MobileDevice"("familyId");

-- CreateIndex
CREATE INDEX "MobileDevice_memberId_idx" ON "MobileDevice"("memberId");

-- CreateIndex
CREATE INDEX "PairingCode_familyId_idx" ON "PairingCode"("familyId");

