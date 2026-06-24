#!/usr/bin/env python3
"""
Extract embedded assets from a Macromedia/Adobe Director RIFX movie (.dir).

Handles little-endian (XFIR) Director MX-era files and pulls out:
  * sounds  -> WAV   (sndH header + sndS PCM, paired via the KEY* table)
  * bitmaps -> PNG   (BITD PackBits, 1/8/16/32-bit, alpha plane preserved)

Cast-member names are recovered from the CastInfo block where present.
Director stores 32-bit bitmaps planar-per-scanline in A,R,G,B order.

Usage: extract_assets.py <movie.dir> <output_dir>
"""
import struct, os, sys, wave, array, re
import numpy as np
from PIL import Image

def parse(path):
    data = open(path, 'rb').read()
    if data[:4] != b'XFIR':
        raise SystemExit("expected little-endian RIFX (XFIR): %r" % data[:4])
    end = '<'
    u32 = lambda o: struct.unpack(end+'I', data[o:o+4])[0]
    size = u32(16); body = data[20:20+size]
    mmap_off = struct.unpack(end+'I', body[4:8])[0]
    msize = u32(mmap_off+4); mb = data[mmap_off+8:mmap_off+8+msize]
    hl, el, cmax, cused = struct.unpack(end+'HHII', mb[0:12])
    fc = lambda b: b[::-1].decode('latin1')
    ents = {}
    for i in range(cused):
        e = mb[hl+i*el:hl+(i+1)*el]
        if len(e) < 12: break
        t = fc(e[0:4]); s, o = struct.unpack(end+'II', e[4:12])
        ents[i] = (t, s, o)
    keyid = next(i for i in ents if ents[i][0] == 'KEY*')
    _, s, o = ents[keyid]; kb = data[o+8:o+8+s]
    khl, kel, kmax, kused = struct.unpack(end+'HHII', kb[0:12])
    owner_to = {}
    for i in range(kused):
        e = kb[khl+i*kel:khl+(i+1)*kel]
        child, owner = struct.unpack(end+'II', e[0:8]); cc = fc(e[8:12])
        owner_to.setdefault(owner, {})[cc] = child
    return data, ents, owner_to

def chunk(data, ents, rid):
    t, s, o = ents[rid]; return data[o+8:o+8+s]

def cast_name(data, ents, owner):
    b = chunk(data, ents, owner)
    if len(b) < 12: return None
    ctype, infoLen, specLen = struct.unpack('>III', b[0:12])
    info = b[12:12+infoLen]
    names = re.findall(rb'[A-Za-z0-9_][ -~]{1,38}', info)
    names = [n for n in names if re.search(rb'[A-Za-z]', n)]
    return names[0].decode('latin1').strip() if names else None

def bmp_info(data, ents, owner):
    b = chunk(data, ents, owner)
    ctype, infoLen, specLen = struct.unpack('>III', b[0:12])
    sp = b[12+infoLen:12+infoLen+specLen]
    s16 = lambda o: struct.unpack('>h', sp[o:o+2])[0]
    u16 = lambda o: struct.unpack('>H', sp[o:o+2])[0]
    pitch = u16(0) & 0x7fff
    top, left, bottom, right = s16(2), s16(4), s16(6), s16(8)
    regY = s16(18) if specLen >= 20 else 0   # registration point (sprite anchor),
    regX = s16(20) if specLen >= 22 else 0   # big-endian s16 in the BITD specific data
    depth = sp[23] if specLen >= 24 else 1
    return dict(w=right-left, h=bottom-top, pitch=pitch, depth=depth,
                regX=regX, regY=regY, specLen=specLen)

def unpackbits(src, expected):
    """Director BITD PackBits RLE -> exactly `expected` bytes."""
    if len(src) >= expected:                       # already raw / uncompressed
        return src[:expected]
    out = bytearray(); i = 0; n = len(src)
    while i < n and len(out) < expected:
        b = src[i]; i += 1
        if b <= 0x7f:
            out += src[i:i+b+1]; i += b+1
        else:
            if i >= n: break
            out += bytes([src[i]]) * (0x101 - b); i += 1
    if len(out) < expected:
        out += bytes(expected - len(out))
    return bytes(out)

