import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
  tone = "teal",
}: {
  value: number;
  className?: string;
  tone?: "teal" | "ink" | "warning";
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const colors = {
    teal: "bg-teal",
    ink: "bg-ink",
    warning: "bg-warning",
  };

  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-sand-deep",
        className
      )}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-500", colors[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function SkillBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="tabular-nums text-muted">{Math.round(value)}%</span>
      </div>
      <ProgressBar value={value} />
    </div>
  );
}