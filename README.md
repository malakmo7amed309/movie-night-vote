# Movie Night Vote

Pick a movie together without the group-chat argument. One person starts a room, friends join with a 4-letter code, everybody suggests movies and votes from their own phone, and the tally updates live. When you are ready, roll the credits and every screen reveals the same winner.

**Live demo:** https://malakmo7amed309.github.io/movie-night-vote/

## Standout feature

A serverless, conflict-free live room. There is no host and no database: every device keeps the full room state and syncs it over Supabase Realtime broadcast. State merging is commutative (movies, per-person ballots and the final roll each merge by timestamp), so devices converge to the same result no matter the order messages arrive, and someone who joins late is caught up automatically. "Roll the credits" runs a ticket-slot animation and picks the winner deterministically (score, then Yes! count, then a tie-break seeded by the roll), so everyone sees the identical pick.

## Features

- Create a room or join with a 4-letter code or an invite link (`?room=ABCD`)
- Suggest any movie or tap a quick pick; creators can remove their own suggestions
- Vote per movie: Nope (-1), Meh (0), Sure (+1), Yes! (+2)
- Live box office leaderboard with fire and nope counts
- Presence: see who is in the room right now
- Your votes and the room survive a page refresh (localStorage)

## Stack

- React 19
- Tailwind CSS 4
- Supabase Realtime (broadcast + presence, no tables)
- Vite, built to a single self-contained HTML file

## Run it locally

```bash
npm install
npm run dev
```

```bash
npm run build
```

The build emits one self-contained `dist/index.html`, which GitHub Pages serves from the `docs/` folder.

## Screenshot

![Movie Night Vote](docs/screenshot.png)
