-- CreateTable
CREATE TABLE "UserExpression" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expressionId" TEXT NOT NULL,
    "expression" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "pronunciation" TEXT NOT NULL DEFAULT '',
    "phonetic" TEXT,
    "example" TEXT NOT NULL DEFAULT '',
    "exampleTranslation" TEXT NOT NULL DEFAULT '',
    "level" TEXT NOT NULL DEFAULT 'A1',
    "category" TEXT NOT NULL DEFAULT 'phrase',
    "masteryScore" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "sourceContentId" TEXT,
    "context" TEXT,
    "metadata" TEXT,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" DATETIME,
    "nextReviewAt" DATETIME,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UserExpression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadingComprehensionAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "lessonId" TEXT,
    "totalQuestions" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "wrongCount" INTEGER NOT NULL,
    "accuracy" REAL NOT NULL,
    "durationMs" INTEGER,
    "results" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadingComprehensionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserExpression_userId_nextReviewAt_idx" ON "UserExpression"("userId", "nextReviewAt");

-- CreateIndex
CREATE INDEX "UserExpression_userId_status_idx" ON "UserExpression"("userId", "status");

-- CreateIndex
CREATE INDEX "UserExpression_userId_expressionId_idx" ON "UserExpression"("userId", "expressionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserExpression_userId_expression_key" ON "UserExpression"("userId", "expression");

-- CreateIndex
CREATE INDEX "ReadingComprehensionAttempt_userId_passageId_idx" ON "ReadingComprehensionAttempt"("userId", "passageId");

-- CreateIndex
CREATE INDEX "ReadingComprehensionAttempt_userId_createdAt_idx" ON "ReadingComprehensionAttempt"("userId", "createdAt");
