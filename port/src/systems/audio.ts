// Audio: real extracted SFX (PCM wav -> Web Audio buffers, low-latency + overlapping) and music
// (MP3 -> a looping HTMLAudioElement, streamed). Browsers block audio until a user gesture, so
// the context starts suspended and `unlock()` (called on the first key/click) resumes it.
//
// Channel model — faithful port of master_objects/soundMaster (init / playSound / playMusic /
// stopSound, plus general_functions/soundEmptyChan() and VarChangeInRange()). The original keeps
// a fixed pool of 8 Director sound channels: channel 1 is reserved for music (pMusicChannel = 1)
// and channels 2..8 are the SFX pool. A round-robin cursor (pNextChan, starting at 2) picks the
// next SFX channel; if that channel is busy it falls back to soundEmptyChan(), which scans 2->8
// and returns the LOWEST-numbered free channel, or 0 if every SFX channel is busy. When all are
// busy the new effect is DROPPED (soundMaster's "override oldest" branch is commented out in the
// source). Volume is the original 0..255 scale (pDefaultVolume = 150), mapped here to gain 0..1.

import type { AssetIndex } from "../render/assets";

/** Director sound-channel count and the music channel reservation (soundMaster.init: pMusicChannel = 1). */
export const SOUND_CHANNELS = 8;
export const MUSIC_CHANNEL = 1;
export const FIRST_SFX_CHANNEL = 2;
/** soundMaster.init: pDefaultVolume = 150 (on the original 0..255 scale). */
export const DEFAULT_VOLUME_255 = 150;

/** soundMaster's 0..255 volume -> Web Audio gain 0..1. */
export function vol255ToGain(vol: number): number {
  return Math.max(0, Math.min(255, vol)) / 255;
}

