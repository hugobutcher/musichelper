"""
Print a compact loudness map of each song's parts, to help place section boundaries.

Each row covers `step` seconds: a level 0-9 for piano / horns / bass / drums (relative to that
part's loud passages), plus a tempo estimate from the full mix.

Usage: tools/.venv/Scripts/python.exe tools/analyze.py "<import folder>" [song-id ...] [--step 4]
"""

import json
import os
import sys

import numpy as np
import soundfile as sf

SRC_FILES = {
    'freddie-freeloader': 'Miles Davis - Freddie Freeloader.mp3',
    'joy-spring': 'Clifford Brown & Max Roach - Joy Spring.mp3',
    'i-want-more': 'I Want More.mp3',
    'so-what': 'Miles Davis - So What.mp3',
    'afternoon-in-paris': 'Afternoon In Paris.mp3',
}


def levels(x: np.ndarray, step: int) -> list[int]:
    n = len(x) // step
    blocks = np.array(x[: n * step]).reshape(n, step).mean(axis=1)
    ref = np.percentile(blocks, 95) or 1.0
    return [int(min(9, round(9 * v / ref))) for v in blocks]


def tempo_curve(path: str, window: float = 20.0, hop_s: float = 10.0) -> list[tuple[float, float]]:
    """Rough tempo per window from an onset-strength autocorrelation."""
    audio, sr = sf.read(path, dtype='float32', always_2d=True)
    mono = audio.mean(axis=1)
    hop = 512
    frames = len(mono) // hop
    env = np.sqrt((mono[: frames * hop].reshape(frames, hop) ** 2).mean(axis=1))
    onset = np.maximum(0, np.diff(np.log(env + 1e-6), prepend=0))
    fps = sr / hop
    out = []
    w = int(window * fps)
    for start in range(0, frames - w, int(hop_s * fps)):
        seg = onset[start : start + w] - onset[start : start + w].mean()
        ac = np.correlate(seg, seg, mode='full')[w - 1 :]
        lo, hi = int(fps * 60 / 300), int(fps * 60 / 60)
        lag = lo + int(np.argmax(ac[lo:hi]))
        out.append((start / fps, 60 * fps / lag))
    return out


def main() -> None:
    args = [a for a in sys.argv[1:]]
    step = 4
    if '--step' in args:
        i = args.index('--step')
        step = int(args[i + 1])
        del args[i : i + 2]
    folder, ids = args[0], args[1:]
    src_dir = os.path.dirname(os.path.abspath(folder))
    for fname in sorted(os.listdir(os.path.join(folder, 'analysis'))):
        sid = fname[:-5]
        if ids and sid not in ids:
            continue
        with open(os.path.join(folder, 'analysis', fname)) as f:
            a = json.load(f)
        rms = a['rms']
        piano = np.array(rms['piano']) + np.array(rms['guitar'])
        horns = np.array(rms['other']) + np.array(rms['vocals'])
        cols = {'pno': levels(piano, step), 'hrn': levels(horns, step), 'bas': levels(rms['bass'], step), 'drm': levels(rms['drums'], step)}
        tempos = tempo_curve(os.path.join(src_dir, SRC_FILES[sid])) if sid in SRC_FILES else []
        print(f'===== {sid}  ({a["duration"]:.0f}s)  rows of {step}s: piano horns bass drums | tempo')
        for r in range(len(cols['pno'])):
            t = r * step
            tempo = next((f'{bpm:.0f}' for (ts, bpm) in tempos if ts <= t < ts + 10), '')
            bar = lambda v: '#' * v + '.' * (9 - v)
            print(f'{t // 60:.0f}:{t % 60:02.0f}  P {bar(cols["pno"][r])}  H {bar(cols["hrn"][r])}  B {cols["bas"][r]}  D {cols["drm"][r]}  {tempo}')


if __name__ == '__main__':
    main()
