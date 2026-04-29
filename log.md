# Log

## April 21
- Initialized repo and wrote a proposal outlining the project concept: a flashcard/quiz web app called FlashForge

## April 23
- Built the base single-page app structure using vanilla HTML, CSS, and JS with a hash-based client-side router
- Created the home page, library page, and set detail page
- Implemented card creation/editing UI and localStorage-based data storage

## April 24
- Integrated the OpenAI API (gpt-4o-mini) to auto-generate flashcard sets from a topic or uploaded file
- Added PDF upload support — extracts text from PDFs using pdf.js and feeds it to the AI
- Users store their own API key in localStorage (never sent to a server)

## April 25
- Integrated Firebase: set up firebase-config.js and initialized Firestore
- Added Google sign-in (popup on desktop, redirect on mobile)
- Gitignored the API key / Firebase config to keep secrets out of the repo
- Renamed and reorganized JS modules for clarity

## April 27
- **Multiplayer:** built a real-time 2-player quiz mode using Firestore. Host creates a room with a 4-character code, guest joins, then players race to answer cards — first correct answer wins the round. Scores tracked live via Firestore listeners.
- **Text-to-speech:** added speak buttons in flashcard mode using the browser's Web Speech API to read terms and definitions aloud
- **Firestore sync:** sets now sync to Firestore when signed in — on first sign-in local sets are pushed up; on subsequent sign-ins cloud sets are pulled down
- **Spaced repetition (SM-2):** added a "Spaced Review" study mode that schedules cards using the SM-2 algorithm; cards that are missed come back sooner, mastered cards are shown less often
- **Test mode:** multiple-choice test with randomized distractors, scored at the end
- **Write mode:** type-in-the-answer mode that checks spelling and records right/wrong
- **Match game:** drag/click-to-match terms to definitions against a timer
- **Speed round:** timed rapid-fire question mode
- **Score history:** every completed study session is recorded (mode, score, date) and shown on the set detail page
- **Daily streak tracker:** records study days, tracks current and longest streak, awards milestone badges (e.g. "Week Warrior" at 7 days)
- **Share links:** sets can be exported as a URL-safe base64 link — anyone with the link can view and import the set
- **Import:** paste Quizlet exports or upload a CSV; auto-detects tab, comma, or semicolon delimiters
- **Sample sets:** four built-in sets (World Capitals, Marvel Universe, Cooking Essentials, Programming Basics) pre-loaded for new users
- Deployed the app and set up a custom domain via GitHub Pages CNAME

## April 28
- Added a branded app logo and favicon for the browser tab
- Polished mobile layout and fixed responsiveness issues