MAC_SYS = None
def mac_palette():
    """Standard Mac OS 8-bit system palette (used as default for 8-bit casts)."""
    global MAC_SYS
    if MAC_SYS is not None: return MAC_SYS
    levels = [255, 204, 153, 102, 51, 0]
    pal = []
    for r in levels:
        for g in levels:
            for b in levels:
                pal.append((r, g, b))
    extra = [0xEE,0xDD,0xBB,0xAA,0x88,0x77,0x55,0x44,0x22,0x11]
    for v in extra: pal.append((v,0,0))
    for v in extra: pal.append((0,v,0))
    for v in extra: pal.append((0,0,v))
    for v in extra: pal.append((v,v,v))
    pal.append((0,0,0))
    pal = (pal + [(0,0,0)]*256)[:256]
    MAC_SYS = pal
    return pal

def _clut_from_chunk(data, ents, cid):
    raw = chunk(data, ents, cid)
    # CLUT entries are 6 bytes: R,R,G,G,B,B (16-bit per channel, big-endian)
    n = len(raw) // 6
    pal = [(raw[i*6], raw[i*6+2], raw[i*6+4]) for i in range(n)]
    return (pal + [(0,0,0)]*256)[:256]

def bmp_palette_ref(data, ents, owner):
    """The palette cast-member the bitmap references (specLen>=28: s16 at sp[26]). Negative = a built-in
    system palette (#systemMac -1 / #systemWin -101 / ...); positive = a custom CLUT cast member."""
    b = chunk(data, ents, owner)
    _, infoLen, specLen = struct.unpack('>III', b[0:12])
    sp = b[12+infoLen:12+infoLen+specLen]
    return struct.unpack('>h', sp[26:28])[0] if specLen >= 28 else None

# 8-bit cast bitmaps name their palette by cast-member ref, but the dump has no member->CLUT cross-reference
# for these (the CLUT chunks are owned by the palette members, whose ids don't match the ref numbering). Map
# the verified refs to their CLUT chunk. ref 37 = the title-letter palette (the blue 3D-bevel "MERLIN'S
# REVENGE" glyphs) -> CLUT@456350; without this they fell back to mac_palette() and rendered as rainbow bands.
PALETTE_REF_CLUT = {37: 456350}

def get_clut(data, ents, owner_to, owner):
    ch = owner_to.get(owner, {})
    if 'CLUT' in ch:
        return _clut_from_chunk(data, ents, ch['CLUT'])
    ref = bmp_palette_ref(data, ents, owner)
    cid = PALETTE_REF_CLUT.get(ref)
    if cid is not None and cid in ents:
        return _clut_from_chunk(data, ents, cid)
    return mac_palette()

def decode_bitmap(data, ents, owner_to, owner):
    info = bmp_info(data, ents, owner)
    w, h, pitch, depth = info['w'], info['h'], info['pitch'], info['depth']
    if w <= 0 or h <= 0 or 'BITD' not in owner_to.get(owner, {}):
        return None
    raw = chunk(data, ents, owner_to[owner]['BITD'])
    buf = unpackbits(raw, pitch*h)
    a = np.frombuffer(buf, dtype=np.uint8)[:pitch*h].reshape(h, pitch)
    if depth == 32:
        al, r, g, b = a[:, 0:w], a[:, w:2*w], a[:, 2*w:3*w], a[:, 3*w:4*w]
        img = np.dstack([r, g, b, al]).astype(np.uint8)
        return Image.fromarray(img, 'RGBA')
    if depth == 16:
        hi = a[:, 0:2*w:2].astype(np.uint16); lo = a[:, 1:2*w:2].astype(np.uint16)
        v = (hi << 8) | lo
        r = ((v >> 10) & 31) << 3; g = ((v >> 5) & 31) << 3; bl = (v & 31) << 3
        img = np.dstack([r, g, bl, np.full_like(r, 255)]).astype(np.uint8)
        return Image.fromarray(img, 'RGBA')
    if depth == 8:
        pal = np.array(get_clut(data, ents, owner_to, owner), dtype=np.uint8)
        idx = a[:, :w]
        rgb = pal[idx]
        return Image.fromarray(rgb, 'RGB')
    if depth == 1:
        bits = np.unpackbits(a, axis=1)[:, :w]
        img = np.where(bits == 0, 255, 0).astype(np.uint8)
        return Image.fromarray(img, 'L')
    return None

