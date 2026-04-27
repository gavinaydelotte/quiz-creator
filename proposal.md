# FlashForge — Project Proposal

## 1. What am I building? Who is it for?

FlashForge is a flashcard and study tool aimed at students and self-learners who want more than basic flip cards. The target user is anyone studying for a test, learning a new skill, or just trying to memorize information — and who finds traditional flashcard apps (like Quizlet) either too limited or too expensive.

## 2. Why?

I've used Quizlet for years, but it locks useful features behind a paywall and doesn't support non-academic topics well. I want to build a fully-featured, free alternative that covers every way I actually study: flipping cards, taking quizzes, typing answers, and playing games to make repetition less boring. Adding AI generation means I can create a full set in seconds instead of spending 20 minutes typing cards manually.

## 3. MVP vs. Stretch Goals

**MVP (minimum working version):**
- Create, edit, and delete flashcard sets
- Flashcard study mode (flip to reveal)
- Basic test mode (multiple choice)
- Sets saved in `localStorage` so nothing is lost on refresh
- Responsive layout that works on mobile

**Stretch goals (if time allows):**
- AI-powered set generation (Gemini API)
- Additional game modes (Match, Hangman, Speed Round, Survival, etc.)
- Google Sign-In + Firestore sync so sets persist across devices
- Write mode (type the answer with fuzzy matching)
- Category filtering in the library

## 4. Technologies

- **HTML / CSS / Vanilla JavaScript** — no framework, keeping it fast and easy to deploy as a static site
- **localStorage** — primary data store; no backend required for the MVP
- **Firebase Authentication** — Google Sign-In for optional user accounts
- **Cloud Firestore** — real-time database for cross-device set sync (stretch goal)
- **Google Gemini API** — AI flashcard generation from a plain-text topic description (stretch goal)
- **Firebase Hosting** — free static hosting with a custom subdomain
