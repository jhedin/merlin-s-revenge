// Audio: real extracted SFX (PCM wav -> Web Audio buffers, low-latency + overlapping) and music
// (MP3 -> a looping HTMLAudioElement, streamed). Browsers block audio until a user gesture, so
// the context starts suspended and `unlock()` (called on the first key/click) resumes it.

import type { AssetIndex } from "../render/assets";

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private musicEl: HTMLAudioElement | null = null;
  private pendingMusic = "";   // requested before unlock; started on the first gesture
  private currentMusic = "";
  muted = false;
  private sfxGain = 0.7;
  private musicVol = 0.32;

  constructor(private index: AssetIndex, private base = "/assets/") {}

  has(name: string): boolean { return !!this.index.sounds?.[name]; }

  /** diagnostics for headless verification */
  debug(): { state: string; buffers: number; music: string } {
    return { state: this.ctx?.state ?? "none", buffers: this.buffers.size, music: this.currentMusic };
  }

  /** Create the context (suspended) and decode every SFX up front; safe before a user gesture. */
  preload(): void {
    if (this.ctx || typeof AudioContext === "undefined") return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    for (const [name, file] of Object.entries(this.index.sounds ?? {})) {
      fetch(this.base + file)
        .then((r) => r.arrayBuffer())
        .then((buf) => this.ctx!.decodeAudioData(buf))
        .then((decoded) => this.buffers.set(name, decoded))
        .catch(() => { /* a missing/odd sound just stays silent */ });
    }
  }

  /** Resume on the first user interaction and start any music requested while suspended. */
  unlock(): void {
    this.preload();
    this.ctx?.resume().catch(() => {});
    if (this.pendingMusic) { const m = this.pendingMusic; this.pendingMusic = ""; this.playMusic(m); }
  }

  play(name: string, volume = 1): void {
    if (this.muted || !this.ctx || !this.master) return;
    const buf = this.buffers.get(name);
    if (!buf) return;                       // not loaded / no such sound -> silent
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = volume * this.sfxGain;
    src.connect(g).connect(this.master);
    src.start();
  }

  playMusic(name: string): void {
    // soundMaster.playMusic: the "stopMusic" sentinel (act_musicOff's #musicName) stops the track.
    if (name === "stopMusic") { this.stopMusic(); return; }
    const file = this.index.music?.[name];
    if (!file || this.currentMusic === name) return;
    if (!this.ctx) { this.pendingMusic = name; return; } // defer until unlocked
    this.currentMusic = name;
    if (!this.musicEl) { this.musicEl = new Audio(); this.musicEl.loop = true; }
    this.musicEl.src = this.base + file;
    this.musicEl.volume = this.muted ? 0 : this.musicVol;
    this.musicEl.play().catch(() => {});
  }

  stopMusic(): void { this.musicEl?.pause(); this.currentMusic = ""; this.pendingMusic = ""; }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    if (this.musicEl) this.musicEl.volume = this.muted ? 0 : this.musicVol;
    return this.muted;
  }
}
