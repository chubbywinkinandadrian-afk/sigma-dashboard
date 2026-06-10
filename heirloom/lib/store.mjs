import { mkdir, readFile, writeFile, readdir, stat, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".data");
const TTL_MINUTES = Number(process.env.TTL_MINUTES || 60);

async function ensureDir() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
}

function fileFor(id, kind) {
  // kind: orig | full | prev | bprev | meta
  const ext = kind === "meta" ? "json" : "jpg";
  return path.join(DATA_DIR, `${id}-${kind}.${ext}`);
}

export async function saveJob(id, parts) {
  await ensureDir();
  const writes = [];
  for (const [kind, buf] of Object.entries(parts)) {
    writes.push(writeFile(fileFor(id, kind), buf));
  }
  writes.push(
    writeFile(fileFor(id, "meta"), JSON.stringify({ createdAt: Date.now() }))
  );
  await Promise.all(writes);
}

export async function loadPart(id, kind) {
  try {
    return await readFile(fileFor(id, kind));
  } catch {
    return null;
  }
}

export async function jobExists(id) {
  return existsSync(fileFor(id, "meta"));
}

export async function sweepExpired() {
  if (!existsSync(DATA_DIR)) return 0;
  const cutoff = Date.now() - TTL_MINUTES * 60 * 1000;
  let removed = 0;
  for (const name of await readdir(DATA_DIR)) {
    const p = path.join(DATA_DIR, name);
    try {
      const s = await stat(p);
      if (s.mtimeMs < cutoff) {
        await unlink(p);
        removed++;
      }
    } catch {
      /* file raced away; ignore */
    }
  }
  return removed;
}

export { TTL_MINUTES };
