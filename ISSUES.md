# DraftInk Project Issues

This file tracks the vertical tracer-bullet issues for building the DraftInk application.

---

## capstone-0001: Project Setup & Minimalist Editor Canvas

### What to build
Initialize the project structure in `capstone/` including dependency definition in `pyproject.toml`, a FastAPI server in `app/server.py`, and the main editor page in `app/static/index.html`. The application must open immediately to a clean, distraction-free writing canvas, with a footer displaying word count.

### Acceptance criteria
- [ ] FastAPI backend is configured and can serve static files.
- [ ] A clean text editor canvas is visible immediately on application launch (no onboarding wizard block).
- [ ] A footer shows the real-time word count of the text written in the editor.
- [ ] Merriweather or another highly readable serif font is used in the text area, with Plus Jakarta Sans used for UI controls.

### Blocked by
- None — can start immediately

---

## capstone-0002: Backend Document Folder & Auto-Save System

### What to build
Implement backend file storage endpoints and frontend auto-saving. As the user types in the editor, changes must be automatically saved as a Markdown file in the configured Document Folder.

### Acceptance criteria
- [ ] Backend has a `POST /api/draft` endpoint that receives document text and saves it as a Markdown file (e.g. `active_draft.md`) to a configured Document Folder.
- [ ] Frontend auto-saves the editor content dynamically, using debouncing (e.g. 1000ms delay after typing stops).
- [ ] The save status (e.g., "Saving...", "All changes saved locally") is shown clearly in the editor footer.
- [ ] Default save folder is automatically created inside the project directory (e.g., `capstone/drafts`) if no custom folder is set.

### Blocked by
- `capstone-0001`

---

## capstone-0003: Configuration Sidebar & AES-256 Key Encryption

### What to build
Create the sliding Configuration sidebar. Implement AES-256-GCM encryption on the backend to encrypt the Gemini API key before storing it in `capstone/config.json`. The encryption key is loaded from `capstone/.draft_ink.key` (generated automatically if missing).

### Acceptance criteria
- [ ] A Configuration sidebar slides in from the right when the top "Configuration" button is clicked.
- [ ] The sidebar contains inputs for: Document Folder path, Application Theme, AI Model, and Gemini API Key.
- [ ] Backend automatically generates a 256-bit encryption key and writes it with restricted permissions to `capstone/.draft_ink.key` if it doesn't exist.
- [ ] API keys submitted by the user are encrypted using AES-256-GCM on the backend and saved in `capstone/config.json`.
- [ ] API keys retrieved by the frontend are masked (e.g. `••••••••`) but successfully decrypted on the backend for API calls.
- [ ] Four themes are fully functional and switch instantly: Sleek Dark, Elegant Light, Warm Sepia, and Glassmorphism.
- [ ] Model selector lists models, highlighting `gemini-2.5-flash` as the recommended efficient text generation model.

### Blocked by
- `capstone-0002`

---

## capstone-0004: Readability Check Dashboard (Flesch-Kincaid)

### What to build
Build the Flesch-Kincaid readability scoring dashboard. The scores (Reading Ease and Grade Level) must be calculated instantly in client-side JavaScript.

### Acceptance criteria
- [ ] A Readability Check sidebar slides in from the right when the top "Readability-Check" button is clicked.
- [ ] Clicking "Run Readability Check" calculates Flesch Reading Ease and Flesch-Kincaid Grade Level using a custom JavaScript algorithm.
- [ ] Displays Reading Ease and Grade Level using beautiful, color-coded visual progress indicators or gauges (e.g. green for readable, red for complex).
- [ ] Displays document metrics: total words, total sentences, and average syllables per word.

### Blocked by
- `capstone-0001`

---

## capstone-0005: Readability AI Suggestions

### What to build
Add on-demand AI recommendations to the Readability Check panel to suggest specific improvements for the draft based on the calculated Flesch-Kincaid scores.

### Acceptance criteria
- [ ] Backend has a `POST /api/readability-suggestions` endpoint that queries Gemini using the user's decrypted API key and selected model.
- [ ] The AI analyzes the draft's text and readability scores and returns a JSON list of concrete, bulleted suggestions for simplifying sentences.
- [ ] Suggestions are rendered as cards in the Readability Check panel.
- [ ] Displays a loading spinner while the suggestion API call is active.

### Blocked by
- `capstone-0003`
- `capstone-0004`

---

## capstone-0006: Ghost-Text Reword with Visual Diff/Review UI

### What to build
Implement the Ghost-Text panel containing requirements inputs and buttons to generate drafts and run on-demand rewording. Include a visual Diff/Review comparison pane showing additions and deletions.

### Acceptance criteria
- [ ] A Ghost-Text sidebar slides in from the right when the top "Ghost-Text" button is clicked.
- [ ] Sidebar includes inputs for Topic/Goal, Key Outline Sections (bullet points), and Target Word Count.
- [ ] "Generate Draft" button generates a draft from scratch based on the outline and places it in the editor.
- [ ] "Reword Draft" button is enabled only when draft text exists, sending the requirements and current text to the backend.
- [ ] Backend uses Gemini to rewrite/reword the user's draft to match requirements and improve readability.
- [ ] Proposed rewording is displayed in a split-screen or side-by-side Diff/Review dialog, highlighting additions in green and deletions in red.
- [ ] User can click "Accept Changes" to replace the editor content, or "Discard Changes" to close the diff.

### Blocked by
- `capstone-0003`
