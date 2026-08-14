"use client";

import { useEffect, useState } from "react";
import { Mic, Square, Volume2, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SkillBar } from "@/components/ui/ProgressBar";
import { getAudioService } from "@/services/audio/AudioService";
import type { SpeakingEvaluationResult } from "@/services/ai/AIProvider";
import type { SpeakingItem } from "@/types/speaking";

export function SpeakingRecorder({
  item,
  level,
  onEvaluated,
}: {
  item: SpeakingItem;
  level: string;
  onEvaluated?: (result: SpeakingEvaluationResult) => void;
}) {
  const audio = getAudioService();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualTranscript, setManualTranscript] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [evaluation, setEvaluation] = useState<SpeakingEvaluationResult | null>(
    null
  );
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  async function start() {
    setError(null);
    setEvaluation(null);
    setSeconds(0);
    setLiveTranscript("");
    try {
      await fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "speaking_started",
          metadata: { itemId: item.id, mode: item.mode },
        }),
      }).catch(() => undefined);
      await audio.startRecording();
      setRecording(true);
      // Parallel browser STT while recording
      audio
        .listenOnce("en-GB", 20000)
        .then((text) => setLiveTranscript(text))
        .catch(() => undefined);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Cannot access microphone. Check browser/app permissions."
      );
    }
  }

  async function stopAndEvaluate() {
    setBusy(true);
    setError(null);
    try {
      const result = await audio.stopRecording();
      setRecording(false);
      setLastBlob(result.blob);

      const transcript = (manualTranscript || liveTranscript).trim();

      const form = new FormData();
      form.append("audio", result.blob, "speech.webm");
      form.append("mode", item.mode);
      form.append("prompt", item.prompt);
      form.append("level", level);
      form.append("durationMs", String(result.durationMs));
      if (item.targetText) form.append("expectedText", item.targetText);
      if (transcript) form.append("transcript", transcript);

      const res = await fetch("/api/ai/evaluate-speaking", {
        method: "POST",
        body: form,
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Evaluation failed");
      }
      setEvaluation(body.evaluation);
      onEvaluated?.(body.evaluation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-sand/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="teal">{item.mode === "repeat" ? "Repeat" : "Free speak"}</Badge>
          {item.hint ? <Badge>{item.hint}</Badge> : null}
        </div>
        <p className="mt-3 text-lg font-semibold text-ink">{item.prompt}</p>
        {item.promptIt ? (
          <p className="mt-1 text-sm text-muted">{item.promptIt}</p>
        ) : null}
        {item.targetText ? (
          <p className="mt-4 reading-text text-ink">{item.targetText}</p>
        ) : null}
        {item.exampleAnswer ? (
          <p className="mt-3 text-sm text-muted">
            Example: {item.exampleAnswer}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {item.targetText || item.exampleAnswer ? (
          <Button
            variant="soft"
            onClick={() =>
              audio.speak(item.targetText || item.exampleAnswer || "")
            }
          >
            <Volume2 className="h-4 w-4" /> Listen model
          </Button>
        ) : null}
        {lastBlob ? (
          <Button variant="outline" onClick={() => audio.playBlob(lastBlob)}>
            <RotateCcw className="h-4 w-4" /> Play my recording
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-4 rounded-[1.5rem] border border-line bg-surface p-6">
        <div
          className={`flex h-28 w-28 items-center justify-center rounded-full transition ${
            recording
              ? "animate-pulse bg-danger/15 text-danger"
              : "bg-teal-soft text-teal-deep"
          }`}
        >
          <Mic className="h-10 w-10" />
        </div>
        <p className="text-sm text-muted">
          {recording ? `Recording… ${seconds}s` : "Tap to record your answer"}
        </p>
        <div className="flex gap-3">
          {!recording ? (
            <Button size="lg" onClick={start} disabled={busy}>
              <Mic className="h-4 w-4" /> Record
            </Button>
          ) : (
            <Button size="lg" variant="secondary" onClick={stopAndEvaluate}>
              <Square className="h-4 w-4" /> Stop & evaluate
            </Button>
          )}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-ink">
          Optional: type what you said (if browser speech is unavailable)
        </label>
        <input
          className="h-11 w-full rounded-xl border border-line px-3 text-sm"
          value={manualTranscript}
          onChange={(e) => setManualTranscript(e.target.value)}
          placeholder="e.g. My name is Marco"
        />
      </div>

      {busy ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Evaluating speech…
        </p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {evaluation ? (
        <div className="space-y-4 rounded-[1.5rem] border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-ink">Your feedback</h3>
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">{evaluation.overall}%</Badge>
              <Badge>
                {evaluation.pronunciationAssessed
                  ? "Pronunciation scored"
                  : "Pronunciation not scored"}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted">
            Transcript: “{evaluation.transcript}”
          </p>
          <div className="space-y-3">
            {evaluation.pronunciationAssessed &&
            evaluation.pronunciation != null ? (
              <SkillBar
                label="Pronunciation"
                value={evaluation.pronunciation}
              />
            ) : null}
            {evaluation.transcriptQuality != null ? (
              <SkillBar
                label="Transcript quality"
                value={evaluation.transcriptQuality}
              />
            ) : null}
            <SkillBar label="Accuracy" value={evaluation.accuracy} />
            <SkillBar label="Fluency" value={evaluation.fluency} />
            <SkillBar label="Vocabulary" value={evaluation.vocabulary} />
            <SkillBar label="Grammar" value={evaluation.grammar} />
          </div>
          <p className="text-ink">{evaluation.feedback}</p>
          {evaluation.suggestions?.length ? (
            <ul className="space-y-1 text-sm text-muted">
              {evaluation.suggestions.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          ) : null}
          {evaluation.corrections?.length ? (
            <div className="rounded-2xl bg-amber-50 p-3 text-sm text-warning">
              {evaluation.corrections.map((c) => (
                <p key={`${c.from}-${c.to}`}>
                  {c.from} → <strong>{c.to}</strong> ({c.reason})
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
