import type { ContextualMeaningRequest } from "../AIProvider";

export function contextualMeaningPrompt(request: ContextualMeaningRequest) {
  return `Determine the contextual Italian meaning of the English word in this sentence.

Word: "${request.word}"
Lemma: "${request.lemma || request.word}"
Sentence: "${request.sentence}"
Learner level: ${request.level || "A1"}

Return JSON:
{
  "translation": "Italian meaning in this context",
  "partOfSpeech": "noun|verb|adjective|...",
  "phonetic": "/.../",
  "shortExplanation": "one sentence in Italian explaining the meaning in context",
  "exampleTranslation": "Italian translation of the sentence",
  "level": "${request.level || "A1"}",
  "otherMeanings": [{ "translation": "...", "partOfSpeech": "..." }]
}`;
}