import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-[var(--radius-md)] border border-line bg-surface px-4 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-teal focus:ring-2 focus:ring-teal/20",
        className
      )}
      {...props}
    />
  );
}

export function Label({
  children,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("mb-2 block text-sm font-medium text-ink", className)}
    >
      {children}
    </label>
  );
}

export function TextArea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-teal focus:ring-2 focus:ring-teal/20",
        className
      )}
      {...props}
    />
  );
}