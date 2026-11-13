"""Draws the app icons (pure Python, no dependencies). Run: py tools/make_icons.py"""
import os, struct, zlib

BG = (0, 122, 255)
GOLD = (255, 255, 255)
WHITE = (255, 255, 255)
BLACK = (28, 28, 30)

def shade(u, v):
    """Colour at normalised coords (0..1, 0..1)."""
    # keyboard block
    kx0, kx1, ky0, ky1 = 0.16, 0.84, 0.30, 0.78
    if kx0 <= u <= kx1 and ky0 <= v <= ky1:
        w = (kx1 - kx0) / 5
        rel = (u - kx0) / w
        k = int(rel)
        # black keys between white keys 1-2, 2-3, 4-5 (C D E . F G)
        for b in (1, 2, 4):
            if abs(rel - b) < 0.30 and v < ky0 + (ky1 - ky0) * 0.6:
                return BLACK
        if abs(rel - round(rel)) < 0.025 and 0 < round(rel) < 5:
            return (190, 190, 196)
        return WHITE
    # gold bar above keyboard
    if kx0 <= u <= kx1 and 0.22 <= v < 0.27:
        return GOLD
    return BG

def png(size, path):
    ss = 3
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            r = g = b = 0
            for sy in range(ss):
                for sx in range(ss):
                    c = shade((x + (sx + .5) / ss) / size, (y + (sy + .5) / ss) / size)
                    r += c[0]; g += c[1]; b += c[2]
            n = ss * ss
            row += bytes((r // n, g // n, b // n))
        rows.append(bytes(row))
    raw = zlib.compress(b''.join(rows), 9)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', raw) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

out = os.path.join(os.path.dirname(__file__), '..', 'public')
for size, name in ((180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')):
    png(size, os.path.join(out, name))
    print('wrote', name)
