import { contentService } from "@/services/content/ContentService";
import { expressionService } from "@/services/content/ExpressionService";
import { comprehensionToExercise } from "@/lib/comprehension";
import type { ExerciseItem } from "@/types/content";
import type {
  ExerciseGenerationContext,
  ExerciseProvider,
  PedagogicalExerciseType,
  PersonalizedExercise,
  RankedExerciseTarget,
} from "@/types/practice";
import { makeCloze, pickDistractors, stableShuffle } from "./ExerciseProvider";

export class RuleBasedExerciseProvider implements ExerciseProvider {
  readonly id = "rule" as const;

  async generate(ctx: ExerciseGenerationContext): Promise<PersonalizedExercise[]> {
    const out: PersonalizedExercise[] = [];
    const used = new Set<string>();

    for (const target of ctx.targets) {
      if (out.length >= ctx.count) break;
      const item = this.fromTarget(target, ctx, used);
      if (!item) continue;
      used.add(target.id);
      out.push(item);
    }

    if (out.length < ctx.count) {
      const extra = this.matchingExercise(ctx, used);
      if (extra) out.push(extra);
    }

    return out.slice(0, ctx.count);
  }

  fromTarget(
    target: RankedExerciseTarget,
    ctx: ExerciseGenerationContext,
    used: Set<string>
  ): PersonalizedExercise | null {
    if (target.itemType === "EXPRESSION") {
      return this.expressionExercise(target);
    }
    if (target.itemType === "VOCABULARY") {
      return this.vocabExercise(target);
    }
    if (target.itemType === "MISTAKE") {
      return this.mistakeExercise(target);
    }
    if (target.itemType === "GRAMMAR") {
      return this.grammarTopicExercise(target);
    }
    if (target.itemType === "SENTENCE") {
      return this.sentenceExercise(target);
    }
    if (target.itemType === "SKILL" && target.skill === "reading") {
      return this.readingSkillExercise(target, ctx.userLevel);
    }
    if (target.itemType === "SKILL" && target.skill === "grammar") {
      return this.levelGrammarExercise(target, ctx.userLevel);
    }
    if (target.itemType === "CONTENT") {
      return this.newContentExercise(target);
    }
    if (target.itemType === "SKILL" && !used.has("vocab-fallback")) {
      const vocab = ctx.targets.find((t) => t.itemType === "VOCABULARY");
      if (vocab) return this.vocabExercise(vocab);
    }
    return null;
  }

  private wrap(
    target: RankedExerciseTarget,
    pedagogicalType: PedagogicalExerciseType,
    exercise: ExerciseItem
  ): PersonalizedExercise {
    return {
      id: exercise.id,
      provider: "rule",
      pedagogicalType,
      exercise,
      target,
    };
  }

  private vocabExercise(target: RankedExerciseTarget): PersonalizedExercise | null {
    const word = String(target.payload.word || target.label || "");
    const translation = String(target.payload.translation || "");
    const example = String(target.payload.example || "");
    if (!word) return null;

    const cloze = makeCloze(example, word);
    if (cloze) {
      return this.wrap(target, "vocabulary_in_context", {
        id: `px-vocab-cloze-${target.itemId}`,
        type: "fill_blank",
        prompt: `Complete with the missing word:\n${cloze}`,
        answer: word,
        explanation: translation
          ? `"${word}" → ${translation}`
          : `The missing word is "${word}".`,
      });
    }

    if (translation) {
      const options = stableShuffle(
        [translation, ...pickDistractors(translation, [], `v-${target.itemId}`, 3)],
        `v-opt-${target.itemId}`
      );
      return this.wrap(target, "translation", {
        id: `px-vocab-tr-${target.itemId}`,
        type: "multiple_choice",
        prompt: `What does "${word}" mean?`,
        options,
        answer: translation,
        explanation: example || undefined,
      });
    }

    return this.wrap(target, "true_false", {
      id: `px-vocab-tf-${target.itemId}`,
      type: "multiple_choice",
      prompt: `True or False: "${word}" is an English word you saved to review.`,
      options: ["True", "False"],
      answer: "True",
    });
  }

