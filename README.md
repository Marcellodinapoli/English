# Alinea — English Learning Platform

Professional adaptive English learning system (ZERO → C1).

## Multi-platform (Store-first)

Alinea is designed to be **downloaded from the stores**, not only opened in a browser.

| Surface | Status |
|---|---|
| **Google Play (Android)** | Capacitor project in `/android` — ready to open in Android Studio |
| **App Store (iOS)** | Capacitor project in `/ios` — build/archive on macOS |
| **Web / tablet / desktop** | Same product via browser + PWA |

App ID: `com.alinea.english` · See **[STORE.md](./STORE.md)** for release steps.

**Rule:** domain logic stays in `src/services/` and `content/` — native shells do not fork the learning engine.

```bash
npm run mobile:sync
npm run mobile:android   # Android Studio → Play Store AAB
npm run mobile:ios       # Xcode (Mac) → App Store
```

## Quick start

```bash
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

1. Register an account
2. Complete onboarding + assessment
3. Start today's lesson / reading

## Environment

Copy `.env.local.example` to `.env` (already created for local SQLite).

Optional:

- `OPENAI_API_KEY` — enables live AI contextual meanings
- Supabase keys — reserved for later migration; Phase 1 uses local auth

## Phase 1 completed

- Auth, onboarding, assessment
- Home daily plan
- Learn curriculum + LessonEngine
- Reading + interactive word popup
- Vocabulary + progress

## Phase 2 completed

- Listening exercises (choose / complete / order / dictation / comprehension)
- Grammar module (example → pattern → explanation → exercise → real use)
- Exercise Engine
- Error Engine (mistakes influence path + review)
- Spaced Repetition (SM-2 style) + Review UI
- Adaptive Daily Plan (weak skills + due reviews)

## Phase 3 completed

- Speaking sessions (repeat + free response)
- MediaRecorder + AudioService recording/playback
- Pronunciation / accuracy / fluency / vocab / grammar scoring
- Writing evaluation with corrections
- Whisper STT when `OPENAI_API_KEY` is set; heuristic + browser STT fallback otherwise
- Adaptive plan now prioritises Speak when speaking/pronunciation are weak

## Phase 4 completed

- AI Tutor (`/tutor`) with profile-aware guided chat
- Real Life role play (`/real-life`) — travel, work, daily, social
- Post-session evaluation (grammar, vocabulary, fluency, recommendations)
- Conversation sessions persisted in DB

## Phase 5 completed

- **Achievements** — 10 badges with XP rewards, unlock on activity (`/achievements`)
- **Milestones** — level, streak, XP, study-time progress
- **Advanced analytics** — weekly activity chart, event breakdown (Premium)
- **Subscriptions** — Free vs Premium plans, daily tutor/roleplay limits (`/subscription`)
- **Admin CMS** — edit JSON content buckets (`/admin`, requires `ADMIN_EMAILS`)
- Progress dashboard extended with gamification + analytics

## Curriculum ZERO → C1

Full CEFR path with automatic level progression:

| Level | Units | Lessons (approx.) |
|---|---|---|
| ZERO | 3 | 7 |
| A1 | 4 | 9 |
| A2 | 3 | 6 |
| B1 | 3 | 6 |
| B2 | 3 | 6 |
| C1 | 3 | 6 |

Plus graded **passages**, **listening**, **grammar**, **speaking**, **writing**, and **role play** for each band.

- **Auto promotion**: complete all lessons at your level + 65+ average mastery (vocabulary, grammar, reading, listening), skill floor, and other engine blockers → next level (+100 XP)
- **Sub-level** updates as you finish lessons within the current level
- **Locked levels** on `/learn` until you advance
- Catalog UIs (Read / Listen / Grammar / Speak / Real life) group content by CEFR band

## Store billing (production)

The subscription upgrade endpoint is a **local dev stub**. For production, wire App Store / Google Play webhooks to `Subscription` records.
