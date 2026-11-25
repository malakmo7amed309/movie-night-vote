import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://uijyoxkppndiyboguhzm.supabase.co',
  'sb_publishable_ntTZHgBcoK8a5_EQwVepIQ_60e9yDPg',
)

const VOTES = [
  { v: -1, emoji: '👎', label: 'Nope' },
  { v: 0, emoji: '😐', label: 'Meh' },
  { v: 1, emoji: '👍', label: 'Sure' },
  { v: 2, emoji: '🔥', label: 'Yes!' },
]

const QUICK_PICKS = [
  ['🕷️', 'Spider-Man: Into the Spider-Verse'],
  ['🚀', 'Interstellar'],
  ['🧸', 'Toy Story'],
  ['🦁', 'The Lion King'],
  ['🌀', 'Inception'],
  ['🦇', 'The Dark Knight'],
  ['🐉', 'How to Train Your Dragon'],
  ['🍝', 'Ratatouille'],
  ['🧙', 'Harry Potter and the Prisoner of Azkaban'],
  ['🤖', 'WALL-E'],
]

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const makeCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
const uid = () => Math.random().toString(36).slice(2, 10)

// ---------- state (conflict-free: merging is commutative, so every device converges) ----------

const emptyState = () => ({ movies: {}, ballots: {}, roll: null })

function mergeState(a, b) {
  const out = { movies: { ...a.movies }, ballots: { ...a.ballots }, roll: a.roll }
  for (const [id, m] of Object.entries(b.movies || {})) {
    const cur = out.movies[id]
    if (!cur || (m.delAt || 0) > (cur.delAt || 0)) out.movies[id] = { ...(cur || m), ...m }
  }
  for (const [id, bal] of Object.entries(b.ballots || {})) {
    const cur = out.ballots[id]
    if (!cur || bal.at > cur.at) out.ballots[id] = bal
  }
  if (b.roll && (!out.roll || b.roll.at > out.roll.at)) out.roll = b.roll
  return out
}

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function tally(state) {
  const movies = Object.values(state.movies).filter((m) => !m.delAt)
  const rows = movies.map((m) => {
    let score = 0, fires = 0, nopes = 0, voters = 0
    for (const bal of Object.values(state.ballots)) {
      const v = bal.v?.[m.id]
      if (v === undefined) continue
      voters++
      score += v
      if (v === 2) fires++
      if (v === -1) nopes++
    }
    return { ...m, score, fires, nopes, voters }
  })
  return rows.sort((a, b) => b.score - a.score || b.fires - a.fires || a.nopes - b.nopes || a.at - b.at)
}

// Same winner on every screen: top score, then fires, then a tie-break seeded by the roll
function pickWinner(rows, seed) {
  if (!rows.length) return null
  const top = rows.filter((r) => r.score === rows[0].score && r.fires === rows[0].fires)
  return top.sort((a, b) => hash(seed + a.id) - hash(seed + b.id))[0]
}

// ---------- UI pieces ----------

function Marquee({ children }) {
  return (
    <div className="relative rounded-3xl border border-gold/30 bg-velvet-2 px-6 py-5 shadow-[0_0_60px_-20px_rgba(245,192,74,0.5)]">
      <div className="absolute inset-x-6 -top-1.5 flex justify-between">
        {Array.from({ length: 16 }).map((_, i) => (
          <span key={i} className="bulb h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_8px_2px_rgba(245,192,74,0.8)]" />
        ))}
      </div>
      {children}
    </div>
  )
}

