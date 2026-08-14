-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ReviewItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "masteryScore" REAL NOT NULL DEFAULT 0,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "easeFactor" REAL NOT NULL DEFAULT 2.5,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" DATETIME NOT NULL,
    "lastReviewedAt" DATETIME,
    "lastResult" BOOLEAN,
    "skill" TEXT,
    "source" TEXT,
    "lessonId" TEXT,
    "level" TEXT,
    "difficulty" REAL,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "context" TEXT,
    "contentRef" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReviewItem" ("easeFactor", "id", "interval", "itemId", "itemType", "lastResult", "lastReviewedAt", "masteryScore", "nextReviewAt", "reviewCount", "userId") SELECT "easeFactor", "id", "interval", "itemId", "itemType", "lastResult", "lastReviewedAt", "masteryScore", "nextReviewAt", "reviewCount", "userId" FROM "ReviewItem";
DROP TABLE "ReviewItem";
ALTER TABLE "new_ReviewItem" RENAME TO "ReviewItem";
CREATE INDEX "ReviewItem_userId_nextReviewAt_idx" ON "ReviewItem"("userId", "nextReviewAt");
CREATE INDEX "ReviewItem_userId_itemType_idx" ON "ReviewItem"("userId", "itemType");
CREATE UNIQUE INDEX "ReviewItem_userId_itemType_itemId_key" ON "ReviewItem"("userId", "itemType", "itemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
