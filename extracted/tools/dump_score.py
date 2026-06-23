#!/usr/bin/env python3
"""
Director Score (VWSC) parser for merlin_engine_76_speed.dir.

Recovers per-frame sprite-channel compositions from the delta-compressed Score
chunk and resolves each sprite's memberID to an extracted bitmap.

Run from the repo root:  python3 extracted/tools/dump_score.py [frame ...]

VWSC layout (this movie, Director MX 2004 / v10), all big-endian inside chunk:
  [0]  u32 total chunk size            (== len)
  [4]  i32 version/marker  (-3)
  [8]  u32 = 12
  [12] u32 numFrames                   (3773)
  [16] u32 numFrames+1
  [20] u32 frame-data region size      (149200)
  [28] u32 = min offset table value
  [32..] u32 per-frame offset table (numFrames entries). Each entry is the
         absolute chunk offset of that frame's delta block. Consecutive equal
         entries = unchanged frames (the block was already applied).

Delta block (between a frame's offset and the next strictly-greater offset in
the table) is a sequence of records:
      u16 writeOffset, u16 size, <size> bytes
written into a persistent ~48 KB Score channel buffer.

The channel buffer holds fixed 48-byte sprite-channel records (D7/D10 layout),
preceded by a 256-byte frame main-channel header (palette/tempo/script/etc),
i.e. the sprite array begins at buffer offset 256.

Sprite record (48 bytes), big-endian, D7/D10 field offsets within the record
(verified empirically against the title screen "MERLINS" letter glyphs):
   0  u8  spriteType
   1  u8  inkData  (ink = &0x3f, trails 0x40, stretch 0x80)
   2  u8  foreColor
   3  u8  backColor
   4  u16 castLib            (castId.castLib)
   6  u16 memberID           (castId.member, 1-based slot in the castLib)
   8  u32 spriteListIdx
   12 u16 locV  (startPoint.y)
   14 u16 locH  (startPoint.x)
   16 u16 height
   18 u16 width
   20 u8  colorcode/flags
   21 u8  blendAmount
   ...  remaining bytes reserved/zero

memberID resolves to a CASt chunk via the per-castLib CAS* tables (a big-endian
u32 array indexed by member number-1). Those chunk ids match the extracted
manifest's bitmap 'id'.
"""
import struct, importlib.util, json, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)

spec = importlib.util.spec_from_file_location('ea', 'extracted/tools/extract_assets.py')
ea = importlib.util.module_from_spec(spec); spec.loader.exec_module(ea)

STAGE_W, STAGE_H = 576, 288
SPRITE_REC = 48
HEADER = 256        # main-channel header before the sprite array

def load_vwsc():
    data, ents, owner_to = ea.parse('merlin_engine_76_speed.dir')
    vw = [i for i, (t, s, o) in ents.items() if t == 'VWSC'][0]
    b = ea.chunk(data, ents, vw)
    return data, ents, owner_to, b

def BEf(b):
    return lambda o, n=4: int.from_bytes(b[o:o+n], 'big')

def frame_offsets(b):
    BE = BEf(b)
    nf = BE(12)
    return [BE(32 + i * 4) for i in range(nf)], nf

def replay_to(b, target_frame):
    """Replay delta blocks cumulatively up to and including target_frame.
    Returns the channel buffer (bytearray)."""
    BE = BEf(b)
    offs, nf = frame_offsets(b)
    region_end = BE(20) and (len(b))  # blocks end at next distinct offset, capped by chunk len
    # sorted distinct offsets to find each block's end boundary
    distinct = sorted(set(offs))
    next_after = {}
    for i, o in enumerate(distinct):
        next_after[o] = distinct[i + 1] if i + 1 < len(distinct) else len(b)

    buf = bytearray(48 * 1024)

    def apply_block(off):
        p = off
        end = next_after[off]
        while p + 4 <= end:
            woff = BE(p, 2); size = BE(p + 2, 2); p += 4
            if size == 0 and woff == 0:
                break
            if woff + size > len(buf):
                buf.extend(b'\x00' * (woff + size - len(buf)))
            buf[woff:woff + size] = b[p:p + size]
            p += size

    last = -1
    for fr in range(0, target_frame + 1):
        o = offs[fr]
        if o != last:
            apply_block(o)
            last = o
    return buf

