import type { ConversationEvaluationRequest } from "@/types/conversation";

export function evaluateConversationPrompt(
  request: ConversationEvaluationRequest
) {
  const userLines = request.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");

  const scenarioBlock = request.scenario
    ? `Scenario: ${request.scenario.title}
Goals: ${request.scenario.goals.join("; ")}
`
    : "Session type: free tutor conversation\n";

  return `You are an English examiner for Italian learners (level ${request.level}).

${scenarioBlock}
Evaluate ONLY the learner's messages (not the AI/tutor replies):

"""
${userLines}
"""

Return JSON:
{
  "overall": 0-100,
  "grammar": 0-100,
  "vocabulary": 0-100,
  "fluency": 0-100,
  "feedback": "encouraging summary in Italian (2-4 sentences)",
  "grammarErrors": [{ "original": "...", "correction": "...", "explanation": "brief Italian", "type": "grammar|vocabulary", "topic": "e.g. Past Simple" }],
  "vocabularyNotes": ["useful vocabulary feedback"],
  "recommendations": ["actionable next steps in Italian"],
  "reviewTopics": ["grammar topic names to review, e.g. Past Simple"]
}`;
}
