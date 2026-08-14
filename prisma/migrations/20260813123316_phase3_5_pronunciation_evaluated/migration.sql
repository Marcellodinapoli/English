-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LearningProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "currentLevel" TEXT NOT NULL DEFAULT 'ZERO',
    "subLevel" REAL NOT NULL DEFAULT 0.1,
    "vocabularyScore" REAL NOT NULL DEFAULT 0,
    "grammarScore" REAL NOT NULL DEFAULT 0,
    "readingScore" REAL NOT NULL DEFAULT 0,
    "listeningScore" REAL NOT NULL DEFAULT 0,
    "speakingScore" REAL NOT NULL DEFAULT 0,
    "pronunciationScore" REAL NOT NULL DEFAULT 0,
    "pronunciationEvaluated" BOOLEAN NOT NULL DEFAULT false,
    "writingScore" REAL NOT NULL DEFAULT 0,
    "knownWordIds" TEXT NOT NULL DEFAULT '[]',
    "weakWordIds" TEXT NOT NULL DEFAULT '[]',
    "acquiredGrammarTopics" TEXT NOT NULL DEFAULT '[]',
    "problematicGrammarTopics" TEXT NOT NULL DEFAULT '[]',
    "studiedTopics" TEXT NOT NULL DEFAULT '[]',
    "topicsToConsolidate" TEXT NOT NULL DEFAULT '[]',
    "listeningWeaknesses" TEXT NOT NULL DEFAULT '[]',
    "speakingWeaknesses" TEXT NOT NULL DEFAULT '[]',
    "pronunciationWeaknesses" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearningProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LearningProfile" ("acquiredGrammarTopics", "currentLevel", "grammarScore", "id", "knownWordIds", "listeningScore", "listeningWeaknesses", "problematicGrammarTopics", "pronunciationScore", "pronunciationWeaknesses", "readingScore", "speakingScore", "speakingWeaknesses", "studiedTopics", "subLevel", "topicsToConsolidate", "updatedAt", "userId", "vocabularyScore", "weakWordIds", "writingScore") SELECT "acquiredGrammarTopics", "currentLevel", "grammarScore", "id", "knownWordIds", "listeningScore", "listeningWeaknesses", "problematicGrammarTopics", "pronunciationScore", "pronunciationWeaknesses", "readingScore", "speakingScore", "speakingWeaknesses", "studiedTopics", "subLevel", "topicsToConsolidate", "updatedAt", "userId", "vocabularyScore", "weakWordIds", "writingScore" FROM "LearningProfile";
DROP TABLE "LearningProfile";
ALTER TABLE "new_LearningProfile" RENAME TO "LearningProfile";
CREATE UNIQUE INDEX "LearningProfile_userId_key" ON "LearningProfile"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
