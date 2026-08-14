import type { SpeakingEvaluationRequest } from "../AIProvider";

export function evaluateSpeakingPrompt(request: SpeakingEvaluationRequest) {
  return `You are an English speaking examiner for Italian learners (level ${request.level || "A1"}).

Mode: ${request.mode}
Prompt/task: ${request.prompt || "N/A"}
Expected phrase (if repeat mode): ${request.expectedText || "N/A"}
Learner transcript: "${request.transcript}"
Recording duration ms: ${request.durationMs ?? "unknown"}

Evaluate the linguistic content of the transcript only.
Do NOT score pronunciation — there is no phonetic/audio analysis available.
You may optionally assess transcriptQuality (0-100) if the transcript seems incomplete or garbled.

Return JSON:
{
  "overall": 0-100,
  "accuracy": 0-100,
  "fluency": 0-100,
  "vocabulary": 0-100,
  "grammar": 0-100,
  "transcriptQuality": 0-100,
  "feedback": "short encouraging feedback in Italian",
  "suggestions": ["..."],
  "corrections": [{ "from": "...", "to": "...", "reason": "...", "type": "grammar|vocabulary", "topic": "e.g. past_simple" }]
}`;
}

export function evaluateWritingPrompt(request: {
  text: string;
  prompt: string;
  level?: string;
}) {
  return `You are an English writing examiner for Italian learners (level ${request.level || "A1"}).

Task: ${request.prompt}
Learner text: """${request.text}"""

Return JSON:
{
  "overall": 0-100,
  "grammar": 0-100,
  "vocabulary": 0-100,
  "accuracy": 0-100,
  "fluency": 0-100,
  "appropriateness": 0-100,
  "coherence": 0-100,
  "feedback": "short feedback in Italian",
  "suggestions": ["..."],
  "correctedText": "...",
  "mistakes": [{ "original": "...", "correction": "...", "type": "grammar|vocabulary|spelling|expression", "topic": "e.g. third_person_singular", "skill": "grammar|vocabulary|writing" }]
}`;
}