function Landing({ onEnter, initialCode }) {
  const [code, setCode] = useState(initialCode || '')
  const [name, setName] = useState(() => localStorage.getItem('movie-night-vote:name') || '')
  const go = (c) => {
    if (!name.trim()) return
    localStorage.setItem('movie-night-vote:name', name.trim())
    onEnter(c, name.trim())
  }
  return (
    <div className="anim-rise mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-5 py-10 text-center">
      <div>
        <div className="font-display text-7xl leading-none tracking-wide gold-shine sm:text-8xl">MOVIE NIGHT</div>
        <div className="font-display text-4xl tracking-[0.3em] text-curtain">VOTE</div>
        <p className="mt-3 text-sm text-[#fbeedd]/60">Everyone adds movies, everyone votes from their own phone, then you roll the credits.</p>
      </div>
      <Marquee>
        <div className="flex flex-col gap-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={14}
            placeholder="Your name"
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center text-lg outline-none focus:border-gold"
          />
          <button
            onClick={() => go(makeCode())}
            disabled={!name.trim()}
            className="rounded-2xl bg-curtain py-3.5 font-display text-2xl tracking-wider text-white transition enabled:hover:brightness-110 disabled:opacity-40"
          >
            START A MOVIE NIGHT
          </button>
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-white/30">
            <span className="h-px flex-1 bg-white/10" /> or join <span className="h-px flex-1 bg-white/10" />
          </div>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
              placeholder="CODE"
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center font-display text-3xl tracking-[0.4em] outline-none focus:border-gold"
            />
            <button
              onClick={() => go(code)}
              disabled={code.length !== 4 || !name.trim()}
              className="rounded-2xl bg-gold px-6 font-display text-2xl tracking-wider text-velvet transition enabled:hover:brightness-110 disabled:opacity-40"
            >
              JOIN
            </button>
          </div>
        </div>
      </Marquee>
    </div>
  )
}

function VoteRow({ movie, myVote, onVote, onDelete, canDelete }) {
  return (
    <div className="anim-rise ticket flex flex-col gap-3 bg-[#f6e7c8] px-6 py-4 text-velvet sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="text-3xl">{movie.emoji}</span>
        <div className="min-w-0">
          <div className="truncate font-display text-2xl leading-tight tracking-wide">{movie.title}</div>
          <div className="text-xs text-velvet/55">added by {movie.by}</div>
        </div>
        {canDelete && (
          <button onClick={onDelete} title="Remove" className="ml-auto rounded-full px-2 text-velvet/30 transition hover:text-curtain sm:ml-2">
            ✕
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        {VOTES.map((o) => (
          <button
            key={o.v}
            onClick={() => onVote(o.v)}
            className={`flex w-14 flex-col items-center rounded-xl py-1.5 text-xl transition ${
              myVote === o.v ? 'bg-velvet text-white shadow-md scale-105' : 'bg-velvet/10 hover:bg-velvet/20'
            }`}
          >
            <span>{o.emoji}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Leaderboard({ rows, totalVoters }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.score)))
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r, i) => (
        <div key={r.id} className="flex items-center gap-3">
          <div className="w-6 text-right font-display text-xl text-gold/70">{i + 1}</div>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-2 text-sm">
              <span className="truncate font-medium">{r.emoji} {r.title}</span>
              <span className="shrink-0 text-xs text-white/50">
                {r.fires > 0 && `🔥${r.fires} `}{r.nopes > 0 && `👎${r.nopes} `}· {r.voters}/{totalVoters}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-curtain to-gold transition-all duration-500"
                style={{ width: `${Math.max(4, (Math.max(r.score, 0) / max) * 100)}%` }}
              />
            </div>
          </div>
          <div className="w-8 text-right font-display text-2xl text-gold">{r.score}</div>
        </div>
      ))}
    </div>
  )
}

function Reveal({ rows, roll, onClose }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 90)
    return () => clearInterval(t)
  }, [])
  const SPIN = 4200
  const elapsed = now - roll.at
  const winner = pickWinner(rows, String(roll.at))
  if (!winner) return null
  const spinning = elapsed < SPIN
  const shown = spinning ? rows[Math.floor(elapsed / 90) % rows.length] : winner
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/85 px-5 backdrop-blur-sm">
      <div className="font-display text-xl tracking-[0.5em] text-gold">{spinning ? 'AND TONIGHT\'S FEATURE IS' : 'NOW SHOWING'}</div>
      <div
        key={spinning ? 'spin' : 'win'}
        className={`ticket w-full max-w-lg bg-[#f6e7c8] px-8 py-10 text-center text-velvet ${spinning ? '' : 'anim-pop'}`}
      >
        <div className="text-6xl">{shown.emoji}</div>
        <div className="mt-2 font-display text-5xl leading-tight tracking-wide sm:text-6xl">{shown.title}</div>
        {!spinning && (
          <div className="mt-3 text-sm font-medium text-velvet/60">
            {winner.score} points · {winner.fires} 🔥 · pitched by {winner.by}
          </div>
        )}
      </div>
      {!spinning && (
        <button onClick={onClose} className="anim-rise rounded-2xl bg-gold px-8 py-3 font-display text-2xl tracking-wider text-velvet hover:brightness-110">
          POPCORN TIME 🍿
        </button>
      )}
    </div>
  )
}