def decode_sprites(buf, max_channels=250):
    """Decode 48-byte sprite-channel records (D7/D10 layout) into dicts.

    The live sprite array begins at buffer offset 256. We stop at the first
    record whose castLib is outside the valid 1..9 range *after* the contiguous
    valid block, because the channel buffer's tail holds stale/other-structure
    bytes that do not belong to the active sprite array."""
    sprites = []
    BE = lambda o, n=2: int.from_bytes(buf[o:o + n], 'big')
    SB = lambda o: int.from_bytes(buf[o:o + 2], 'big', signed=True)
    n_chan = min(max_channels, (len(buf) - HEADER) // SPRITE_REC)
    for ch in range(n_chan):
        base = HEADER + ch * SPRITE_REC
        rec = buf[base:base + SPRITE_REC]
        castLib = BE(base + 4)
        member = BE(base + 6)
        empty = not any(rec)
        # A valid live channel is either empty (placeholder) or references a real
        # cast library (1..9). The first out-of-range castLib marks end of array.
        if not empty and not (1 <= castLib <= 9):
            break
        if empty or member == 0:
            continue
        spriteType = rec[0]
        ink = rec[1] & 0x3f
        fore = rec[2]; back = rec[3]
        spriteListIdx = BE(base + 8, 4)
        locV = SB(base + 12)
        locH = SB(base + 14)
        height = BE(base + 16)
        width = BE(base + 18)
        sprites.append(dict(channel=ch, spriteType=spriteType, ink=ink,
                            fore=fore, back=back, castLib=castLib, member=member,
                            listIdx=spriteListIdx,
                            locH=locH, locV=locV, w=width, h=height,
                            raw=rec.hex()))
    return sprites

# Cast library names in MCsL (movie cast list) order = the castLib numbering.
CASTLIB_NAMES = ['Internal', 'gfx', 'temp', 'data', 'sfx', 'main',
                 'master_objects', 'script_objects', 'general_functions']

def build_castlib_tables(data, ents, owner_to):
    """castLib number -> CAS* member table (list of CASt chunk ids, member# = idx+1).

    Each CAS* chunk is owned (via KEY*) by a cast-library container whose owner id
    is encoded as (castLibNumber << 16) | 0x400. The CAS* body is a big-endian u32
    array indexed by (memberNumber - 1) giving the member's CASt chunk id."""
    child_owner = {c: o for o, kids in owner_to.items() for c in kids.values()}
    tables = {}
    for rid, (t, s, o) in ents.items():
        if t != 'CAS*':
            continue
        own = child_owner.get(rid)
        if own is None or (own & 0xffff) != 0x400:
            continue
        lib = own >> 16
        b = ea.chunk(data, ents, rid)
        tables[lib] = [int.from_bytes(b[k * 4:k * 4 + 4], 'big')
                       for k in range(len(b) // 4)]
    return tables

def build_member_index():
    """Returns (by_id, bms): manifest bitmaps keyed by their CASt chunk id."""
    man = json.load(open('extracted/manifest.json'))
    bms = man['engine']['bitmaps']
    by_id = {e['id']: e for e in bms}
    return by_id, bms

def resolve(castLib, member, by_id, tables):
    """(castLib, member) -> manifest bitmap entry, via the CAS* member table."""
    tbl = tables.get(castLib)
    if not tbl or not (1 <= member <= len(tbl)):
        return None
    chunk_id = tbl[member - 1]
    return by_id.get(chunk_id)

def dump_frame(frame, by_id=None, tables=None):
    data, ents, owner_to, b = load_vwsc()
    if by_id is None:
        by_id, _ = build_member_index()
    if tables is None:
        tables = build_castlib_tables(data, ents, owner_to)
    buf = replay_to(b, frame)
    sprites = decode_sprites(buf)
    out = []
    for s in sprites:
        bm = resolve(s['castLib'], s['member'], by_id, tables)
        s['castLibName'] = CASTLIB_NAMES[s['castLib'] - 1] if 1 <= s['castLib'] <= 9 else None
        s['bitmap'] = bm['file'] if bm else None
        s['bm_name'] = bm['name'] if bm else None
        s['reg'] = bm['reg'] if bm else None
        s['bm_w'] = bm['w'] if bm else None
        s['bm_h'] = bm['h'] if bm else None
        out.append(s)
    return out

def export_frame_json(frame):
    """Return the composition of `frame` as a JSON-serialisable list of sprites,
    each enriched with its resolved bitmap, registration point and cast info."""
    return dump_frame(frame)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--json':
        fr = int(sys.argv[2]) if len(sys.argv) > 2 else 30
        print(json.dumps(export_frame_json(fr), indent=1))
        sys.exit(0)
    by_id, bms = build_member_index()
    data, ents, owner_to, b = load_vwsc()
    tables = build_castlib_tables(data, ents, owner_to)
    frames = [int(x) for x in sys.argv[1:]] or [30, 120]
    for fr in frames:
        buf = replay_to(b, fr)
        sprites = decode_sprites(buf)
        print(f"\n=== FRAME {fr}: {len(sprites)} active sprite channels ===")
        for s in sprites:
            bm = resolve(s['castLib'], s['member'], by_id, tables)
            name = bm['name'] if bm else '??'
            f = bm['file'] if bm else '-'
            libn = CASTLIB_NAMES[s['castLib'] - 1] if 1 <= s['castLib'] <= 9 else '?'
            ok = '' if bm else '  <UNRESOLVED>'
            inb = (-32 <= s['locH'] <= STAGE_W + 32 and -32 <= s['locV'] <= STAGE_H + 32)
            flag = '' if inb else '  <OOB>'
            print(f"  ch{s['channel']:>3} type={s['spriteType']:>2} ink={s['ink']:>2} "
                  f"cast={s['castLib']}({libn}) member={s['member']:>4} "
                  f"loc=({s['locH']:>4},{s['locV']:>4}) {s['w']:>3}x{s['h']:<3} "
                  f"-> {name} [{f}]{ok}{flag}")
