# Product Requirements Document (PRD) — DraftInk

This document outlines the product requirements and technical decisions for DraftInk, a distraction-free document drafting application featuring local file management, encrypted API keys, on-demand AI rewording with visual diff review, and readability analysis.

---

## Problem Statement

Users drafting documents for work lack a simple, focused writing interface that seamlessly combines auto-saving to local directories with robust AI assistance. Existing tools either require uploading documents to third-party cloud services, lack local directory control, expose plain-text API keys in their configuration storage, or provide intrusive AI suggestions that overwrite user drafts without a clear review/comparison interface.

## Solution

DraftInk is a local-first web application running on the user's machine. It features a minimalist "just start writing" main editor with a top navigation bar allowing users to toggle three side-panels on demand:
1. **Configuration**: Set the local save folder, select application themes (including Light, Dark, Sepia, and Glassmorphic), select the Gemini model (highlighting efficient models like `gemini-2.5-flash`), and input the Gemini API key (which is securely encrypted in local storage using AES-256).
2. **Ghost-Text**: Set document requirements (topic, outline, target words), and trigger on-demand draft rewording that generates a visual diff/review interface showing additions and deletions before replacing the editor content.
3. **Readability Check**: Compute Flesch-Kincaid readability scores (Reading Ease and Grade Level) instantly in the browser, accompanied by visual gauges and on-demand Gemini-generated suggestions for styling and readability improvement.

---

## User Stories

1. As a writer, I want to open the application and be presented immediately with a clean, distraction-free writing canvas, so that I can start drafting text without onboarding friction.
2. As a user, I want the editor to automatically save my text as a Markdown file in a local folder of my choice, so that I don't lose work and my drafts remain secure on my own machine.
3. As a security-conscious user, I want my Gemini API key to be encrypted in local storage using AES-256, so that other applications or users on my machine cannot access it in plain text.
4. As a writer, I want to choose a color theme (e.g., Warm Sepia for writing comfort, or Dark Mode for low-light use) that updates the interface instantly, so that my workspace fits my preferences.
5. As a writer, I want to configure which Gemini model is active, with the system recommending text-efficient models like `gemini-2.5-flash`, so that I get fast and cost-effective AI responses.
6. As a writer, I want to input the topic, key sections, and target word count in the Ghost-Text panel, so that the AI has the necessary context to assist with my document.
7. As a writer, I want to trigger a complete draft generation from my requirements on demand, so that I can quickly overcome writer's block when starting a new section.
8. As a writer, I want to run a "Reword Draft" analysis only after I have written a draft, so that the AI refines my existing text to meet the requirements and readability goals.
9. As a writer, I want to see a clear visual diff (showing highlighted additions in green and deletions in red) of the AI-proposed rewording compared to my original draft, so that I can inspect changes before deciding to apply them.
10. As a writer, I want to accept or discard the proposed AI changes in the diff view, so that I retain full ownership of the final document text.
11. As a writer, I want to run a readability analysis on-demand, so that I can instantly see my Flesch Reading Ease score and Flesch-Kincaid Grade Level.
12. As a writer, I want the readability scores to be displayed in clear, color-coded visual gauges, so that I can immediately gauge how easy or difficult the text is to read.
13. As a writer, I want to request AI suggestions to improve readability on-demand, so that I have actionable, specific recommendations for simplifying complex sentences or vocabulary in my draft.

---

## Implementation Decisions

### Core Application & UI Architecture
- **Framework**: A lightweight Python FastAPI backend serving static frontend assets (HTML, CSS, and vanilla JS) for a responsive Single Page Application.
- **Themes**: Vanilla CSS supporting four visual themes: Sleek Dark (default), Elegant Light, Warm Sepia (customized font-contrast for writing), and Glassmorphism.
- **Workspace Layout**: The main editor occupies the full screen width by default. The header controls toggle the Configuration, Ghost-Text, and Readability Check sidebars, which slide in from the right and share screen space with the editor without hiding it.

### Local File & Config Management
- **Folder Location**: Configuration settings are stored in `capstone/config.json`.
- **API Key Encryption**: The Gemini API key is encrypted using AES-256-GCM via the Python `cryptography` library. The 256-bit encryption key is generated once and stored in `capstone/.draft_ink.key` with restricted user access.
- **Draft Storage**: Drafts are stored in the user-specified **Document Folder** as `.md` files. The application lists files in this folder and automatically synchronizes the active editor text to the active file.

### AI Co-writing & Ghost-Text
- **On-Demand Rewording**: The backend accepts the current draft along with the topic, key sections, and target word count, and uses Gemini to generate a reworded draft optimizing for structure and readability.
- **Visual Diff Review**: The frontend computes the differences between the original draft and the reworded draft at a sentence or word level, displaying a split diff. Clicking "Accept" replaces the editor content; clicking "Discard" closes the review.

### Readability scoring
- **Client-side Flesch-Kincaid Engine**: Handled entirely in JavaScript for instant feedback. It counts:
  - Sentences (delimited by `.`, `!`, `?` with abbreviation handling).
  - Words (alphanumeric clusters).
  - Syllables (heuristic counting vowel sequences, subtracting silent 'e', and ensuring a minimum of 1 syllable per word).
- **AI Recommendations**: On-demand request that passes the current text and the calculated Flesch-Kincaid scores to Gemini, returning concrete list items detailing which parts of the draft to rewrite.

---

## Testing Decisions

- **Encryption Module**: Unit tests will verify that the encryption and decryption pipeline successfully encrypts API keys, stores them, and recovers the exact original text.
- **Readability Module**: Unit tests will verify the syllable counter, word counter, sentence counter, and the resulting Flesch-Kincaid scores against pre-defined baseline sentences of varying difficulty.
- **Test Execution**: Tests will be placed in the `tests/` directory and run using `pytest`.

---

## Out of Scope

- **User Accounts & Cloud Sync**: All draft files and configuration settings are stored locally on the host machine.
- **Collaborative Real-time Multi-user Editing**: DraftInk is designed as a single-user desktop-like utility.
- **Rich-text styling (Bold, Italic, Images) inside the editor**: The workspace editor is designed for raw Markdown text input, emphasizing content composition and readability.
