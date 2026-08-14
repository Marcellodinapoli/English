"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, TextArea } from "@/components/ui/Input";

const levels = [
  { id: "zero", label: "Zero", desc: "I am starting from scratch" },
  { id: "a1", label: "A1", desc: "I know a few words and phrases" },
  { id: "a2", label: "A2", desc: "I can handle simple conversations" },
  { id: "b1", label: "B1", desc: "I can manage everyday situations" },
];

const skills = ["listening", "speaking", "reading", "writing", "vocabulary", "grammar"];

export default function OnboardingWelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [perceivedLevel, setPerceivedLevel] = useState("zero");
  const [goal, setGoal] = useState("");
  const [motivation, setMotivation] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState(15);
  const [frequency, setFrequency] = useState("daily");
  const [focusSkills, setFocusSkills] = useState<string[]>(["speaking", "listening"]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleSkill(skill: string) {
    setFocusSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  async function finish() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/user/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name || undefined,
        perceivedLevel,
        goal,
        motivation,
        dailyMinutes,
        frequency,
        focusSkills,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Could not save onboarding");
      return;
    }
    router.push("/onboarding/assessment");
  }

  return (
    <div className="animate-rise">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
        Onboarding · {step + 1}/4
      </p>
      {step === 0 ? (
        <>
          <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
            Welcome. Let&apos;s build your path.
          </h1>
          <p className="mt-3 text-muted">
            Tell us a little about yourself so Alinea can teach you like a personal tutor.
          </p>
          <div className="mt-8">
            <Label htmlFor="name">What should we call you?</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <Button className="mt-8" size="lg" onClick={() => setStep(1)}>
            Continue
          </Button>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
            Your starting point
          </h1>
          <p className="mt-3 text-muted">
            Choose how you feel today. We will still run a short assessment.
          </p>
          <div className="mt-6 space-y-3">
            {levels.map((level) => (
              <button
                key={level.id}
                type="button"
                onClick={() => setPerceivedLevel(level.id)}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  perceivedLevel === level.id
                    ? "border-teal bg-teal-soft"
                    : "border-line bg-surface hover:border-teal/40"
                }`}
              >
                <div className="font-semibold text-ink">{level.label}</div>
                <div className="text-sm text-muted">{level.desc}</div>
              </button>
            ))}
          </div>
          <div className="mt-8 flex gap-3">
            <Button variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button onClick={() => setStep(2)}>Continue</Button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
            Why are you learning?
          </h1>
          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="goal">Your main goal</Label>
              <Input
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Travel confidently / work meetings / exams"
                required
              />
            </div>
            <div>
              <Label htmlFor="motivation">Motivation</Label>
              <TextArea
                id="motivation"
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="I want to speak without freezing..."
              />
            </div>
          </div>
          <div className="mt-8 flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button disabled={!goal || !motivation} onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
            Time & focus
          </h1>
          <div className="mt-6 space-y-5">
            <div>
              <Label htmlFor="minutes">Daily minutes</Label>
              <Input
                id="minutes"
                type="number"
                min={5}
                max={120}
                value={dailyMinutes}
                onChange={(e) => setDailyMinutes(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="frequency">Frequency</Label>
              <select
                id="frequency"
                className="h-12 w-full rounded-[var(--radius-md)] border border-line bg-surface px-4 text-sm"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="daily">Every day</option>
                <option value="5x">5 days / week</option>
                <option value="3x">3 days / week</option>
              </select>
            </div>
            <div>
              <Label>Skills to improve</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${
                      focusSkills.includes(skill)
                        ? "bg-teal text-white"
                        : "bg-sand text-muted"
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
          <div className="mt-8 flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button disabled={loading || focusSkills.length === 0} onClick={finish}>
              {loading ? "Saving..." : "Start assessment"}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}