# DraftInk

**DraftInk** is a distraction-free, local-first co-writing workspace designed for authors, students, and professionals. It integrates a powerful AI assistant (powered by Google Gemini) directly into your workflow without sacrificing your privacy, local file control, or editorial oversight.

Instead of operating as a "black box" that silently overwrites your work, DraftInk provides total transparency. It features a custom dynamic programming visual diff engine that shows you exactly what the AI added or removed before you accept any changes.

---

## Features

- 🔒 **Local-First Security**: Runs entirely on your machine. Your Gemini API key is securely encrypted at rest using AES-256-GCM.
- 📁 **Workspace Management**: You maintain absolute control over your documents. DraftInk reads and saves Markdown files directly to a designated local folder on your machine, guarded by strict path traversal protections.
- 👻 **Ghost-Text Visual Diffs**: Request rewrites based on your outlines or target word counts. Changes are presented in a beautiful, side-by-side visual diff modal so you can review grammatical tweaks and additions before accepting them.
- 📊 **Readability Analysis**: Instantly compute Flesch-Kincaid readability metrics (Reading Ease and Grade Level) locally, with on-demand AI suggestions for simplifying complex sentences.
- 🎨 **Minimalist Customization**: Toggle between carefully crafted Light, Dark, Sepia, and Glassmorphic themes designed to keep you focused.

---

## Prerequisites

To run this project locally, you will need:
- **Python 3.10 or higher** installed on your system.
- **uv**: An extremely fast Python package installer and resolver. 
  - Install `uv` via pip if you don't have it: `pip install uv`
- A **Google Gemini API Key** (to enable the AI Ghost-Text and Readability suggestion features).

---

## Step-by-Step Installation & Setup

1. **Clone or Download the Repository**
   Navigate to the directory where you want to install the project in your terminal:
   ```bash
   cd /path/to/your/workspace
   git clone <repository_url>
   cd capstone
   ```

2. **Start the Application**
   Because the project uses `uv` and is configured via `pyproject.toml`, you can start the FastAPI server directly in one command. `uv` will automatically manage the virtual environment and dependencies for you:
   ```bash
   uv run uvicorn app.server:app --port 8000 --host 127.0.0.1
   ```

3. **Access the Application**
   Open your preferred web browser and navigate to:
   ```text
   http://127.0.0.1:8000
   ```

4. **Initial Configuration**
   - Click the **Config (Gear)** icon in the top navigation bar.
   - Set your desired **Document Folder** (This must be a subdirectory within the project root for security reasons, e.g., `drafts/`).
   - Enter your **Gemini API Key**. (This key will be immediately encrypted using AES-256 and stored securely).
   - Select your preferred theme and AI model (`gemini-2.5-flash` is recommended for speed).
   - Click **Save**.

---

## Security Architecture

DraftInk was built with robust local security as a primary requirement:
- **API Key Protection**: Your API key is never stored in plaintext. A unique 256-bit AES key is generated on first launch (`.draft_ink.key`) with restricted read/write permissions. The key is only decrypted in memory at the exact moment an AI request is made.
- **Path Traversal Guards**: The backend implements strict verification to ensure all document reads, writes, and renames occur strictly within your designated workspace folder, neutralizing arbitrary file write vulnerabilities.

---

## Running Tests

DraftInk includes a comprehensive suite of automated tests covering the backend API, encryption protocols, and path validations.

To run the test suite, ensure the server is stopped, and run:
```bash
uv run pytest tests/
```
