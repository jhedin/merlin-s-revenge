// Generic Macromedia Director "Lingo" value parser + serializer.
//
// The Merlin map files are a single-line dump of a Lingo property list, e.g.
//   [#map: [#mapSize: point(4, 1), #roomSize: point(18, 9), #startRoom: point(1, 1),
//           #layerDefinitions: [[#name: #backgroundPassive, #tileSet: #merlinOpenPassive, ...], ...],
//           #rooms: [[#num: 1, #layers: [[#name: #backgroundPassive, #map: [[12, 12, ...], ...]]]]]]]
//
// The editor loads the FULL value, mutates only the tile arrays in place, and re-serializes — so every
// other field (#displayScale, #roomMapScale, #miniMapStatus, …) round-trips untouched. The game's map
// reader tokenizes and ignores whitespace, and the source formatting is irregular (inconsistent spaces
// after ':' and ',', inconsistent trailing newline), so the contract is VALUE round-trip, not byte
// round-trip: parse(serialize(v)) deep-equals v. The serializer emits one consistent normalized form.

export type LingoValue =
  | { t: "int"; v: number }
  | { t: "float"; v: number }
  | { t: "str"; v: string }
  | { t: "sym"; v: string } // #name  (this includes #none / #true / #false written as symbols)
  | { t: "call"; name: string; args: LingoValue[] } // point(x, y), rect(...), color(...)
  | { t: "list"; items: LingoValue[] }
  | { t: "props"; pairs: { key: LingoValue; value: LingoValue }[] }
  | { t: "atom"; v: string }; // bare word with no '(' after it: TRUE / FALSE / VOID / EMPTY

// ── tokenizer ──────────────────────────────────────────────────────────────────────────────────
type Tok =
  | { k: "punc"; v: "[" | "]" | "(" | ")" | "," | ":" }
  | { k: "sym"; v: string }
  | { k: "num"; v: number; float: boolean }
  | { k: "str"; v: string }
  | { k: "word"; v: string };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  const isWord = (c: string) => /[A-Za-z0-9_]/.test(c);
  while (i < n) {
    const c = src[i]!;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    if (c === "[" || c === "]" || c === "(" || c === ")" || c === "," || c === ":") {
      toks.push({ k: "punc", v: c as any }); i++; continue;
    }
    if (c === "#") {
      let j = i + 1;
      while (j < n && isWord(src[j]!)) j++;
      toks.push({ k: "sym", v: src.slice(i + 1, j) }); i = j; continue;
    }
    if (c === '"') {
      // Lingo strings have no backslash escapes (a literal quote is spliced via & QUOTE &). Read to the
      // next quote — sufficient for map room-name strings.
      let j = i + 1;
      while (j < n && src[j] !== '"') j++;
      toks.push({ k: "str", v: src.slice(i + 1, j) }); i = j + 1; continue;
    }
    // number: optional leading '-', digits, optional '.digits'. (No exponent form appears in maps.)
    if (c === "-" || c === "." || (c >= "0" && c <= "9")) {
      const start = i;
      if (src[i] === "-") i++;
      let sawDot = false;
      while (i < n && ((src[i]! >= "0" && src[i]! <= "9") || (src[i] === "." && !sawDot))) {
        if (src[i] === ".") sawDot = true;
        i++;
      }
      const raw = src.slice(start, i);
      // a bare "-" or "." that wasn't actually a number → fall back to a word atom
      if (raw === "-" || raw === ".") { toks.push({ k: "word", v: raw }); continue; }
      toks.push({ k: "num", v: Number(raw), float: sawDot });
      continue;
    }
    if (isWord(c)) {
      let j = i;
      while (j < n && isWord(src[j]!)) j++;
      toks.push({ k: "word", v: src.slice(i, j) }); i = j; continue;
    }
    throw new Error(`lingo: unexpected char ${JSON.stringify(c)} at ${i}`);
  }
  return toks;
}

