# Music Helper

A personal piano practice app for iPhone, installed from Safari as a home-screen web app.

- **Practice**: chord drills in standard notation (triads, sevenths, extended chords, ii–V–I) over generated backing tracks.
- **Songs**: play along with jazz recordings section by section, with the piano or horns turned off.

Song audio is never stored in this repo. It stays on your own devices.

## Getting song audio onto your phone

1. Put the MP3s in `C:\Users\hugob\Documents\song recordings`.
2. Split them into parts (piano / horns / bass / drums) and package them:
   ```
   tools/.venv/Scripts/python.exe tools/separate.py "C:/Users/hugob/Documents/song recordings" "C:/Users/hugob/Documents/song recordings/Music Helper import"
   ```
   This makes one `<song>.musichelper.zip` per song (it skips songs already done).
3. Copy the zips to iCloud Drive, OneDrive or Google Drive (or email them to yourself).
4. In the app: **Songs → Choose song files**, and select them. The audio is stored only on the phone.

`tools/analyze.py` prints when each part is loud or quiet over time, which is how the section start times were placed.
The Python environment lives in `tools/.venv` (Demucs + PyTorch CPU); it is not committed.