  private expressionExercise(
    target: RankedExerciseTarget
  ): PersonalizedExercise | null {
    const expression = String(target.payload.expression || target.label || "");
    const translation = String(target.payload.translation || "");
    const example = String(target.payload.example || "");
    if (!expression) return null;

    const cloze = makeCloze(example, expression);
    if (cloze) {
      return this.wrap(target, "expression_in_context", {
        id: `px-expr-cloze-${target.itemId}`,
        type: "fill_blank",
        prompt: `Complete with the expression:\n${cloze}`,
        answer: expression,
        explanation: translation
          ? `"${expression}" → ${translation}`
          : undefined,
      });
    }

    if (translation) {
      const options = stableShuffle(
        [
          translation,
          ...pickDistractors(translation, [], `e-${target.itemId}`, 3),
        ],
        `e-opt-${target.itemId}`
      );
      return this.wrap(target, "translation", {
        id: `px-expr-tr-${target.itemId}`,
        type: "multiple_choice",
        prompt: `What does the expression "${expression}" mean?`,
        options,
        answer: translation,
        explanation: example || undefined,
      });
    }

    return null;
  }

  private mistakeExercise(
    target: RankedExerciseTarget
  ): PersonalizedExercise | null {
    const skill = target.skill;
    const correct = String(target.payload.correctForm || "");
    const input = String(target.payload.userInput || "");
    const errorType = String(target.payload.errorType || "");
    const context = String(target.payload.context || "");

    if (skill === "reading") {
      const passageId = context.match(/^[a-z0-9-]+$/) ? context : undefined;
      const set = passageId
        ? contentService.getComprehension(passageId)
        : null;
      const question =
        set?.questions.find((q) => q.id === context) ||
        set?.questions.find((q) => q.question === context) ||
        set?.questions[0];
      if (question) {
        const exercise = comprehensionToExercise(question);
        return this.wrap(target, "reading_comprehension", {
          ...exercise,
          id: `px-read-${target.itemId}-${exercise.id}`,
        });
      }
      if (correct) {
        return this.wrap(target, "reading_comprehension", {
          id: `px-read-short-${target.itemId}`,
          type: "fill_blank",
          prompt: context
            ? `Reading: ${context}\nType the correct answer.`
            : "Type the correct answer from the reading.",
          answer: correct,
        });
      }
    }

    const topic = contentService.getGrammarByErrorType(errorType);
    if (topic?.exercises[0]) {
      const ex = topic.exercises[0];
      return this.wrap(target, "grammar_correction", {
        ...ex,
        id: `px-gr-topic-${target.itemId}-${ex.id}`,
      });
    }

    if (correct && input && input.toLowerCase() !== correct.toLowerCase()) {
      const options = stableShuffle(
        [correct, input, ...pickDistractors(correct, [], `m-${target.itemId}`, 2)],
        `m-opt-${target.itemId}`
      ).slice(0, 4);
      return this.wrap(target, "grammar_correction", {
        id: `px-gr-fix-${target.itemId}`,
        type: "multiple_choice",
        prompt: `Choose the correct form.\nYou wrote: "${input}"`,
        options,
        answer: correct,
        explanation: errorType ? `Focus: ${errorType}` : undefined,
      });
    }

    if (correct) {
      return this.wrap(target, "sentence_completion", {
        id: `px-fix-blank-${target.itemId}`,
        type: "fill_blank",
        prompt: input
          ? `Correct this: ${input}`
          : "Write the correct form.",
        answer: correct,
      });
    }

    return null;
  }

  private grammarTopicExercise(
    target: RankedExerciseTarget
  ): PersonalizedExercise | null {
    const topic = contentService.getGrammar(target.itemId);
    const ex = topic?.exercises[0];
    if (!ex) return this.levelGrammarExercise(target, target.level || "A1");
    return this.wrap(target, "grammar_correction", {
      ...ex,
      id: `px-topic-${target.itemId}-${ex.id}`,
    });
  }

  private levelGrammarExercise(
    target: RankedExerciseTarget,
    userLevel: string
  ): PersonalizedExercise | null {
    const topics = contentService.listGrammar();
    const match =
      topics.find((t) =>
        t.level.toUpperCase().startsWith(userLevel.toUpperCase())
      ) || topics[0];
    const ex = match?.exercises[0];
    if (!ex || !match) return null;
    return this.wrap(target, "grammar_correction", {
      ...ex,
      id: `px-lvl-gr-${match.id}-${ex.id}`,
    });
  }

