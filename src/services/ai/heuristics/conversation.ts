import type {
  ConversationEvaluation,
  ConversationEvaluationRequest,
  ConversationMessage,
  RoleplayResponseRequest,
  RoleplayResponseResult,
  RoleplayScenario,
  TutorResponseRequest,
  TutorResponseResult,
} from "@/types/conversation";

function lastUserMessage(messages: ConversationMessage[]) {
  return [...messages].reverse().find((m) => m.role === "user")?.content || "";
}

function userTurnCount(messages: ConversationMessage[]) {
  return messages.filter((m) => m.role === "user").length;
}

export function heuristicTutorResponse(
  request: TutorResponseRequest
): TutorResponseResult {
  const msg = request.userMessage.trim().toLowerCase();
  const level = request.context.level;

  if (!msg) {
    return {
      message:
        "I'm here to help you practice English. Try writing a sentence or ask me a question!",
      hint: "Scrivi una frase semplice in inglese, ad esempio: I like coffee.",
      source: "heuristic",
    };
  }

  if (msg.includes("translate") || msg.includes("traduc")) {
    return {
      message:
        "Let's work on it together. What word or phrase are you trying to say? Try writing your sentence in English first — I'll help you fix it.",
      hint: "Non traduco tutto subito: prova tu, poi ti guido.",
      encouragement: "Ogni tentativo ti fa progredire.",
      source: "heuristic",
    };
  }

  if (msg.includes("hello") || msg.includes("hi ") || msg === "hi") {
    return {
      message: `Great start! At level ${level}, you can also say: "Hello, how are you?" — Can you try a slightly longer greeting?`,
      hint: "Prova ad aggiungere una domanda: How are you?",
      source: "heuristic",
    };
  }

  const weak = request.context.weakSkills[0];
  const grammarTip =
    request.context.problematicGrammar[0] ||
    (weak === "grammar" ? "basic sentence structure" : "");

  return {
    message: `Good effort! Your sentence shows you're trying to communicate. ${
      grammarTip
        ? `Watch out for ${grammarTip}. Can you rewrite your idea using a complete sentence (subject + verb)?`
        : "Can you add one more detail to make your sentence longer?"
    }`,
    hint: "Pensa a: chi fa l'azione + verbo + complemento.",
    encouragement: "Stai costruendo abitudine alla produzione — continua così.",
    source: "heuristic",
  };
}

const ROLEPLAY_REPLIES: Record<string, string[]> = {
  default: [
    "I see. Can you tell me a bit more?",
    "Okay, got it. And what about you?",
    "Sure — go on.",
  ],
  travel: [
    "Of course. May I have your name, please?",
    "Perfect. Here is your key. Do you need anything else?",
    "Breakfast is from 7 to 10. Enjoy your stay!",
  ],
  work: [
    "Nice! Which team are you joining?",
    "Great to have you here. How was your first day so far?",
    "We usually meet on Mondays. You'll like the team!",
  ],
  daily: [
    "Sure thing. Would you like milk with that?",
    "That's £2.50, please.",
    "Have a nice day!",
  ],
  social: [
    "Sounds good! What time works for you?",
    "Saturday is perfect. Where should we meet?",
    "Cool — see you then!",
  ],
};

export function heuristicRoleplayResponse(
  request: RoleplayResponseRequest
): RoleplayResponseResult {
  const turns = userTurnCount(request.messages);
  const pool =
    ROLEPLAY_REPLIES[request.scenario.category] || ROLEPLAY_REPLIES.default;
  const reply = pool[Math.min(turns, pool.length - 1)] || pool[pool.length - 1];

  return {
    message: reply,
    sceneNote:
      turns >= request.scenario.maxTurns - 1
        ? "Hai quasi completato gli obiettivi — puoi concludere la sessione."
        : undefined,
    source: "heuristic",
  };
}

export function heuristicRoleplayOpening(
  scenario: RoleplayScenario
): RoleplayResponseResult {
  return {
    message: scenario.openingLine,
    sceneNote: `Obiettivi: ${scenario.goals.slice(0, 2).join(", ")}…`,
    source: "heuristic",
  };
}

export function heuristicConversationEvaluation(
  request: ConversationEvaluationRequest
): ConversationEvaluation {
  const userText = request.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");

  const words = userText.split(/\s+/).filter(Boolean);
  const sentences = userText.split(/[.!?]+/).filter((s) => s.trim()).length;
  const wordScore = Math.min(100, 40 + words.length * 3);
  const fluency = Math.min(100, 35 + sentences * 12);
  const grammar = Math.min(100, 45 + Math.min(sentences, 4) * 10);
  const vocabulary = Math.min(100, 40 + new Set(words.map((w) => w.toLowerCase())).size * 4);
  const overall = Math.round((wordScore + fluency + grammar + vocabulary) / 4);

  const grammarErrors: ConversationEvaluation["grammarErrors"] = [];
  if (/\bi am go\b/i.test(userText)) {
    grammarErrors.push({
      original: "I am go",
      correction: "I am going / I go",
      explanation: "Usa 'going' per azioni in corso o 'go' per abitudini.",
    });
  }
  if (/\byesterday\b/i.test(userText) && /\bgo\b/i.test(userText)) {
    grammarErrors.push({
      original: "go ... yesterday",
      correction: "went ... yesterday",
      explanation: "Con 'yesterday' serve il past simple.",
    });
  }

  return {
    overall,
    grammar,
    vocabulary,
    fluency,
    feedback:
      overall >= 70
        ? "Buon lavoro! Hai mantenuto la conversazione con frasi comprensibili. Continua ad allungare le risposte."
        : "Hai partecipato — ottimo. Prova risposte un po' più lunghe e usa le frasi suggerite come base.",
    grammarErrors,
    vocabularyNotes:
      words.length < 5
        ? ["Prova ad usare almeno 5-8 parole per risposta."]
        : ["Hai usato un vocabolario adeguato al livello."],
    recommendations: [
      "Ripeti lo scenario una seconda volta con frasi più complete.",
      request.scenario
        ? `Rivedi: ${request.scenario.suggestedPhrases.slice(0, 2).join(", ")}`
        : "Chiedi al tutor di simulare una situazione reale.",
    ],
    reviewTopics: grammarErrors.length ? ["Past Simple", "Present Continuous"] : [],
    source: "heuristic",
  };
}

export function heuristicTutorWelcome(level: string, goal?: string) {
  return {
    message: `Hi! I'm your Alinea tutor. You're at level ${level}. ${
      goal ? `I know your goal is: ${goal}. ` : ""
    }Ask me anything, practice a sentence, or tell me what you'd like to work on today.`,
    hint: "Puoi scrivere in inglese o chiedere aiuto in italiano.",
    source: "heuristic" as const,
  };
}

export { lastUserMessage, userTurnCount };
