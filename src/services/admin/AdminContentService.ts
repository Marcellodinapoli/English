import fs from "fs";
import path from "path";

const CONTENT_ROOT = path.join(process.cwd(), "content");

export type ContentBucket =
  | "passages"
  | "listening"
  | "grammar"
  | "speaking"
  | "writing"
  | "roleplay";

const BUCKETS: ContentBucket[] = [
  "passages",
  "listening",
  "grammar",
  "speaking",
  "writing",
  "roleplay",
];

function bucketDir(bucket: ContentBucket) {
  return path.join(CONTENT_ROOT, bucket);
}

function safeId(id: string) {
  if (!/^[a-z0-9-]+$/i.test(id)) {
    throw new Error("Invalid content id");
  }
  return id;
}

export class AdminContentService {
  listBuckets() {
    return BUCKETS.map((bucket) => {
      const dir = bucketDir(bucket);
      const files = fs.existsSync(/* turbopackIgnore: true */ dir)
        ? fs
            .readdirSync(/* turbopackIgnore: true */ dir)
            .filter((f) => f.endsWith(".json"))
        : [];
      return { bucket, count: files.length };
    });
  }

  listItems(bucket: ContentBucket) {
    const dir = bucketDir(bucket);
    if (!fs.existsSync(/* turbopackIgnore: true */ dir)) return [];
    return fs
      .readdirSync(/* turbopackIgnore: true */ dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const filePath = path.join(dir, f);
        const raw = fs.readFileSync(/* turbopackIgnore: true */ filePath, "utf-8");
        const parsed = JSON.parse(raw) as { id?: string; title?: string; level?: string };
        return {
          id: parsed.id || f.replace(".json", ""),
          title: parsed.title || f,
          level: parsed.level || "—",
          file: f,
        };
      });
  }

  readItem(bucket: ContentBucket, id: string) {
    const safe = safeId(id);
    const file = path.join(bucketDir(bucket), `${safe}.json`);
    if (!fs.existsSync(/* turbopackIgnore: true */ file)) return null;
    const raw = fs.readFileSync(/* turbopackIgnore: true */ file, "utf-8");
    return { id: safe, content: JSON.parse(raw) as unknown };
  }

  writeItem(bucket: ContentBucket, id: string, content: unknown) {
    const safe = safeId(id);
    JSON.parse(JSON.stringify(content));
    const dir = bucketDir(bucket);
    if (!fs.existsSync(/* turbopackIgnore: true */ dir)) {
      fs.mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true });
    }
    const file = path.join(dir, `${safe}.json`);
    fs.writeFileSync(
      /* turbopackIgnore: true */ file,
      `${JSON.stringify(content, null, 2)}\n`,
      "utf-8"
    );
    return { id: safe, bucket };
  }
}

export const adminContentService = new AdminContentService();
