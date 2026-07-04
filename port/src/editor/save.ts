// Persisting an edited map. Two paths (the user chose "both"):
//   1. dev-write: POST the serialized .txt to the Vite dev plugin, which writes maps/<id>.txt.
//   2. download:  fall back to a browser download (works on any host, incl. the static build).
// The dev endpoint is probed once; if it isn't there (static build, plugin disabled), we download.

export interface SaveResult { method: "dev-write" | "download"; path?: string; registered?: boolean }
export interface SaveMeta { name?: string; roomSize?: { x: number; y: number }; mapSize?: { x: number; y: number }; tilesets?: string[] }

export async function saveMap(id: string, text: string, meta?: SaveMeta): Promise<SaveResult> {
  // Try the dev-write endpoint first. The metadata lets it register a NEW map in the manifest so the game
  // can load it by id (HMR picks up the change).
  try {
    const res = await fetch("/api/save-map", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, text, meta }),
    });
    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as { path?: string; registered?: boolean };
      return { method: "dev-write", path: body.path, registered: body.registered };
    }
  } catch {
    // no dev endpoint (static build) — fall through to download
  }
  download(`${id}.txt`, text);
  return { method: "download" };
}

function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