// ── parser (recursive descent) ───────────────────────────────────────────────────────────────────
export function parse(src: string): LingoValue {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const expect = (k: Tok["k"], v?: string) => {
    const t = toks[p++];
    if (!t || t.k !== k || (v !== undefined && (t as any).v !== v)) {
      throw new Error(`lingo: expected ${k}${v ? " " + v : ""} but got ${JSON.stringify(t)} at tok ${p - 1}`);
    }
    return t;
  };

  function parseValue(): LingoValue {
    const t = peek();
    if (!t) throw new Error("lingo: unexpected end of input");
    if (t.k === "sym") { next(); return { t: "sym", v: t.v }; }
    if (t.k === "str") { next(); return { t: "str", v: t.v }; }
    if (t.k === "num") { next(); return t.float ? { t: "float", v: t.v } : { t: "int", v: t.v }; }
    if (t.k === "punc" && t.v === "[") return parseBracket();
    if (t.k === "word") {
      next();
      if (peek() && peek()!.k === "punc" && (peek() as any).v === "(") {
        // a call: name(args)
        expect("punc", "(");
        const args: LingoValue[] = [];
        if (!(peek() && peek()!.k === "punc" && (peek() as any).v === ")")) {
          args.push(parseValue());
          while (peek() && peek()!.k === "punc" && (peek() as any).v === ",") { next(); args.push(parseValue()); }
        }
        expect("punc", ")");
        return { t: "call", name: t.v, args };
      }
      return { t: "atom", v: t.v };
    }
    throw new Error(`lingo: unexpected token ${JSON.stringify(t)} at ${p}`);
  }

  // '[' already known to be next. Could be: empty list [], empty prop-list [:], a list [a, b], or a
  // prop-list [#k: v, ...]. Decide by whether the first element is followed by ':'.
  function parseBracket(): LingoValue {
    expect("punc", "[");
    // empty list
    if (peek() && peek()!.k === "punc" && (peek() as any).v === "]") { next(); return { t: "list", items: [] }; }
    // empty prop-list [:]
    if (peek() && peek()!.k === "punc" && (peek() as any).v === ":") {
      next(); expect("punc", "]"); return { t: "props", pairs: [] };
    }
    const first = parseValue();
    if (peek() && peek()!.k === "punc" && (peek() as any).v === ":") {
      // prop-list
      next(); // ':'
      const pairs = [{ key: first, value: parseValue() }];
      while (peek() && peek()!.k === "punc" && (peek() as any).v === ",") {
        next();
        const key = parseValue();
        expect("punc", ":");
        pairs.push({ key, value: parseValue() });
      }
      expect("punc", "]");
      return { t: "props", pairs };
    }
    // list
    const items = [first];
    while (peek() && peek()!.k === "punc" && (peek() as any).v === ",") { next(); items.push(parseValue()); }
    expect("punc", "]");
    return { t: "list", items };
  }

  // Parse the FIRST complete value and stop — matching the game's parseLingo, which ignores anything after
  // it. A few bundled maps carry trailing junk after a valid `[#map: …]` (corrupt saves); both parsers skip
  // it, and re-serializing emits only the clean value, so saving such a map repairs it.
  return parseValue();
}

/** True if `src` has tokens left over after the first complete value (a corrupt/trailing-junk save). */
export function hasTrailingJunk(src: string): boolean {
  const toks = tokenize(src);
  let consumed = 0;
  // re-run the parser but count tokens; cheap enough for an editor load. Reuse parse via a token cursor.
  try {
    // a minimal re-parse that reports the cursor: parse() ignores trailing, so compare token counts.
    const before = toks.length;
    // parse() internally tokenizes again; to avoid duplicating the cursor we approximate by re-tokenizing
    // the serialized first value and comparing token counts.
    consumed = tokenize(serialize(parse(src))).length;
    return consumed < before;
  } catch {
    return false;
  }
}

// ── serializer (one normalized form: ", " between items, ": " in pairs) ───────────────────────────
export function serialize(v: LingoValue): string {
  switch (v.t) {
    case "int": return String(v.v);
    case "float": return formatFloat(v.v);
    case "str": return `"${v.v}"`;
    case "sym": return `#${v.v}`;
    case "atom": return v.v;
    case "call": return `${v.name}(${v.args.map(serialize).join(", ")})`;
    case "list": return `[${v.items.map(serialize).join(", ")}]`;
    case "props":
      if (v.pairs.length === 0) return "[:]";
      return `[${v.pairs.map((pr) => `${serialize(pr.key)}: ${serialize(pr.value)}`).join(", ")}]`;
  }
}

function formatFloat(n: number): string {
  // Director prints whole floats with a trailing ".0000"; the maps only carry fractional floats
  // (e.g. 0.0625), so String() round-trips them. Guard the whole-float case anyway.
  if (Number.isInteger(n)) return n.toFixed(4);
  return String(n);
}

// ── small helpers the editor model builds on ──────────────────────────────────────────────────────
/** Look up a value by symbol key in a prop-list (returns undefined if absent or not a prop-list). */
export function propGet(v: LingoValue | undefined, key: string): LingoValue | undefined {
  if (!v || v.t !== "props") return undefined;
  const hit = v.pairs.find((p) => p.key.t === "sym" && p.key.v === key);
  return hit?.value;
}

/** Set (or append) a symbol-keyed entry in a prop-list, in place. No-op if `v` isn't a prop-list. */
export function propSet(v: LingoValue, key: string, value: LingoValue): void {
  if (v.t !== "props") return;
  const hit = v.pairs.find((p) => p.key.t === "sym" && p.key.v === key);
  if (hit) hit.value = value;
  else v.pairs.push({ key: { t: "sym", v: key }, value });
}

/** Structural deep-equality for round-trip assertions/tests. */
export function deepEqual(a: LingoValue, b: LingoValue): boolean {
  if (a.t !== b.t) return false;
  switch (a.t) {
    case "int": case "float": return a.v === (b as any).v;
    case "str": case "sym": case "atom": return a.v === (b as any).v;
    case "call": {
      const bb = b as Extract<LingoValue, { t: "call" }>;
      return a.name === bb.name && a.args.length === bb.args.length && a.args.every((x, i) => deepEqual(x, bb.args[i]!));
    }
    case "list": {
      const bb = b as Extract<LingoValue, { t: "list" }>;
      return a.items.length === bb.items.length && a.items.every((x, i) => deepEqual(x, bb.items[i]!));
    }
    case "props": {
      const bb = b as Extract<LingoValue, { t: "props" }>;
      return a.pairs.length === bb.pairs.length &&
        a.pairs.every((pr, i) => deepEqual(pr.key, bb.pairs[i]!.key) && deepEqual(pr.value, bb.pairs[i]!.value));
    }
  }
}
