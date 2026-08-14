-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "perceivedLevel" TEXT NOT NULL DEFAULT 'zero',
    "goal" TEXT NOT NULL DEFAULT '',
    "motivation" TEXT NOT NULL DEFAULT '',
    "dailyMinutes" INTEGER NOT NULL DEFAULT 15,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "focusSkills" TEXT NOT NULL DEFAULT '[]',
    "priorKnowledge" TEXT,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "assessmentDone" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LearningProfile" (
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

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" DATETIME,
    "totalStudyMinutes" INTEGER NOT NULL DEFAULT 0,
    "lessonsCompleted" INTEGER NOT NULL DEFAULT 0,
    "wordsLearned" INTEGER NOT NULL DEFAULT 0,
    "assessmentsTaken" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserVocabulary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "lemma" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "partOfSpeech" TEXT NOT NULL,
    "pronunciation" TEXT NOT NULL DEFAULT '',
    "phonetic" TEXT,
    "exampleSentence" TEXT NOT NULL DEFAULT '',
    "exampleTranslation" TEXT NOT NULL DEFAULT '',
    "context" TEXT,
    "level" TEXT NOT NULL DEFAULT 'A1',
    "masteryScore" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "sourceContentId" TEXT,
    "sourceTextId" TEXT,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" DATETIME,
    "nextReviewAt" DATETIME,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UserVocabulary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserMistake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "userInput" TEXT NOT NULL,
    "correctForm" TEXT NOT NULL,
    "context" TEXT,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "UserMistake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewItem" (
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
    CONSTRAINT "ReviewItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "stepResults" TEXT NOT NULL DEFAULT '[]',
    "score" REAL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "skillScores" TEXT NOT NULL,
    "determinedLevel" TEXT NOT NULL,
    "determinedSubLevel" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scenario" TEXT,
    "messages" TEXT NOT NULL DEFAULT '[]',
    "evaluation" TEXT,
    "score" REAL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ConversationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningProfile_userId_key" ON "LearningProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_key" ON "UserProgress"("userId");

-- CreateIndex
CREATE INDEX "UserVocabulary_userId_nextReviewAt_idx" ON "UserVocabulary"("userId", "nextReviewAt");

-- CreateIndex
CREATE INDEX "UserVocabulary_userId_status_idx" ON "UserVocabulary"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserVocabulary_userId_word_lemma_key" ON "UserVocabulary"("userId", "word", "lemma");

-- CreateIndex
CREATE INDEX "UserMistake_userId_errorType_idx" ON "UserMistake"("userId", "errorType");

-- CreateIndex
CREATE INDEX "UserMistake_userId_skill_idx" ON "UserMistake"("userId", "skill");

-- CreateIndex
CREATE INDEX "ReviewItem_userId_nextReviewAt_idx" ON "ReviewItem"("userId", "nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewItem_userId_itemType_itemId_key" ON "ReviewItem"("userId", "itemType", "itemId");

-- CreateIndex
CREATE INDEX "LessonProgress_userId_status_idx" ON "LessonProgress"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_userId_lessonId_key" ON "LessonProgress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_event_idx" ON "AnalyticsEvent"("userId", "event");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");
