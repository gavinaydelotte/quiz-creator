# FlashForge

A Quizlet-inspired flashcard and study tool that goes beyond the basics — featuring 8 games, 3 study modes, AI-powered set generation, and optional cross-device sync via Firebase.

**Live Demo:** `https://YOUR-PROJECT.web.app` ← replace with your Firebase Hosting URL

---

## Features

- **Create flashcard sets** manually with a live card editor, or let Gemini AI generate them from any topic description
- **4 study modes:**
  - **Flashcards** — flip cards at your own pace and track correct/missed
  - **Test** — multiple-choice quiz drawn from your set
  - **Write** — type the definition; fuzzy matching gives partial credit for close answers
  - **Spaced Review** — SM-2 algorithm schedules cards based on recall; Got It pushes a card out, Missed resets it to tomorrow
- **Score history charts** — every completed session is recorded; set detail pages show an inline SVG line chart of your last 30 sessions, color-coded by study mode (Flashcards, Test, Write, Review)
- **Shareable links** — click Share on any set to copy a self-contained link; anyone with the link can view the full set and add it to their own library with one click — no account required
- **Dark / light mode** — toggle between themes from the navbar; preference is saved and applied before first paint to prevent any flash
- **Image cards** — attach a photo to any flashcard by uploading a file (max 2 MB) or pasting an image URL; images appear on the card front in Flashcard mode and above the question in Test and Write modes
- **Daily streak** — studying any day increments a counter shown in the home screen hero; hitting milestones (3, 7, 14, 30, 100 days) earns a badge displayed on the session done screen
- **8 games:**
  - **Match** — drag-free tile-matching race against the clock
  - **Speed Round** — multiple-choice with a per-question countdown timer and bonus points
  - **Hangman** — guess the term letter-by-letter with a classic scaffold
  - **Word Scramble** — rearrange tiles to spell the answer
  - **True or False** — decide if a term–definition pair is correct
  - **Survival** — answer correctly to keep your lives; one wrong and you lose one
  - **Gravity** — type the answer before the falling card hits the bottom
  - **Lightning Run** — swipe Know/Don't Know as fast as you can within the time limit
- **AI set generation** — describe any topic and Gemini AI produces ready-to-study flashcard pairs (free Gemini API key required)
- **CSV / Quizlet import** — paste tab-separated Quizlet exports or upload a CSV file; auto-detects the delimiter and previews all cards before saving
- **Google Sign-In + Firestore sync** — sign in with Google to sync sets across devices in real time
- **Offline-first** — all sets are stored in `localStorage`; Firebase sync is additive and optional
- **Responsive design** — works on phone, tablet, and desktop
- **Accessible** — semantic HTML, ARIA labels, live regions, keyboard navigation throughout

---

## Technologies Used

| Layer | Technology |
|---|---|
| Structure | HTML5 (semantic tags, ARIA attributes) |
| Styling | CSS3 — custom properties, CSS Grid, Flexbox, `clamp()`, animations |
| Logic | Vanilla JavaScript (no build tools, no frameworks) |
| Persistence | `localStorage` (primary) |
| Auth & Sync | Firebase Authentication (Google Sign-In) + Cloud Firestore |
| AI | Google Gemini 2.0 Flash API (via `fetch`) |
| Hosting | Firebase Hosting |

---

## AI Tools Used

- **Claude (Anthropic)** — primary coding assistant used throughout development for implementation, debugging, and refactoring. Every piece of generated code was reviewed, understood, and often modified before use.
- **Google Gemini API** — integrated directly into the app as a feature: users can generate flashcard sets by describing any topic in plain English.

---

## Challenges & How I Solved Them

**1. Setting up Google Sign-In with Firebase**
Configuring Firebase Authentication took more work than expected — I had to set up a Firebase project, enable the Google Sign-In provider, add the authorized domain, download and run programs in PowerShell, and wire the SDK into the app without exposing credentials. I solved this by storing the Firebase config in a separate `firebase-config.js` file (gitignored) and building an `Auth` module that handles sign-in, sign-out, and user state changes. Once a user signs in, their sets automatically sync to Firestore so they're available on any device.

**2. Getting the Gemini API to return usable flashcard data**
Integrating the Gemini API was tricky because the model doesn't always return clean JSON — it sometimes wraps the output in markdown code fences or adds extra explanation text. I solved this by writing a parser that strips known fence patterns, uses a regex to extract the first valid JSON array from the response, and validates that each object has both a `term` and `definition` before accepting it. I also had to handle API key setup in-app, since the key is user-supplied and stored in `localStorage` rather than hardcoded.

**3. Supporting users who already have sets in other apps**
Many students already use Quizlet and didn't want to re-type all their cards. I solved this by building an import page that accepts Quizlet's tab-separated export format as well as standard CSV files. The parser auto-detects the delimiter, previews all parsed cards before saving, and creates a new set with one click — no manual re-entry required.

---

## Future Improvements

- **Multiplayer mode** — let two users race through a shared set in real time using Firebase, competing to answer cards fastest
- **Text-to-speech** — read card terms aloud using the Web Speech API so users can study without looking at the screen
- **Richer image support** — current implementation shows one image per card (on the term side); a future version could support images on the definition side and inline image editing without re-uploading
- **Leaderboard** — track high scores across games and display a global or friend-group leaderboard stored in Firestore
- **Cross-device streak sync** — current streak lives in localStorage; a future version could sync it to Firestore so it persists when switching devices
- **Per-set streak tracking** — reward daily study habits with a streak counter and milestone badges on each set detail page
