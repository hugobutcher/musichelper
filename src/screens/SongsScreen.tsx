const SONGS = [
  { title: 'Freddie Freeloader', artist: 'Miles Davis' },
  { title: 'Joy Spring', artist: 'Clifford Brown & Max Roach' },
  { title: 'I Want More', artist: 'Dexter Gordon' },
  { title: 'So What', artist: 'Miles Davis' },
  { title: 'An Afternoon in Paris', artist: 'Kenny Barron' },
]

export default function SongsScreen() {
  return (
    <section>
      <h1>Songs</h1>
      <ul className="song-list">
        {SONGS.map((s) => (
          <li key={s.title}>
            <div className="song-title">{s.title}</div>
            <div className="song-artist">{s.artist}</div>
          </li>
        ))}
      </ul>
    </section>
  )
}
