"""
Split song recordings into parts with Demucs and package them for the Music Helper app.

For each MP3 it writes <out>/<song-id>.musichelper.zip containing:
  full.mp3       the original recording, untouched
  no-piano.mp3   drums + bass + horns (piano removed)
  no-horns.mp3   drums + bass + piano (horns/melody removed)
  rhythm.mp3     drums + bass only
  meta.json      song id, duration, stem loudness levels
and <out>/analysis/<song-id>.json with per-second loudness of each stem (for finding sections).

Usage (from the project folder):
  tools/.venv/Scripts/python.exe tools/separate.py "C:/Users/hugob/Documents/song recordings" "C:/Users/hugob/Documents/song recordings/Music Helper import"
"""

import json
import os
import shutil
import sys
import time
import zipfile

import lameenc
import numpy as np
import soundfile as sf
import torch
from demucs.apply import apply_model
from demucs.pretrained import get_model

# Filename keyword -> app song id
SONG_IDS = {
    'freddie': 'freddie-freeloader',
    'joy spring': 'joy-spring',
    'i want more': 'i-want-more',
    'so what': 'so-what',
    'afternoon': 'afternoon-in-paris',
}

# How the 6 Demucs stems are grouped. These records have no guitar or vocals: Demucs puts horn
# sounds in "other"/"vocals", and any "guitar" output is bleed from piano comping.
GROUPS = {
    'drums': ['drums'],
    'bass': ['bass'],
    'piano': ['piano', 'guitar'],
    'horns': ['other', 'vocals'],
}
MIXES = {
    'no-piano.mp3': ['drums', 'bass', 'horns'],
    'no-horns.mp3': ['drums', 'bass', 'piano'],
    'rhythm.mp3': ['drums', 'bass'],
}


def song_id_for(filename: str) -> str | None:
    low = filename.lower()
    for key, sid in SONG_IDS.items():
        if key in low:
            return sid
    return None


def load_audio(path: str, target_sr: int) -> np.ndarray:
    data, sr = sf.read(path, dtype='float32', always_2d=True)  # (samples, channels)
    if data.shape[1] == 1:
        data = np.repeat(data, 2, axis=1)
    data = data[:, :2].T  # (2, samples)
    if sr != target_sr:
        import torchaudio.functional as F

        data = F.resample(torch.from_numpy(data), sr, target_sr).numpy()
    return data


def encode_mp3(audio: np.ndarray, sr: int, kbps: int = 160) -> bytes:
    peak = float(np.max(np.abs(audio))) or 1.0
    scale = min(1.0, 0.99 / peak)  # avoid clipping after summing stems
    pcm = np.clip(audio.T * scale, -1, 1)
    pcm16 = (pcm * 32767).astype('<i2')
    enc = lameenc.Encoder()
    enc.set_bit_rate(kbps)
    enc.set_in_sample_rate(sr)
    enc.set_channels(2)
    enc.set_quality(2)
    return enc.encode(pcm16.tobytes()) + enc.flush()


def rms_per_second(audio: np.ndarray, sr: int) -> list[float]:
    mono = audio.mean(axis=0)
    n = len(mono) // sr
    blocks = mono[: n * sr].reshape(n, sr)
    return [round(float(x), 5) for x in np.sqrt((blocks**2).mean(axis=1))]


def main() -> None:
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(os.path.join(out, 'analysis'), exist_ok=True)
    torch.set_num_threads(max(1, os.cpu_count() or 1))
    model = get_model('htdemucs_6s')
    model.eval()
    sr = model.samplerate
    print('model sources:', model.sources, 'sample rate:', sr, flush=True)

    files = sorted(f for f in os.listdir(src) if f.lower().endswith('.mp3'))
    only = set(sys.argv[3:])  # optional: limit to some song ids
    for name in files:
        sid = song_id_for(name)
        if not sid or (only and sid not in only):
            continue
        zip_path = os.path.join(out, f'{sid}.musichelper.zip')
        if os.path.exists(zip_path):
            print(f'{sid}: already done, skipping', flush=True)
            continue
        t0 = time.time()
        print(f'{sid}: loading {name}', flush=True)
        wav = load_audio(os.path.join(src, name), sr)
        duration = wav.shape[1] / sr

        tensor = torch.from_numpy(wav)
        ref = tensor.mean(0)
        mean, std = ref.mean(), ref.std()
        with torch.no_grad():
            sources = apply_model(model, ((tensor - mean) / std)[None], device='cpu', split=True, overlap=0.25, progress=True)[0]
        sources = (sources * std + mean).numpy()  # (n_sources, 2, samples)
        stems = {s: sources[i] for i, s in enumerate(model.sources)}
        groups = {g: sum(stems[s] for s in members) for g, members in GROUPS.items()}

        analysis = {
            'songId': sid,
            'duration': duration,
            'rms': {name: rms_per_second(a, sr) for name, a in {**stems, 'full': wav}.items()},
        }
        with open(os.path.join(out, 'analysis', f'{sid}.json'), 'w') as f:
            json.dump(analysis, f)

        tmp = zip_path + '.tmp'
        with zipfile.ZipFile(tmp, 'w', compression=zipfile.ZIP_STORED) as z:
            z.write(os.path.join(src, name), 'full.mp3')
            for fname, members in MIXES.items():
                mix = sum(groups[g] for g in members)
                z.writestr(fname, encode_mp3(mix, sr))
                print(f'  {sid}: wrote {fname}', flush=True)
            meta = {'format': 'musichelper-song', 'version': 1, 'songId': sid, 'duration': duration, 'files': ['full.mp3', *MIXES.keys()]}
            z.writestr('meta.json', json.dumps(meta))
        shutil.move(tmp, zip_path)
        print(f'{sid}: done in {time.time() - t0:.0f}s ({duration:.0f}s of audio) -> {zip_path}', flush=True)


if __name__ == '__main__':
    main()
