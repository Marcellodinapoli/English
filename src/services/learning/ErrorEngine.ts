export interface DetectedError {
  errorType: string;
  skill: "grammar" | "vocabulary" | "listening" | "writing" | "speaking";
  userInput: string;
  correctForm: string;
  context?: string;
  recommendation?: string;
  topic?: string;
  sourceType?: string;
}

export interface StructuredMistakeInput {
  original: string;
  correction: string;
  type: string;
  topic?: string;
  skill?: string;
  context?: string;
}

const RULES: Array<{
  test: (input: string, expected?: string) => boolean;
  build: (input: string, expected?: string) => DetectedError;
}> = [
  {
    test: (input) => /\bi go yesterday\b/i.test(input),
    build: (input) => ({
      errorType: "past_simple",
      skill: "grammar",
      userInput: input,
      correctForm: "I went yesterday.",
      recommendation: "Past Simple — basic usage (go → went)",
    }),
  },
  {
    test: (input) => /\bi am go\b/i.test(input) || /\bi am went\b/i.test(input),
    build: (input) => ({
      errorType: "to_be_with_verb",
      skill: "grammar",
      userInput: input,
      correctForm: input.replace(/am\s+(go|went)/i, "go"),
      recommendation: "Do not combine am with another main verb in simple present",
    }),
  },
  {
    test: (input) => /\bhe have\b/i.test(input) || /\bshe have\b/i.test(input),
    build: (input) => ({
      errorType: "have_has",
      skill: "grammar",
      userInput: input,
      correctForm: input.replace(/\b(he|she)\s+have\b/i, "$1 has"),
      recommendation: "Subject-verb agreement: he/she + has",
    }),
  },
  {
    test: (input) => /\bi is\b/i.test(input),
    build: (input) => ({
      errorType: "to_be_am",
      skill: "grammar",
      userInput: input,
      correctForm: input.replace(/\bi is\b/i, "I am"),
      recommendation: "to be: I + am",
    }),
  },
  {
    test: (input, expected) =>
      Boolean(expected) &&
      input.trim().toLowerCase() !== expected!.trim().toLowerCase(),
    build: (input, expected) => ({
      errorType: "accuracy",
      skill: "vocabulary",
      userInput: input,
      correctForm: expected || "",
      recommendation: "Review this item and compare with the correct form",
    }),
  },
];

export class ErrorEngine {
  fromStructuredMistake(input: StructuredMistakeInput): DetectedError {
    const skill = this.normalizeSkill(input.skill, input.type);
    const errorType =
      input.topic?.trim() ||
      input.type?.trim() ||
      "accuracy";
    return {
      errorType,
      skill,
      userInput: input.original,
      correctForm: input.correction,
      context: input.context,
      recommendation: input.topic
        ? `Review: ${input.topic.replace(/_/g, " ")}`
        : undefined,
      topic: input.topic,
      sourceType: input.type,
    };
  }

  analyzeStructured(
    mistakes: StructuredMistakeInput[],
    fallbackContext?: string
  ): DetectedError[] {
    const out: DetectedError[] = [];
    for (const m of mistakes) {
      if (!m.original?.trim() || !m.correction?.trim()) continue;
      const err = this.fromStructuredMistake({
        ...m,
        context: m.context || fallbackContext,
      });
      out.push(err);
    }
    return out;
  }

  private normalizeSkill(
    skill?: string,
    type?: string
  ): DetectedError["skill"] {
    const s = (skill || type || "").toLowerCase();
    if (s.includes("grammar")) return "grammar";
    if (s.includes("vocab")) return "vocabulary";
    if (s.includes("writing")) return "writing";
    if (s.includes("speaking")) return "speaking";
    if (s.includes("reading")) return "grammar";
    return "grammar";
  }

  analyze(userInput: string, expected?: string, context?: string): DetectedError[] {
    const errors: DetectedError[] = [];
    for (const rule of RULES) {
      if (rule.test(userInput, expected)) {
        const error = rule.build(userInput, expected);
        if (context) error.context = context;
        errors.push(error);
        // Prefer specific grammar rules over generic accuracy
        if (error.errorType !== "accuracy") break;
      }
    }
    return errors;
  }

  recommendTopics(errorTypes: string[]): string[] {
    const map: Record<string, string> = {
      past_simple: "Past Simple — basic usage",
      to_be_with_verb: "to be — forms and usage",
      have_has: "have / has",
      to_be_am: "to be — I am / he is / you are",
      accuracy: "Target vocabulary review",
    };
    return [...new Set(errorTypes.map((t) => map[t] || t))];
  }
}

export const errorEngine = new ErrorEngine();