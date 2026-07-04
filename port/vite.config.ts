import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

interface SaveMeta { name?: string; roomSize?: { x: number; y: number }; mapSize?: { x: number; y: number }; tilesets?: string[] }

const root = fileURLToPath(new URL(".", import.meta.url));

// Dev-only endpoint for the map editor: POST /api/save-map { id, text } writes the edited map back to
// public/assets/maps/<id>.txt — the exact path the editor (and game) load from, so save → reload round-trips.
// Only present under `vite dev`; the static build has no backend, so the editor downloads the .txt instead.
function saveMapPlugin(): Plugin {
  return {
    name: "merlin-save-map",
    configureServer(server) {
      server.middlewares.use("/api/save-map", (req, res, next) => {
        if (req.method !== "POST") return next();
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          const reply = (code: number, obj: unknown) => {
            res.statusCode = code;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(obj));
          };
          try {
            const { id, text, meta } = JSON.parse(body) as { id?: string; text?: string; meta?: SaveMeta };
            if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return reply(400, { ok: false, error: "bad map id" });
            if (typeof text !== "string" || text.length === 0) return reply(400, { ok: false, error: "empty text" });
            const rel = `public/assets/maps/${id}.txt`;
            writeFileSync(resolve(root, rel), text, "utf8"); // creates new maps too (NEW from the editor)

            // Upsert the manifest so the game can LOAD this map by id (HMR picks up the JSON change). Needs
            // the editor-supplied metadata; without it we only (re)write the .txt for an existing map.
            let registered = false;
            if (meta?.mapSize && meta?.roomSize && meta?.tilesets) {
              const mp = resolve(root, "src/generated/maps.json");
              const manifest = JSON.parse(readFileSync(mp, "utf8")) as Array<{ id: string }>;
              const entry = { id, name: meta.name || id, folder: "editor", file: `maps/${id}.txt`,
                roomSize: meta.roomSize, mapSize: meta.mapSize, tilesets: meta.tilesets };
              const i = manifest.findIndex((m) => m.id === id);
              if (i >= 0) manifest[i] = entry as any; else manifest.push(entry as any);
              writeFileSync(mp, JSON.stringify(manifest, null, 1));
              registered = true;
            }
            reply(200, { ok: true, path: rel, registered });
          } catch (e) {
            reply(400, { ok: false, error: String(e) });
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [saveMapPlugin()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        editor: resolve(root, "editor.html"),
      },
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
  },
});
