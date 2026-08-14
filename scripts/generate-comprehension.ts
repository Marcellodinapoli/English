/**
 * Generate static reading comprehension sets for every passage.
 * Run: npx tsx scripts/generate-comprehension.ts
 */
import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "content");
const PASSAGES = path.join(ROOT, "passages");
const OUT = path.join(ROOT, "comprehension");

type Passage = {
  id: string;
  level: string;
  title: string;
  titleIt?: string;
  description?: string;
  sentences: Array<{ id: string; text: string; translation?: string }>;
  vocabularyFocus?: string[];
};

function levelBand(level: string) {
  const u = level.toUpperCase();
  if (u.startsWith("ZERO")) return "ZERO";
  if (u.startsWith("A1")) return "A1";
  if (u.startsWith("A2")) return "A2";
  if (u.startsWith("B1")) return "B1";
  if (u.startsWith("B2")) return "B2";
  if (u.startsWith("C1")) return "C1";
  return level;
}

function distractorTitles(current: Passage, all: Passage[]) {
  return all
    .filter((p) => p.id !== current.id)
    .slice(0, 8)
    .map((p) => p.title);
}

function buildSet(passage: Passage, all: Passage[]) {
  const level = levelBand(passage.level);
  const first = passage.sentences[0]?.text || "";
  const second = passage.sentences[1]?.text || first;
  const last =
    passage.sentences[passage.sentences.length - 1]?.text || first;
  const titles = distractorTitles(passage, all);
  const wrongTitle = titles[0] || "A shopping list";
  const wrongTitle2 = titles[1] || "A weather report";

  const focus = (passage.vocabularyFocus || []).filter(Boolean);
  const focusWord = focus[0] || "English";

  const questions = [
    {
      id: `${passage.id}-main`,
      passageId: passage.id,
      type: "main_idea",
      question: "What is the main idea of this text?",
      options: [
        passage.title,
        wrongTitle,
        wrongTitle2,
        "A grammar quiz with no context",
      ],
      correctAnswer: passage.title,
      explanation: `The passage is about: ${passage.title}${
        passage.description ? ` — ${passage.description}` : ""
      }`,
      skill: "reading",
      topic: "main_idea",
      level,
    },
    {
      id: `${passage.id}-detail`,
      passageId: passage.id,
      type: "detail",
      question: `Which sentence appears in the text?`,
      options: [
        first,
        "I never study English at all.",
        "The museum opens at midnight only.",
        "She bought a spaceship yesterday.",
      ],
      correctAnswer: first,
      explanation: "This sentence is taken directly from the passage.",
      skill: "reading",
      topic: "detail",
      level,
    },
    {
      id: `${passage.id}-tf`,
      passageId: passage.id,
      type: "true_false",
      question: `True or False: The text includes this idea — "${second.slice(0, 80)}${
        second.length > 80 ? "…" : ""
      }"`,
      options: ["True", "False"],
      correctAnswer: "True",
      explanation: "This information is present in the passage.",
      skill: "reading",
      topic: "true_false",
      level,
    },
    {
      id: `${passage.id}-short`,
      passageId: passage.id,
      type: "short_answer",
      question: `Complete with a word/phrase from the text focus: the passage highlights "${focusWord}". Type that focus item.`,
      correctAnswer: focusWord,
      explanation: `"${focusWord}" is a vocabulary focus of this passage.`,
      skill: "vocabulary",
      topic: "short_answer",
      level,
    },
    {
      id: `${passage.id}-detail2`,
      passageId: passage.id,
      type: "multiple_choice",
      question: "Which statement is supported by the passage?",
      options: [
        last,
        "The author says English is useless.",
        "Nobody in the text speaks or writes.",
        "The passage is only a list of numbers.",
      ],
      correctAnswer: last,
      explanation: "Choose the statement that matches the reading.",
      skill: "reading",
      topic: "detail",
      level,
    },
  ];

  return {
    passageId: passage.id,
    level,
    questions,
  };
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const files = fs.readdirSync(PASSAGES).filter((f) => f.endsWith(".json"));
  const passages: Passage[] = files.map((f) =>
    JSON.parse(fs.readFileSync(path.join(PASSAGES, f), "utf-8"))
  );

  for (const passage of passages) {
    const set = buildSet(passage, passages);
    fs.writeFileSync(
      path.join(OUT, `${passage.id}.json`),
      JSON.stringify(set, null, 2) + "\n"
    );
  }
  console.log(`Wrote ${passages.length} comprehension sets to ${OUT}`);
}

main();
