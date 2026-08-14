/**
 * Offline / no-API-key evaluation heuristics for speaking & writing.
 */

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string) {
  return normalize(text).split(" ").filter(Boolean);
}

function similarity(a: string, b: string) {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size && !tb.size) return 1;
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  ta.forEach((t) => {
    if (tb.has(t)) inter += 1;
  });
  return inter / Math.max(ta.size, tb.size);
}

function clampScore(n: number) {
  return Math.round(Math.min(100, Math.max(0, n)));
}

export function heuristicSpeakingEvaluation(input: {
  transcript: string;
  expectedText?: string;
  mode: "repeat" | "free";
  durationMs?: number;
}) {
  const transcript = input.transcript.trim();
  if (!transcript) {
    return {
      transcript,
      overall: 15,
      accuracy: 10,
      fluency: 15,
      vocabulary: 20,
      grammar: 20,
      feedback:
        "Non ho rilevato parole chiare. Ripeti vicino al microfono e parla con calma.",
      suggestions: [
        "Ascolta il modello e ripeti",
        "Parla un po' più forte e lentamente",
      ],
      corrections: [] as Array<{
        from: string;
        to: string;
        reason: string;
        type?: string;
        topic?: string;
      }>,
      source: "heuristic" as const,
      pronunciationAssessed: false,
    };
  }

  const words = tokens(transcript);
  const durationSec = (input.durationMs || Math.max(1200, words.length * 450)) / 1000;
  const wpm = words.length / Math.max(durationSec / 60, 0.15);
  const fluency = clampScore(wpm > 140 ? 70 : wpm < 40 ? 45 + wpm : 55 + wpm / 2);

  let accuracy = 70;
  const corrections: Array<{
    from: string;
    to: string;
    reason: string;
    type?: string;
    topic?: string;
  }> = [];

  if (input.mode === "repeat" && input.expectedText) {
    const sim = similarity(transcript, input.expectedText);
    accuracy = clampScore(sim * 100);
    if (sim < 0.85) {
      corrections.push({
        from: transcript,
        to: input.expectedText,
        reason: "Target phrase for this repetition exercise",
        type: "accuracy",
      });
    }
  } else {
    // Free response heuristics
    if (/\bi go yesterday\b/i.test(transcript)) {
      accuracy = 45;
      corrections.push({
        from: "I go yesterday",
        to: "I went yesterday",
        reason: "Past Simple",
      });
    }
    if (/\bi is\b/i.test(transcript)) {
      accuracy = Math.min(accuracy, 50);
      corrections.push({
        from: "I is",
        to: "I am",
        reason: "to be agreement",
      });
    }
  }

  const vocabulary = clampScore(55 + Math.min(words.length, 12) * 3);
  const grammar = clampScore(accuracy * 0.7 + 25);
  const overall = clampScore(
    accuracy * 0.35 +
      fluency * 0.25 +
      vocabulary * 0.2 +
      grammar * 0.2
  );

  return {
    transcript,
    overall,
    accuracy,
    fluency,
    vocabulary,
    grammar,
    transcriptQuality: accuracy,
    feedback:
      overall >= 80
        ? "Ottimo tentativo: il messaggio è chiaro. Continua così."
        : overall >= 55
          ? "Buona base. Rivedi le correzioni e riprova una volta."
          : "Ci sei quasi. Ascolta il modello, poi registra di nuovo con calma.",
    suggestions: [
      input.mode === "repeat"
        ? "Ascolta e ripeti la frase modello"
        : "Costruisci frasi brevi e chiare",
      "Controlla passato semplice e to be",
      "Registra di nuovo dopo 30 secondi di ascolto",
    ],
    corrections,
    source: "heuristic" as const,
    pronunciationAssessed: false,
  };
}

export function heuristicWritingEvaluation(input: {
  text: string;
  prompt: string;
}) {
  const text = input.text.trim();
  if (!text) {
    return {
      overall: 10,
      grammar: 10,
      vocabulary: 10,
      accuracy: 10,
      fluency: 10,
      feedback: "Scrivi almeno una frase completa.",
      suggestions: ["Inizia con soggetto + verbo"],
      correctedText: "",
      mistakes: [] as Array<{ original: string; correction: string; type: string }>,
      source: "heuristic" as const,
    };
  }

  const mistakes: Array<{
    original: string;
    correction: string;
    type: string;
    topic?: string;
    skill?: "grammar" | "vocabulary" | "writing";
  }> = [];
  let corrected = text;

  const replacements: Array<[RegExp, string, string, string]> = [
    [/\bi go yesterday\b/gi, "I went yesterday", "I go yesterday", "grammar"],
    [/\bi is\b/gi, "I am", "I is", "grammar"],
    [/\bhe have\b/gi, "he has", "he have", "grammar"],
    [/\bshe have\b/gi, "she has", "she have", "grammar"],
  ];

  for (const [re, to, from, type] of replacements) {
    if (re.test(corrected)) {
      mistakes.push({
        original: from,
        correction: to,
        type,
        topic: type === "grammar" ? from.replace(/\s+/g, "_").toLowerCase() : undefined,
        skill: type === "grammar" ? "grammar" : "vocabulary",
      });
      corrected = corrected.replace(re, to);
    }
  }

  const words = tokens(text);
  const vocabulary = clampScore(50 + Math.min(words.length, 20) * 2);
  const grammar = clampScore(90 - mistakes.length * 18);
  const accuracy = grammar;
  const fluency = clampScore(55 + Math.min(words.length, 25) * 1.5);
  const overall = clampScore(
    grammar * 0.35 + vocabulary * 0.25 + accuracy * 0.25 + fluency * 0.15
  );

  return {
    overall,
    grammar,
    vocabulary,
    accuracy,
    fluency,
    feedback:
      mistakes.length === 0
        ? "Testo chiaro e comprensibile. Buon lavoro."
        : `Ho trovato ${mistakes.length} punto/i da migliorare. Controlla le correzioni.`,
    suggestions: [
      "Rileggi ad alta voce la versione corretta",
      "Usa frasi brevi al tuo livello",
      "Salva le forme corrette nel vocabolario",
    ],
    correctedText: corrected,
    mistakes,
    source: "heuristic" as const,
  };
}