  private sentenceExercise(
    target: RankedExerciseTarget
  ): PersonalizedExercise | null {
    const sentence = String(
      target.payload.sentence || target.payload.context || target.label || ""
    );
    const translation = String(target.payload.translation || "");
    if (translation) {
      return this.wrap(target, "translation", {
        id: `px-sent-tr-${target.itemId}`,
        type: "fill_blank",
        prompt: `Translate:\n${sentence}`,
        answer: translation,
      });
    }
    if (sentence) {
      return this.wrap(target, "true_false", {
        id: `px-sent-tf-${target.itemId}`,
        type: "multiple_choice",
        prompt: `True or False: this sentence appeared in your review — "${sentence}"`,
        options: ["True", "False"],
        answer: "True",
      });
    }
    return null;
  }

  private readingSkillExercise(
    target: RankedExerciseTarget,
    userLevel: string
  ): PersonalizedExercise | null {
    const passages = contentService.listPassages();
    const passage =
      passages.find((p) =>
        p.level.toUpperCase().startsWith(userLevel.toUpperCase())
      ) || passages[0];
    if (!passage) return null;
    const set = contentService.getComprehension(passage.id);
    const q = set?.questions[0];
    if (!q) return null;
    const exercise = comprehensionToExercise(q);
    return this.wrap(target, "reading_comprehension", {
      ...exercise,
      id: `px-skill-read-${passage.id}-${exercise.id}`,
    });
  }

  private newContentExercise(
    target: RankedExerciseTarget
  ): PersonalizedExercise | null {
    const focus = String(target.payload.focus || target.label || "");
    const passageId = String(target.payload.passageId || target.itemId);
    const passage = contentService.getPassage(passageId);
    if (!passage || !focus) return null;

    const token = passage.sentences
      .flatMap((s) => s.tokens)
      .find((t) => t.word.toLowerCase() === focus.toLowerCase());
    const translation = token?.meanings[0]?.translation;
    if (translation) {
      const options = stableShuffle(
        [translation, ...pickDistractors(translation, [], `c-${focus}`, 3)],
        `c-opt-${focus}`
      );
      return this.wrap(target, "multiple_choice", {
        id: `px-new-${passage.id}-${focus}`,
        type: "multiple_choice",
        prompt: `From “${passage.title}”: what does "${focus}" mean?`,
        options,
        answer: translation,
      });
    }

    const catalog = expressionService.findBySurface(focus);
    if (catalog) {
      return this.wrap(target, "expression_in_context", {
        id: `px-new-expr-${catalog.id}`,
        type: "fill_blank",
        prompt: `Complete:\n${makeCloze(catalog.example, catalog.expression) || catalog.example}`,
        answer: catalog.expression,
        explanation: catalog.translation,
      });
    }

    return this.wrap(target, "true_false", {
      id: `px-new-tf-${passage.id}-${focus}`,
      type: "multiple_choice",
      prompt: `True or False: "${focus}" appears in “${passage.title}”.`,
      options: ["True", "False"],
      answer: "True",
    });
  }

  private matchingExercise(
    ctx: ExerciseGenerationContext,
    used: Set<string>
  ): PersonalizedExercise | null {
    const words = ctx.targets.filter(
      (t) =>
        t.itemType === "VOCABULARY" &&
        t.payload.word &&
        t.payload.translation &&
        !used.has(t.id)
    );
    if (words.length < 3) return null;
    const trio = words.slice(0, 3);
    const left = trio.map((t) => String(t.payload.word));
    const answer = trio.map((t) => String(t.payload.translation));
    return {
      id: `px-match-${trio.map((t) => t.itemId).join("-")}`,
      provider: "rule",
      pedagogicalType: "matching",
      exercise: {
        id: `px-match-${trio.map((t) => t.itemId).join("-")}`,
        type: "match",
        prompt: `Match each word to its Italian meaning.\n${left.map((w, i) => `${i + 1}. ${w}`).join("\n")}`,
        options: stableShuffle(answer, `match-${left.join()}`),
        answer,
        explanation: trio
          .map((t) => `${t.payload.word} → ${t.payload.translation}`)
          .join("; "),
      },
      target: trio[0],
    };
  }
}

export const ruleBasedExerciseProvider = new RuleBasedExerciseProvider();
