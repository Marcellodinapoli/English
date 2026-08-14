import fs from "fs";
import path from "path";
import type {
  LevelMeta,
  LessonContent,
  PassageContent,
} from "@/types/content";
import type {
  GrammarTopic,
  ListeningContent,
} from "@/types/listening-grammar";
import type { SpeakingContent, WritingContent } from "@/types/speaking";
import type { RoleplayScenario } from "@/types/conversation";
import type { ComprehensionSet } from "@/types/expression";
import { CEFR_ORDER } from "@/lib/cefr";

const CONTENT_ROOT = path.join(process.cwd(), "content");
const LEVELS_ROOT = path.join(CONTENT_ROOT, "levels");

function cefrRank(level: string): number {
  const upper = level.toUpperCase();
  if (upper.startsWith("ZERO")) return 0;
  const idx = CEFR_ORDER.findIndex(
    (l) => l !== "ZERO" && upper.startsWith(l)
  );
  return idx >= 0 ? idx : 99;
}

function byCefrThenId<T extends { level: string; id?: string }>(a: T, b: T) {
  const rank = cefrRank(a.level) - cefrRank(b.level);
  if (rank !== 0) return rank;
  return (a.id || "").localeCompare(b.id || "");
}

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(/* turbopackIgnore: true */ filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function listJsonDir<T>(dir: string): T[] {
  if (!fs.existsSync(/* turbopackIgnore: true */ dir)) return [];
  return fs
    .readdirSync(/* turbopackIgnore: true */ dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<T>(path.join(dir, f)));
}

function walkLessonFiles(dir: string, map: Record<string, string>) {
  if (!fs.existsSync(/* turbopackIgnore: true */ dir)) return;
  for (const entry of fs.readdirSync(/* turbopackIgnore: true */ dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(/* turbopackIgnore: true */ full).isDirectory()) {
      walkLessonFiles(full, map);
    } else if (entry.startsWith("lesson-") && entry.endsWith(".json")) {
      const lesson = readJson<{ id: string }>(full);
      if (lesson.id) map[lesson.id] = full;
    }
  }
}

function buildLessonFileMap(): Record<string, string> {
  const map: Record<string, string> = {};
  if (!fs.existsSync(/* turbopackIgnore: true */ LEVELS_ROOT)) return map;
  for (const levelFolder of fs.readdirSync(/* turbopackIgnore: true */ LEVELS_ROOT)) {
    walkLessonFiles(path.join(LEVELS_ROOT, levelFolder), map);
  }
  return map;
}

let lessonMapCache: Record<string, string> | null = null;

function lessonFileMap(): Record<string, string> {
  if (!lessonMapCache) lessonMapCache = buildLessonFileMap();
  return lessonMapCache;
}

/** Call after CMS writes lesson files (dev/admin). */
export function invalidateContentCache() {
  lessonMapCache = null;
}

export class ContentService {
  getLevels(): LevelMeta[] {
    if (!fs.existsSync(/* turbopackIgnore: true */ LEVELS_ROOT)) return [];
    return fs
      .readdirSync(/* turbopackIgnore: true */ LEVELS_ROOT)
      .map((folder) => {
        const metaPath = path.join(LEVELS_ROOT, folder, "meta.json");
        if (!fs.existsSync(/* turbopackIgnore: true */ metaPath)) return null;
        return readJson<LevelMeta>(metaPath);
      })
      .filter((l): l is LevelMeta => l !== null)
      .sort((a, b) => a.order - b.order);
  }

  getLevel(levelId: string): LevelMeta | null {
    return this.getLevels().find((l) => l.id === levelId) ?? null;
  }

  getLesson(lessonId: string): LessonContent | null {
    const map = lessonFileMap();
    const file = map[lessonId];
    if (!file || !fs.existsSync(/* turbopackIgnore: true */ file)) return null;
    return readJson<LessonContent>(file);
  }

  listAllLessonIds(): string[] {
    return Object.keys(lessonFileMap());
  }

  getPassage(contentId: string): PassageContent | null {
    const file = path.join(CONTENT_ROOT, "passages", `${contentId}.json`);
    if (!fs.existsSync(/* turbopackIgnore: true */ file)) return null;
    return readJson<PassageContent>(file);
  }

  listPassages(): PassageContent[] {
    return listJsonDir<PassageContent>(path.join(CONTENT_ROOT, "passages")).sort(
      byCefrThenId
    );
  }

  getComprehension(passageId: string): ComprehensionSet | null {
    const file = path.join(
      CONTENT_ROOT,
      "comprehension",
      `${passageId}.json`
    );
    if (!fs.existsSync(/* turbopackIgnore: true */ file)) return null;
    return readJson<ComprehensionSet>(file);
  }

  listComprehension(): ComprehensionSet[] {
    return listJsonDir<ComprehensionSet>(
      path.join(CONTENT_ROOT, "comprehension")
    );
  }

  listListening(): ListeningContent[] {
    return listJsonDir<ListeningContent>(
      path.join(CONTENT_ROOT, "listening")
    ).sort(byCefrThenId);
  }

  getListening(id: string): ListeningContent | null {
    const file = path.join(CONTENT_ROOT, "listening", `${id}.json`);
    if (!fs.existsSync(/* turbopackIgnore: true */ file)) return null;
    return readJson<ListeningContent>(file);
  }

  listGrammar(): GrammarTopic[] {
    return listJsonDir<GrammarTopic>(path.join(CONTENT_ROOT, "grammar")).sort(
      byCefrThenId
    );
  }

  getGrammar(id: string): GrammarTopic | null {
    const file = path.join(CONTENT_ROOT, "grammar", `${id}.json`);
    if (!fs.existsSync(/* turbopackIgnore: true */ file)) return null;
    return readJson<GrammarTopic>(file);
  }

  getGrammarByErrorType(errorType: string): GrammarTopic | null {
    return (
      this.listGrammar().find((g) =>
        g.relatedErrorTypes?.includes(errorType)
      ) || null
    );
  }

  getOnboardingAssessment() {
    return readJson<{
      questions: Array<{
        id: string;
        skill: string;
        prompt: string;
        options: string[];
        answer: string;
      }>;
    }>(path.join(CONTENT_ROOT, "assessments/onboarding-assessment.json"));
  }

  getFirstLessonForLevel(levelId: string): LessonContent | null {
    const level = this.getLevel(levelId);
    if (!level?.units[0]?.lessons[0]) return null;
    return this.getLesson(level.units[0].lessons[0].id);
  }

  getContentForLevel<T extends { level: string }>(
    items: T[],
    levelId: string
  ): T | null {
    return (
      items.find((l) =>
        l.level.toUpperCase().startsWith(levelId.toUpperCase())
      ) ||
      null
    );
  }

  getListeningForLevel(levelId: string): ListeningContent | null {
    return this.getContentForLevel(this.listListening(), levelId);
  }

  listSpeaking(): SpeakingContent[] {
    return listJsonDir<SpeakingContent>(
      path.join(CONTENT_ROOT, "speaking")
    ).sort(byCefrThenId);
  }

  getSpeaking(id: string): SpeakingContent | null {
    const file = path.join(CONTENT_ROOT, "speaking", `${id}.json`);
    if (!fs.existsSync(/* turbopackIgnore: true */ file)) return null;
    return readJson<SpeakingContent>(file);
  }

  getSpeakingForLevel(levelId: string): SpeakingContent | null {
    return this.getContentForLevel(this.listSpeaking(), levelId);
  }

  listWriting(): WritingContent[] {
    return listJsonDir<WritingContent>(path.join(CONTENT_ROOT, "writing")).sort(
      byCefrThenId
    );
  }

  getWriting(id: string): WritingContent | null {
    const file = path.join(CONTENT_ROOT, "writing", `${id}.json`);
    if (!fs.existsSync(/* turbopackIgnore: true */ file)) return null;
    return readJson<WritingContent>(file);
  }

  listRoleplay(): RoleplayScenario[] {
    return listJsonDir<RoleplayScenario>(
      path.join(CONTENT_ROOT, "roleplay")
    ).sort(byCefrThenId);
  }

  getRoleplay(id: string): RoleplayScenario | null {
    const file = path.join(CONTENT_ROOT, "roleplay", `${id}.json`);
    if (!fs.existsSync(/* turbopackIgnore: true */ file)) return null;
    return readJson<RoleplayScenario>(file);
  }

  getRoleplayForLevel(levelId: string): RoleplayScenario | null {
    return this.getContentForLevel(this.listRoleplay(), levelId);
  }
}

export const contentService = new ContentService();
