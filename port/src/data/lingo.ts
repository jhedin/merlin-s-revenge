// Parser for Lingo literal values as found in casts/data/*.txt (see PLAN_REVIEW §3 for the
// grammar audit). Produces plain JS values:
//   proplist [#k: v]   -> object { k: v }           (keys are symbols, '#' stripped)
//   list     [a, b]    -> array [a, b]
//   [:] / [] -> {} / []
//   #sym               -> "#sym"  (leading '#' retained to distinguish from real strings)
//   "str"              -> "str"
//   1 / -2 / .5 / 5.0  -> number
//   true/false/void    -> boolean / null
//   point(x,y)         -> { x, y }     (args may be tagged nodes)
//   rgb(r,g,b)         -> { r, g, b }
//   rect(l,t,r,b)      -> { left, top, right, bottom }
//   member("n","lib")  -> { $member: ["n","lib"] }   (value() expression, kept tagged)
//   gGlobal            -> { $global: "gGlobal" }
//   foo(args)          -> { $call: "foo", args: [...] }   (e.g. random(450))

export type Lingo =
  | number | string | boolean | null
  | Lingo[]
  | { [k: string]: Lingo }
  | Point | Rgb | RectV | MemberRef | GlobalRef | CallRef;

export interface Point { x: Lingo; y: Lingo; }
export interface Rgb { r: Lingo; g: Lingo; b: Lingo; }
export interface RectV { left: Lingo; top: Lingo; right: Lingo; bottom: Lingo; }
export interface MemberRef { $member: [string, string?]; }
export interface GlobalRef { $global: string; }
export interface CallRef { $call: string; args: Lingo[]; }

type Tok =
  | { t: "["; } | { t: "]"; } | { t: "("; } | { t: ")"; }
  | { t: ","; } | { t: ":"; } | { t: "|"; }
  | { t: "sym"; v: string } | { t: "id"; v: string }
  | { t: "str"; v: string } | { t: "num"; v: number }
  | { t: "eof"; };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  const isIdStart = (c: string) => /[A-Za-z_]/.test(c);
  const isId = (c: string) => /[A-Za-z0-9_]/.test(c);
  while (i < n) {
    const c = src[i]!;
    if (c === " " || c === "\t" || c === "\r" || c === "\n") { i++; continue; }
    if (c === "-" && src.startsWith("--", i)) { // line comment (tlk_/cutscene; harmless in data)
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    switch (c) {
      case "[": toks.push({ t: "[" }); i++; continue;
      case "]": toks.push({ t: "]" }); i++; continue;
      case "(": toks.push({ t: "(" }); i++; continue;
      case ")": toks.push({ t: ")" }); i++; continue;
      case ",": toks.push({ t: "," }); i++; continue;
      case ":": toks.push({ t: ":" }); i++; continue;
      case "|": toks.push({ t: "|" }); i++; continue;
    }
    if (c === '"') {
      let j = i + 1; let s = "";
      while (j < n && src[j] !== '"') { s += src[j]; j++; }
      toks.push({ t: "str", v: s }); i = j + 1; continue;
    }
    if (c === "#") {
      let j = i + 1; let s = "";
      while (j < n && isId(src[j]!)) { s += src[j]; j++; }
      toks.push({ t: "sym", v: s }); i = j; continue;
    }
    // number: optional '-', digits with optional leading/!embedded dot
    if (c === "-" || c === "." || /[0-9]/.test(c)) {
      const m = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
      if (m && m[0] !== "-" && m[0] !== ".") {
        toks.push({ t: "num", v: Number(m[0]) }); i += m[0].length; continue;
      }
    }
    if (isIdStart(c)) {
      let j = i; let s = "";
      while (j < n && isId(src[j]!)) { s += src[j]; j++; }
      toks.push({ t: "id", v: s }); i = j; continue;
    }
    throw new Error(`lingo: unexpected char ${JSON.stringify(c)} at ${i}`);
  }
  toks.push({ t: "eof" });
  return toks;
}

