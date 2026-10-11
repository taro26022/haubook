"""アプリのアイコン(PNG)を作るスクリプト。外部ライブラリは使わない。

使い方: python3 tools/make_icons.py
緑の正方形に白い「¥」を描く。iPhone はアイコンの角を自動で丸めるので、正方形のまま出力する。
"""
import math
import struct
import zlib
from pathlib import Path

BG = (31, 122, 92)  # #1f7a5c
FG = (255, 255, 255)
HALF_WIDTH = 0.045  # 線の太さの半分(アイコンの幅に対する比率)
# 「¥」の線分(座標はアイコンの幅を 1 とした比率)。すべて中央 80% の円の中に収まる。
SEGMENTS = [
    ((0.31, 0.23), (0.50, 0.50)),
    ((0.69, 0.23), (0.50, 0.50)),
    ((0.50, 0.50), (0.50, 0.79)),
    ((0.34, 0.56), (0.66, 0.56)),
    ((0.34, 0.68), (0.66, 0.68)),
]


def distance_to_segment(px, py, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def render(size):
    rows = []
    pixel = 1.0 / size
    for y in range(size):
        row = bytearray([0])  # PNG のフィルタ種別(なし)
        for x in range(size):
            px, py = (x + 0.5) / size, (y + 0.5) / size
            d = min(distance_to_segment(px, py, a, b) for a, b in SEGMENTS) - HALF_WIDTH
            coverage = max(0.0, min(1.0, 0.5 - d / pixel))  # 境界をなめらかにする
            row.extend(round(bg + (fg - bg) * coverage) for bg, fg in zip(BG, FG))
        rows.append(bytes(row))
    return b''.join(rows)


def write_png(path, size):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)  # 8bit RGB
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(render(size), 9)) + chunk(b'IEND', b'')
    Path(path).write_bytes(png)
    print(f'{path} ({size}x{size})')


if __name__ == '__main__':
    out = Path(__file__).resolve().parent.parent / 'icons'
    out.mkdir(exist_ok=True)
    write_png(out / 'apple-touch-icon.png', 180)
    write_png(out / 'icon-192.png', 192)
    write_png(out / 'icon-512.png', 512)
