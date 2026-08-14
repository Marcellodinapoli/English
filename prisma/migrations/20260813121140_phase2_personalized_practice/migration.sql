-- CreateTable
CREATE TABLE "PersonalizedExerciseAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "accuracy" REAL NOT NULL,
    "durationMs" INTEGER,
    "provider" TEXT NOT NULL DEFAULT 'rule',
    "items" TEXT NOT NULL DEFAULT '[]',
    "results" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonalizedExerciseAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PersonalizedExerciseAttempt_userId_createdAt_idx" ON "PersonalizedExerciseAttempt"("userId", "createdAt");