def safe(name, fallback):
    if not name: return fallback
    s = "".join(c if c.isalnum() or c in "-_." else "_" for c in name)[:40].strip("_")
    return s or fallback

def extract_sounds(data, ents, owner_to, outdir):
    os.makedirs(outdir, exist_ok=True)
    beu = lambda b, o, n: int.from_bytes(b[o:o+n], 'big')
    n = 0
    for owner, ch in owner_to.items():
        if 'sndH' not in ch or 'sndS' not in ch: continue
        h = chunk(data, ents, ch['sndH']); pcm = chunk(data, ents, ch['sndS'])
        rate = beu(h, 0x30, 4) or 22050
        bps = beu(h, 0x50, 4); bps = bps if bps in (1, 2) else 2
        chs = beu(h, 0x4c, 4); chs = chs if chs in (1, 2) else 1
        nm = safe(cast_name(data, ents, owner) if ents.get(owner, ('',))[0] == 'CASt' else None, "snd_%d" % owner)
        fn = os.path.join(outdir, "%03d_%s.wav" % (n, nm))
        w = wave.open(fn, 'wb'); w.setnchannels(chs); w.setsampwidth(bps); w.setframerate(rate)
        if bps == 2:
            arr = array.array('h'); arr.frombytes(pcm[:len(pcm)//2*2]); arr.byteswap()
            w.writeframes(arr.tobytes())
        else:
            w.writeframes(bytes((x+128) & 0xff for x in pcm))
        w.close(); n += 1
    return n

def extract_bitmaps(data, ents, owner_to, outdir):
    os.makedirs(outdir, exist_ok=True)
    n = 0; fail = 0; meta = []
    for owner, ch in owner_to.items():
        if 'BITD' not in ch: continue
        if ents.get(owner, ('',))[0] != 'CASt': continue
        try:
            info = bmp_info(data, ents, owner)
            img = decode_bitmap(data, ents, owner_to, owner)
            if img is None: continue
            nm = safe(cast_name(data, ents, owner), "")
            base = ("%05d_%s" % (owner, nm)).rstrip("_")
            fn = base + ".png"
            img.save(os.path.join(outdir, fn))
            # registration point = sprite anchor; ESSENTIAL for correct draw/spawn alignment.
            meta.append({"file": "bitmaps/" + fn, "id": owner, "name": nm,
                         "w": info["w"], "h": info["h"], "depth": info["depth"],
                         "reg": [info["regX"], info["regY"]]})
            n += 1
        except Exception:
            fail += 1
    # sidecar metadata so the animation baker / renderer has reg points + dims
    import json
    with open(os.path.join(os.path.dirname(outdir), "bitmaps.meta.json"), "w") as f:
        json.dump(meta, f, indent=0)
    return n, fail

def extract_music(data, ents, owner_to, outdir):
    """Director stores streamed music as MP3 inside ediM (compressed media) cast members."""
    os.makedirs(outdir, exist_ok=True)
    child_owner = {child: owner for owner, kids in owner_to.items() for child in kids.values()}
    n = 0
    for rid, (t, s, o) in ents.items():
        if t != 'ediM' or s < 40000:           # music tracks are large; small ediM are images/etc
            continue
        b = data[o + 8:o + 8 + s]
        if not (b[:3] == b'ID3' or (b[0] == 0xFF and (b[1] & 0xE0) == 0xE0)):
            continue                            # only raw-MP3 ediM members are music
        owner = child_owner.get(rid)
        nm = cast_name(data, ents, owner) if owner is not None else None
        nm = (nm or "music_%d" % rid).split("kMoaCfFormat")[0]  # strip Director's format suffix
        with open(os.path.join(outdir, safe(nm, "music_%d" % rid) + ".mp3"), 'wb') as f:
            f.write(b)
        n += 1
    return n


if __name__ == "__main__":
    movie, outdir = sys.argv[1], sys.argv[2]
    data, ents, owner_to = parse(movie)
    ns = extract_sounds(data, ents, owner_to, os.path.join(outdir, "sounds"))
    nm = extract_music(data, ents, owner_to, os.path.join(outdir, "music"))
    nb, fb = extract_bitmaps(data, ents, owner_to, os.path.join(outdir, "bitmaps"))
    print("%s: %d sounds, %d music, %d bitmaps (%d failed)" % (os.path.basename(movie), ns, nm, nb, fb))