// ---------- room ----------

function Room({ code, name, me, onLeave }) {
  const storeKey = `movie-night-vote:${code}`
  const [state, setState] = useState(() => {
    try {
      return { ...emptyState(), ...JSON.parse(localStorage.getItem(storeKey) || '{}') }
    } catch {
      return emptyState()
    }
  })
  const [online, setOnline] = useState([])
  const [ready, setReady] = useState(false)
  const [title, setTitle] = useState('')
  const [dismissedRoll, setDismissedRoll] = useState(null)
  const [copied, setCopied] = useState(false)
  const chanRef = useRef(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const broadcast = useCallback(() => {
    chanRef.current?.send({ type: 'broadcast', event: 'sync', payload: { from: me, state: stateRef.current } })
  }, [me])

  useEffect(() => {
    localStorage.setItem(storeKey, JSON.stringify(state))
  }, [state, storeKey])

  useEffect(() => {
    const ch = supabase.channel(`movie-night-vote:room-${code}`, { config: { broadcast: { self: false }, presence: { key: me } } })
    chanRef.current = ch
    ch.on('broadcast', { event: 'sync' }, ({ payload }) => {
      if (payload.from === me) return
      setState((s) => mergeState(s, payload.state))
    })
    ch.on('broadcast', { event: 'hello' }, () => {
      // someone new arrived: share what we know (jittered so the room does not all reply at once)
      setTimeout(broadcast, Math.random() * 400)
    })
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState()
      setOnline(Object.entries(st).map(([id, arr]) => ({ id, name: arr[0]?.name || '?' })))
    })
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.track({ name })
        ch.send({ type: 'broadcast', event: 'hello', payload: { from: me } })
        setReady(true)
        setTimeout(broadcast, 800)
      }
    })
    return () => {
      supabase.removeChannel(ch)
    }
  }, [code, me, name, broadcast])

  const update = (fn) => {
    setState((s) => fn(s))
    setTimeout(broadcast, 30)
  }

  const addMovie = (t, emoji = '🎬') => {
    const clean = t.trim().slice(0, 48)
    if (!clean) return
    const exists = Object.values(stateRef.current.movies).some((m) => !m.delAt && m.title.toLowerCase() === clean.toLowerCase())
    if (exists) return
    const id = uid()
    update((s) => ({ ...s, movies: { ...s.movies, [id]: { id, title: clean, emoji, by: name, byId: me, at: Date.now() } } }))
    setTitle('')
  }

  const removeMovie = (id) =>
    update((s) => ({ ...s, movies: { ...s.movies, [id]: { ...s.movies[id], delAt: Date.now() } } }))

  const vote = (movieId, v) =>
    update((s) => {
      const mine = s.ballots[me] || { name, v: {}, at: 0 }
      return { ...s, ballots: { ...s.ballots, [me]: { name, v: { ...mine.v, [movieId]: v }, at: Date.now() } } }
    })

  const rollCredits = () => update((s) => ({ ...s, roll: { at: Date.now(), by: name } }))

  const rows = useMemo(() => tally(state), [state])
  const voters = Object.keys(state.ballots).length
  const myBallot = state.ballots[me]?.v || {}
  const fullyVoted = rows.length > 0 && rows.every((r) => myBallot[r.id] !== undefined)
  const roll = state.roll
  const showReveal = roll && roll.at !== dismissedRoll && Date.now() - roll.at < 5 * 60 * 1000 && rows.length > 0
  const suggestions = QUICK_PICKS.filter(([, t]) => !rows.some((r) => r.title.toLowerCase() === t.toLowerCase())).slice(0, 5)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}?room=${code}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button onClick={onLeave} className="font-display text-3xl tracking-wide gold-shine">MOVIE NIGHT VOTE</button>
        <div className="flex items-center gap-2">
          <button onClick={copyLink} className="rounded-xl border border-gold/40 px-3 py-1.5 text-sm text-gold transition hover:bg-gold/10">
            {copied ? 'Link copied ✓' : 'Copy invite link'}
          </button>
          <div className="rounded-xl bg-curtain px-4 py-1.5 font-display text-2xl tracking-[0.3em]" title="Room code">{code}</div>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-white/60">
        <span className={`h-2 w-2 rounded-full ${ready ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        {ready ? `${online.length || 1} in the room:` : 'connecting...'}
        {online.map((p) => (
          <span key={p.id} className={`rounded-full px-2.5 py-0.5 text-xs ${p.id === me ? 'bg-gold text-velvet font-bold' : 'bg-white/10'}`}>
            {p.id === me ? 'you' : p.name}
          </span>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          addMovie(title)
        }}
        className="mb-3 flex gap-2"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Suggest a movie..."
          maxLength={48}
          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-velvet-2 px-4 py-3 outline-none focus:border-gold"
        />
        <button className="rounded-2xl bg-gold px-5 font-display text-2xl tracking-wider text-velvet hover:brightness-110">ADD</button>
      </form>
      {suggestions.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {suggestions.map(([emoji, t]) => (
            <button key={t} onClick={() => addMovie(t, emoji)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 transition hover:border-gold hover:text-gold">
              + {emoji} {t.length > 26 ? t.slice(0, 24) + '…' : t}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <Marquee>
          <div className="py-8 text-center text-white/60">
            <div className="text-5xl">🍿</div>
            <div className="mt-2 font-display text-3xl tracking-wide text-gold">NOW BOARDING</div>
            <p className="mt-1 text-sm">Add the first movie, then share code <b className="text-white">{code}</b> with your friends.</p>
          </div>
        </Marquee>
      ) : (
        <div className="grid gap-8 lg:grid-cols-1">
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-3xl tracking-wide text-gold">CAST YOUR VOTE</h2>
              <span className="text-xs text-white/40">{voters} voter{voters === 1 ? '' : 's'} so far</span>
            </div>
            {[...rows].sort((a, b) => a.at - b.at).map((m) => (
              <VoteRow
                key={m.id}
                movie={m}
                myVote={myBallot[m.id]}
                onVote={(v) => vote(m.id, v)}
                onDelete={() => removeMovie(m.id)}
                canDelete={m.byId === me}
              />
            ))}
          </section>

          <section className="rounded-3xl border border-white/10 bg-velvet-2 p-5">
            <h2 className="mb-4 font-display text-3xl tracking-wide text-gold">LIVE BOX OFFICE</h2>
            <Leaderboard rows={rows} totalVoters={Math.max(voters, 1)} />
          </section>

          <button
            onClick={rollCredits}
            className="rounded-3xl bg-gradient-to-r from-curtain to-[#d4452f] py-5 font-display text-4xl tracking-widest text-white shadow-lg transition hover:brightness-110 active:translate-y-0.5"
          >
            🎬 ROLL THE CREDITS
          </button>
          {!fullyVoted && <p className="-mt-5 text-center text-xs text-white/40">You have not voted on every movie yet. Anyone in the room can roll the credits.</p>}
        </div>
      )}

      {showReveal && <Reveal rows={rows} roll={roll} onClose={() => setDismissedRoll(roll.at)} />}
    </div>
  )
}

// ---------- app ----------

export default function App() {
  const [session, setSession] = useState(null)
  const me = useMemo(() => {
    let id = localStorage.getItem('movie-night-vote:me')
    if (!id) {
      id = uid()
      localStorage.setItem('movie-night-vote:me', id)
    }
    return id
  }, [])

  const roomFromUrl = useMemo(() => {
    const r = new URLSearchParams(location.search).get('room')
    return r && /^[A-Za-z]{4}$/.test(r) ? r.toUpperCase() : null
  }, [])
  const savedName = localStorage.getItem('movie-night-vote:name')

  useEffect(() => {
    if (roomFromUrl && savedName) setSession({ code: roomFromUrl, name: savedName })
  }, [roomFromUrl, savedName])

  if (!session) {
    return <Landing initialCode={roomFromUrl} onEnter={(code, name) => setSession({ code, name })} />
  }
  return <Room key={session.code} code={session.code} name={session.name} me={me} onLeave={() => { history.replaceState(null, '', location.pathname); setSession(null) }} />
}