interface Channel {
  /** soundBusy(chan) — claimed from play() until the buffer ends or stopSound() frees it. Tracked
   *  as a flag (not just `src`) so the allocation policy is identical with or without a backend. */
  busy: boolean;
  /** the playing buffer source, or null when the backend is absent/finished */
  src: AudioBufferSourceNode | null;
  /** this channel's gain node (for adjustVol), or null when idle */
  gain: GainNode | null;
  /** the effect name currently routed through the channel (diagnostics / tests) */
  name: string;
}

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

  // soundMaster.pMixMaster — a fixed pool of channels (index 0 unused so 1..8 match Lingo).
  private channels: Channel[] = Array.from({ length: SOUND_CHANNELS + 1 }, () => ({ busy: false, src: null, gain: null, name: "empty" }));
  // soundMaster.pNextChan — round-robin cursor, starts at the first SFX channel.
  private nextChan = FIRST_SFX_CHANNEL;

  constructor(private index: AssetIndex, private base = "/assets/") {}

  has(name: string): boolean { return !!this.index.sounds?.[name]; }

  /** Channel accessor for the fixed 1..SOUND_CHANNELS pool (always populated). */
  private channelAt(chan: number): Channel {
    return this.channels[chan]!;
  }

  /** soundBusy(chan) — true while an effect is claimed on the channel. */
  private soundBusy(chan: number): boolean {
    return chan >= 1 && chan <= SOUND_CHANNELS && this.channelAt(chan).busy;
  }

  /** soundBusy(chan), public for diagnostics / tests. */
  isBusy(chan: number): boolean { return this.soundBusy(chan); }

  /**
   * soundEmptyChan() — scan SFX channels 2..8 and return the lowest free one, or 0 if all busy.
   * Channel 1 is reserved for music and never returned here.
   */
  private soundEmptyChan(): number {
    for (let chan = FIRST_SFX_CHANNEL; chan <= SOUND_CHANNELS; chan++) {
      if (!this.soundBusy(chan)) return chan;
    }
    return 0;
  }

  /** VarChangeInRange(var, 1, 8, 1) — advance the cursor, wrapping 8 -> 1. */
  private advanceNextChan(): void {
    let v = this.nextChan + 1;
    if (v > SOUND_CHANNELS) v -= SOUND_CHANNELS;
    if (v < 1) v += SOUND_CHANNELS;
    this.nextChan = v;
  }

  /**
   * soundMaster.playSound channel allocation, decoupled from the audio backend so it is unit
   * testable: pick pNextChan if free, else the lowest free SFX channel, else 0 (drop). Always
   * advances the round-robin cursor afterwards (matching the original, which advances even on drop).
   * Returns the chosen channel (0 = dropped).
   */
  allocateChannel(): number {
    // soundMaster.playSound: if pNextChan is busy, fall back to the lowest free SFX channel.
    // (pNextChan can wrap onto the music channel 1; soundBusy(1) is true while music plays, so it
    // also falls through to soundEmptyChan() there.)
    const chan = this.soundBusy(this.nextChan) ? this.soundEmptyChan() : this.nextChan;
    this.advanceNextChan();
    return chan;
  }

  /** Channel occupancy snapshot for diagnostics / tests. */
  channelState(): { chan: number; name: string }[] {
    return this.channels.slice(1).map((c, i) => ({ chan: i + 1, name: c.name }));
  }

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

  /**
   * soundMaster.playSound — route an effect through the channel pool. `volume` keeps the existing
   * 0..1 caller contract (a multiplier on sfxGain); pass `vol255` to use the original 0..255 scale
   * (defaulting to pDefaultVolume = 150) instead. Returns the channel used (0 = dropped, all busy).
   */
  play(name: string, volume = 1, vol255?: number): number {
    // soundMaster filters #none before ever calling playSound — a #none/empty name is a no-op that must
    // NOT claim a channel (otherwise the channel leaks: no buffer → no onended → busy stays true forever,
    // and after SOUND_CHANNELS such calls every real SFX is dropped). Many actors carry dieSound #none.
    if (!name || name === "#none") return 0;
    // Allocation runs even with no backend so the channel bookkeeping (and tests) stay consistent.
    const chan = this.allocateChannel();
    if (chan <= 0) return 0;                  // all SFX channels busy -> dropped (matches soundMaster)
    // Claim the channel immediately so concurrent calls consume distinct channels even before the
    // backend confirms playback (headless/test path: soundBusy() reflects this until stopSound()).
    const slot = this.channelAt(chan);
    slot.busy = true;
    slot.name = name;
    if (this.muted || !this.ctx || !this.master) { slot.src = null; slot.gain = null; return chan; }
    const buf = this.buffers.get(name);
    // not loaded in a live context -> silent, and FREE the channel: no source means no onended will ever
    // fire to clear `busy`, so holding it would leak the channel (vs the muted/headless path above, which
    // intentionally keeps the claim for stopSound()-driven test bookkeeping).
    if (!buf) { slot.busy = false; slot.src = null; slot.gain = null; slot.name = "empty"; return chan; }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    // calcVolumeDefault: 0..255 scale takes precedence when provided; otherwise the 0..1 multiplier.
    const gain = vol255 !== undefined ? vol255ToGain(vol255) : volume * this.sfxGain;
    g.gain.value = gain;
    src.connect(g).connect(this.master);
    slot.src = src;
    slot.gain = g;
    // soundBusy() clears when the buffer finishes — mirror that so the channel frees for reuse.
    src.onended = () => { if (slot.src === src) { slot.busy = false; slot.src = null; slot.gain = null; slot.name = "empty"; } };
    src.start();
    return chan;
  }

  /** soundMaster.adjustVol me, theChan, theVol — set a live channel's volume on the 0..255 scale. */
  adjustVol(chan: number, vol255: number): void {
    if (chan < 1 || chan > SOUND_CHANNELS) return;
    const g = this.channelAt(chan).gain;
    if (g) g.gain.value = vol255ToGain(vol255);
  }

  /** soundMaster.stopSound me, theChan — stop and free a single channel. */
  stopSound(chan: number): void {
    if (chan < 1 || chan > SOUND_CHANNELS) return;
    const slot = this.channelAt(chan);
    if (slot.src) { try { slot.src.stop(); } catch { /* already stopped */ } }
    slot.busy = false;
    slot.src = null;
    slot.gain = null;
    slot.name = "empty";
  }

  /** soundMaster.stopAllSound — stop every channel (music channel included). */
  stopAllSound(): void {
    for (let chan = 1; chan <= SOUND_CHANNELS; chan++) this.stopSound(chan);
  }

  playMusic(name: string): void {
    // soundMaster.playMusic: the "stopMusic" sentinel (act_musicOff's #musicName) stops the track.
    if (name === "stopMusic") { this.stopMusic(); return; }
    const file = this.index.music?.[name];
    if (!file || this.currentMusic === name) return;
    // soundMaster routes music through pMusicChannel (1) via puppetsound; reserve it as soon as
    // music is requested so soundEmptyChan() and the round-robin cursor skip the music channel
    // (checkRestartMusic / soundBusy(pMusicChannel)) — even while playback is deferred to unlock.
    this.channelAt(MUSIC_CHANNEL).busy = true;
    this.channelAt(MUSIC_CHANNEL).name = name;
    if (!this.ctx) { this.pendingMusic = name; return; } // defer until unlocked
    this.currentMusic = name;
    if (!this.musicEl) { this.musicEl = new Audio(); this.musicEl.loop = true; }
    this.musicEl.src = this.base + file;
    this.musicEl.volume = this.muted ? 0 : this.musicVol;
    this.musicEl.play().catch(() => {});
  }

  stopMusic(): void {
    this.musicEl?.pause();
    this.currentMusic = ""; this.pendingMusic = "";
    this.channelAt(MUSIC_CHANNEL).busy = false;
    this.channelAt(MUSIC_CHANNEL).name = "empty";
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    if (this.musicEl) this.musicEl.volume = this.muted ? 0 : this.musicVol;
    return this.muted;
  }
}