class Parser {
  private p = 0;
  constructor(private toks: Tok[]) {}
  private peek(): Tok { return this.toks[this.p]!; }
  private take(): Tok { return this.toks[this.p++]!; }
  private expect(t: Tok["t"]): Tok {
    const tok = this.take();
    if (tok.t !== t) throw new Error(`lingo: expected '${t}', got '${tok.t}'`);
    return tok;
  }
  atEof(): boolean { return this.peek().t === "eof"; }

  value(): Lingo {
    const tok = this.peek();
    switch (tok.t) {
      case "[": return this.bracket();
      case "sym": this.take(); return "#" + (tok as any).v;
      case "str": this.take(); return (tok as any).v;
      case "num": this.take(); return (tok as any).v;
      case "id": return this.idOrCall();
      default: throw new Error(`lingo: unexpected token '${tok.t}'`);
    }
  }

  private bracket(): Lingo {
    this.expect("[");
    // [:] empty proplist
    if (this.peek().t === ":") { this.take(); this.expect("]"); return {}; }
    // [] empty list
    if (this.peek().t === "]") { this.take(); return []; }
    const first = this.value();
    if (this.peek().t === ":") {
      // proplist: first must be a symbol key
      const obj: Record<string, Lingo> = {};
      const key = (k: Lingo) => typeof k === "string" && k.startsWith("#") ? k.slice(1) : String(k);
      this.expect(":");
      obj[key(first)] = this.value();
      while (this.peek().t === ",") {
        this.take();
        const k = this.value(); this.expect(":");
        obj[key(k)] = this.value();
      }
      this.expect("]");
      return obj;
    }
    // list
    const arr: Lingo[] = [first];
    while (this.peek().t === ",") { this.take(); arr.push(this.value()); }
    this.expect("]");
    return arr;
  }

  private idOrCall(): Lingo {
    const id = (this.take() as any).v as string;
    const low = id.toLowerCase();
    if (this.peek().t !== "(") {
      if (low === "true") return true;
      if (low === "false") return false;
      if (low === "void") return null;
      return { $global: id };
    }
    const args = this.args();
    switch (id) {
      case "point": return { x: args[0] ?? 0, y: args[1] ?? 0 };
      case "rgb": return { r: args[0] ?? 0, g: args[1] ?? 0, b: args[2] ?? 0 };
      case "rect": return { left: args[0] ?? 0, top: args[1] ?? 0, right: args[2] ?? 0, bottom: args[3] ?? 0 };
      case "member": return { $member: [String(args[0]), args[1] != null ? String(args[1]) : undefined] };
      default: return { $call: id, args };
    }
  }

  private args(): Lingo[] {
    this.expect("(");
    const out: Lingo[] = [];
    if (this.peek().t !== ")") {
      out.push(this.value());
      while (this.peek().t === ",") { this.take(); out.push(this.value()); }
    }
    this.expect(")");
    return out;
  }
}

/** Parse a single Lingo value. */
export function parseLingo(src: string): Lingo {
  const p = new Parser(tokenize(src));
  const v = p.value();
  return v;
}

/** Parse every top-level value in `src` (data files have header then payload). */
export function parseLingoAll(src: string): Lingo[] {
  const p = new Parser(tokenize(src));
  const out: Lingo[] = [];
  while (!p.atEof()) out.push(p.value());
  return out;
}

export interface DataFile { header: Record<string, Lingo>; data: Lingo; }

/** Split a data .txt into its header proplist (line 1) and payload value (line 2+). */
export function parseDataFile(src: string): DataFile {
  const all = parseLingoAll(src);
  if (all.length === 0) throw new Error("lingo: empty file");
  const header = (typeof all[0] === "object" && !Array.isArray(all[0]) ? all[0] : {}) as Record<string, Lingo>;
  const data = all.length > 1 ? all[1]! : null;
  return { header, data };
}
