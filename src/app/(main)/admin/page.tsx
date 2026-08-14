"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";

type ContentBucket =
  | "passages"
  | "listening"
  | "grammar"
  | "speaking"
  | "writing"
  | "roleplay";

export default function AdminPage() {
  const [bucket, setBucket] = useState<ContentBucket>("speaking");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const meta = useQuery({
    queryKey: ["admin-meta"],
    queryFn: async () => {
      const res = await fetch("/api/admin/content");
      if (res.status === 403) throw new Error("FORBIDDEN");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    retry: false,
  });

  const items = useQuery({
    queryKey: ["admin-items", bucket],
    queryFn: async () => {
      const res = await fetch(`/api/admin/content/${bucket}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{
        items: Array<{ id: string; title: string; level: string }>;
      }>;
    },
    enabled: meta.isSuccess,
  });

  const loadItem = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/content/${bucket}/${id}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<{ id: string; content: unknown }>;
    },
    onSuccess: (data) => {
      setSelectedId(data.id);
      setEditor(JSON.stringify(data.content, null, 2));
      setMessage(null);
    },
  });

  const saveItem = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("No item selected");
      const parsed = JSON.parse(editor);
      const res = await fetch(`/api/admin/content/${bucket}/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      return json;
    },
    onSuccess: () => setMessage("Saved successfully."),
    onError: (err: Error) => setMessage(err.message),
  });

  if (meta.isLoading) return <p className="text-muted">Checking access…</p>;

  if (meta.error?.message === "FORBIDDEN") {
    return (
      <div className="space-y-4">
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-ink">
          Admin CMS
        </h1>
        <p className="text-muted">
          Access denied. Add your email to <code>ADMIN_EMAILS</code> in `.env` and
          re-register, or set <code>role=ADMIN</code> in the database.
        </p>
        <Link href="/home" className="text-teal hover:underline">
          ← Home
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-rise">
      <div>
        <Badge tone="teal">Admin</Badge>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          Content CMS
        </h1>
        <CardDescription>
          Edit JSON content files directly. Changes apply immediately in dev.
        </CardDescription>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            "passages",
            "listening",
            "grammar",
            "speaking",
            "writing",
            "roleplay",
          ] as ContentBucket[]
        ).map((b) => (
          <Button
            key={b}
            variant={bucket === b ? "primary" : "soft"}
            size="sm"
            onClick={() => {
              setBucket(b);
              setSelectedId(null);
              setEditor("");
            }}
          >
            {b}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="max-h-[520px] overflow-y-auto">
          <CardTitle className="text-base">Items</CardTitle>
          <div className="mt-3 space-y-2">
            {(items.data?.items || []).map((item) => (
              <button
                key={item.id}
                type="button"
                className="block w-full rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-teal/40"
                onClick={() => loadItem.mutate(item.id)}
              >
                <span className="font-medium text-ink">{item.title}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {item.id} · {item.level}
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle className="text-base">
            {selectedId ? `Edit: ${selectedId}` : "Select an item"}
          </CardTitle>
          <textarea
            value={editor}
            onChange={(e) => setEditor(e.target.value)}
            className="mt-3 h-[420px] w-full rounded-[var(--radius-md)] border border-line bg-surface p-3 font-mono text-xs"
            spellCheck={false}
            disabled={!selectedId}
          />
          <div className="mt-3 flex items-center gap-3">
            <Button
              onClick={() => saveItem.mutate()}
              disabled={!selectedId || saveItem.isPending}
            >
              {saveItem.isPending ? "Saving…" : "Save JSON"}
            </Button>
            {message ? <p className="text-sm text-muted">{message}</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
