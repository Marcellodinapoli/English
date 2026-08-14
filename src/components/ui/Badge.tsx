import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "neutral" | "teal" | "success" | "warning";
}) {
  const tones = {
    neutral: "bg-sand text-muted",
    teal: "bg-teal-soft text-teal-deep",
    success: "bg-emerald-50 text-success",
    warning: "bg-amber-50 text-warning",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}