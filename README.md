# FlashForge

A flashcard and study tool with AI-powered set generation, multiple study modes, real-time multiplayer, and optional cross-device sync via Firebase.

---

## Features

- **Create sets** manually with a live card editor, or generate them from any topic using OpenAI — supports plain text and PDF uploads - Upload a file and the AI will parse through it in seconds, making slides for you based on the material
- **Import from Quizlet** — paste tab-separated exports or upload a CSV; auto-detects the delimiter
- **Share sets** via a self-contained link anyone can view and import without an account
- **Study modes:** Flashcards (with text-to-speech), Test (multiple choice), Write (type the answer), and Spaced Review (SM-2 algorithm)
- **Games:** Match (tile-matching against the clock) and Speed Round (timed multiple choice)
- **Multiplayer:** create a room with a 4-character code, invite a friend, and race to answer cards in real time
- **Daily streak** with milestone badges (3, 7, 14, 30, 100 days)
- **Score history** recorded per set and study mode
- **Google Sign-In + Firestore sync** — optional; all data works offline via localStorage first
- Responsive, accessible, no build tools or frameworks

## Tech

- Vanilla HTML / CSS / JavaScript
- Firebase Auth + Firestore (sync and multiplayer)
- OpenAI API (gpt-4o-mini) for AI generation
- Hosted on GitHub Pages
