import os
import json
import base64
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from google.genai import Client

app = FastAPI(title="DraftInk")

# App directories
APP_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(APP_DIR)
DEFAULT_FOLDER = os.path.join(PROJECT_ROOT, "drafts")

# Global paths (can be redirected for testing)
KEY_FILE = os.path.join(PROJECT_ROOT, ".draft_ink.key")
CONFIG_FILE = os.path.join(PROJECT_ROOT, "config.json")
DOCUMENT_FOLDER = DEFAULT_FOLDER

def set_key_file_path(path: str):
    global KEY_FILE
    KEY_FILE = path

def set_config_file_path(path: str):
    global CONFIG_FILE
    CONFIG_FILE = path
    # Reload config if the path changes (e.g. in tests)
    load_configuration_on_startup()

def set_document_folder(folder_path: str):
    global DOCUMENT_FOLDER
    DOCUMENT_FOLDER = folder_path
    os.makedirs(DOCUMENT_FOLDER, exist_ok=True)

# Ensure default folders exist
os.makedirs(DOCUMENT_FOLDER, exist_ok=True)

# --- Encryption/Decryption Helpers (AES-256-GCM) ---

def _get_encryption_key() -> bytes:
    if not os.path.exists(KEY_FILE):
        # Generate a new 256-bit AES key
        key = AESGCM.generate_key(bit_length=256)
        with open(KEY_FILE, "wb") as f:
            f.write(key)
        try:
            os.chmod(KEY_FILE, 0o600)  # Restricted read/write
        except Exception:
            pass
    else:
        with open(KEY_FILE, "rb") as f:
            key = f.read()
    return key

def encrypt_api_key(api_key: str) -> tuple[str, str]:
    if not api_key:
        return "", ""
    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # Recommended 12 bytes nonce for GCM
    ciphertext = aesgcm.encrypt(nonce, api_key.encode("utf-8"), None)
    return (
        base64.b64encode(ciphertext).decode("utf-8"),
        base64.b64encode(nonce).decode("utf-8")
    )

def decrypt_api_key(encrypted_base64: str, nonce_base64: str) -> str:
    if not encrypted_base64 or not nonce_base64:
        return ""
    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    ciphertext = base64.b64decode(encrypted_base64)
    nonce = base64.b64decode(nonce_base64)
    decrypted = aesgcm.decrypt(nonce, ciphertext, None)
    return decrypted.decode("utf-8")

# --- Configuration Persistence ---

def load_configuration_on_startup():
    global DOCUMENT_FOLDER
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                data = json.load(f)
            folder = data.get("document_folder", DEFAULT_FOLDER)
            resolved_folder = os.path.abspath(folder)
            if os.path.commonpath([PROJECT_ROOT]) == os.path.commonpath([PROJECT_ROOT, resolved_folder]):
                set_document_folder(resolved_folder)
            else:
                set_document_folder(DEFAULT_FOLDER)
        except Exception:
            set_document_folder(DEFAULT_FOLDER)
    else:
        set_document_folder(DEFAULT_FOLDER)

load_configuration_on_startup()

# --- Request/Response Models ---

class DraftSaveRequest(BaseModel):
    filename: str
    content: str

class ConfigUpdateRequest(BaseModel):
    document_folder: str
    theme: str
    api_model: str
    api_key: str = ""

# --- API Routes ---

@app.post("/api/draft")
def save_draft(req: DraftSaveRequest):
    try:
        os.makedirs(DOCUMENT_FOLDER, exist_ok=True)
        file_path = os.path.join(DOCUMENT_FOLDER, req.filename)
        # Path traversal guard
        if os.path.commonpath([DOCUMENT_FOLDER]) != os.path.commonpath([DOCUMENT_FOLDER, file_path]):
            raise HTTPException(status_code=400, detail="Invalid filename path")
            
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(req.content)
        return {"status": "success", "filename": req.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/draft")
def load_draft(filename: str):
    try:
        file_path = os.path.join(DOCUMENT_FOLDER, filename)
        if os.path.commonpath([DOCUMENT_FOLDER]) != os.path.commonpath([DOCUMENT_FOLDER, file_path]):
            raise HTTPException(status_code=400, detail="Invalid filename path")
            
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"filename": filename, "content": content}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/drafts")
def list_drafts():
    try:
        os.makedirs(DOCUMENT_FOLDER, exist_ok=True)
        files = []
        for f in os.listdir(DOCUMENT_FOLDER):
            if os.path.isfile(os.path.join(DOCUMENT_FOLDER, f)) and f.endswith(".md"):
                files.append(f)
        return sorted(files)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class RenameRequest(BaseModel):
    old_filename: str
    new_filename: str

@app.post("/api/draft/rename")
def rename_draft(req: RenameRequest):
    try:
        old_path = os.path.join(DOCUMENT_FOLDER, req.old_filename)
        new_path = os.path.join(DOCUMENT_FOLDER, req.new_filename)
        
        # Path traversal checks
        if os.path.commonpath([DOCUMENT_FOLDER]) != os.path.commonpath([DOCUMENT_FOLDER, old_path]) or \
           os.path.commonpath([DOCUMENT_FOLDER]) != os.path.commonpath([DOCUMENT_FOLDER, new_path]):
            raise HTTPException(status_code=400, detail="Invalid path")
            
        if not os.path.exists(old_path):
            raise HTTPException(status_code=404, detail="Source file not found")
            
        if os.path.exists(new_path):
            raise HTTPException(status_code=400, detail="Destination file already exists")
            
        os.rename(old_path, new_path)
        return {"status": "success", "new_filename": req.new_filename}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DeleteRequest(BaseModel):
    filename: str

@app.post("/api/draft/delete")
def delete_draft(req: DeleteRequest):
    try:
        file_path = os.path.join(DOCUMENT_FOLDER, req.filename)
        # Path traversal check
        if os.path.commonpath([DOCUMENT_FOLDER]) != os.path.commonpath([DOCUMENT_FOLDER, file_path]):
            raise HTTPException(status_code=400, detail="Invalid path")
        # Silently succeed if file doesn't exist
        if os.path.exists(file_path):
            os.remove(file_path)
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/config")
def get_config():
    if not os.path.exists(CONFIG_FILE):
        return {
            "document_folder": DOCUMENT_FOLDER,
            "theme": "dark",
            "api_model": "gemini-2.5-flash",
            "api_key": ""
        }
    try:
        with open(CONFIG_FILE, "r") as f:
            data = json.load(f)
            
        # Mask API key if encrypted value exists
        has_key = bool(data.get("api_key_encrypted"))
        return {
            "document_folder": data.get("document_folder", DOCUMENT_FOLDER),
            "theme": data.get("theme", "dark"),
            "api_model": data.get("api_model", "gemini-2.5-flash"),
            "api_key": "••••••••••••••••••••" if has_key else ""
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/config")
def update_config(req: ConfigUpdateRequest):
    try:
        # Verify document_folder resides inside PROJECT_ROOT
        target_folder = os.path.abspath(req.document_folder)
        if os.path.commonpath([PROJECT_ROOT]) != os.path.commonpath([PROJECT_ROOT, target_folder]):
            raise HTTPException(status_code=400, detail="Document folder must reside inside the project workspace directory")

        # Load existing config if exists
        existing_config = {}
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r") as f:
                    existing_config = json.load(f)
            except Exception:
                pass
                
        # Determine API key update
        api_key_encrypted = existing_config.get("api_key_encrypted", "")
        api_key_nonce = existing_config.get("api_key_nonce", "")
        
        # If user provided a new key (not masked and not empty)
        if req.api_key and "•••" not in req.api_key:
            enc_key, nonce = encrypt_api_key(req.api_key)
            api_key_encrypted = enc_key
            api_key_nonce = nonce
        elif not req.api_key:
            # Clear key
            api_key_encrypted = ""
            api_key_nonce = ""
            
        # Update settings
        new_config = {
            "document_folder": req.document_folder,
            "theme": req.theme,
            "api_model": req.api_model,
            "api_key_encrypted": api_key_encrypted,
            "api_key_nonce": api_key_nonce
        }
        
        # Save to file
        with open(CONFIG_FILE, "w") as f:
            json.dump(new_config, f, indent=2)
            
        # Update active document folder
        set_document_folder(req.document_folder)
        
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Readability Check Module (Flesch-Kincaid) ---

import re

def count_syllables_in_word(word: str) -> int:
    word = word.lower().strip()
    word = re.sub(r'[^a-z]', '', word)
    if not word:
        return 0
    if len(word) <= 3:
        return 1
    vowels = "aeiouy"
    count = 0
    in_vowel_seq = False
    for char in word:
        if char in vowels:
            if not in_vowel_seq:
                count += 1
                in_vowel_seq = True
        else:
            in_vowel_seq = False
    
    # Exclude silent 'e' at the end of word (unless ends in -le)
    if word.endswith('e'):
        if not word.endswith('le'):
            count -= 1
            
    return max(1, count)

def calculate_readability(text: str) -> dict:
    text_stripped = text.strip()
    if not text_stripped:
        return {
            "words": 0,
            "sentences": 0,
            "syllables": 0,
            "reading_ease": 100.0,
            "grade_level": 0.0
        }
        
    # Sentence splitting
    sentences_raw = re.split(r'[.!?]+(?:\s+|$)', text_stripped)
    sentences = [s for s in sentences_raw if s.strip()]
    num_sentences = max(1, len(sentences))

    # Word counting
    cleaned_text = re.sub(r'[^a-zA-Z0-9\s]', '', text_stripped)
    words = [w for w in cleaned_text.split() if w]
    num_words = max(1, len(words))

    # Syllable counting
    num_syllables = sum(count_syllables_in_word(w) for w in words)
    num_syllables = max(1, num_syllables)

    # Flesch Reading Ease Formula
    reading_ease = 206.835 - 1.015 * (num_words / num_sentences) - 84.6 * (num_syllables / num_words)

    # Flesch-Kincaid Grade Level Formula
    grade_level = 0.39 * (num_words / num_sentences) + 11.8 * (num_syllables / num_words) - 15.59

    return {
        "words": num_words,
        "sentences": num_sentences,
        "syllables": num_syllables,
        "reading_ease": round(reading_ease, 2),
        "grade_level": round(grade_level, 2)
    }

class ReadabilityRequest(BaseModel):
    text: str

@app.post("/api/readability")
def run_readability(req: ReadabilityRequest):
    try:
        return calculate_readability(req.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- AI Readability Suggestions Endpoint ---

def get_decrypted_api_key() -> str:
    if not os.path.exists(CONFIG_FILE):
        return ""
    try:
        with open(CONFIG_FILE, "r") as f:
            data = json.load(f)
        enc = data.get("api_key_encrypted")
        nonce = data.get("api_key_nonce")
        if enc and nonce:
            return decrypt_api_key(enc, nonce)
    except Exception:
        pass
    return ""

def get_configured_model() -> str:
    if not os.path.exists(CONFIG_FILE):
        return "gemini-2.5-flash"
    try:
        with open(CONFIG_FILE, "r") as f:
            data = json.load(f)
        return data.get("api_model", "gemini-2.5-flash")
    except Exception:
        return "gemini-2.5-flash"

# --- Gemini Cost Calculator Helper ---

def calculate_gemini_cost(model: str, prompt_tokens: int, candidate_tokens: int) -> float:
    rates = {
        "gemini-2.5-flash": {"input": 0.075, "output": 0.30},
        "gemini-2.5-pro": {"input": 1.25, "output": 5.00},
        "gemini-1.5-flash": {"input": 0.075, "output": 0.30},
        "gemini-1.5-pro": {"input": 1.25, "output": 5.00},
    }
    rate = rates.get(model, rates["gemini-2.5-flash"])
    cost = (prompt_tokens * rate["input"] + candidate_tokens * rate["output"]) / 1_000_000
    return round(cost, 6)

class SuggestionsRequest(BaseModel):
    text: str

@app.post("/api/readability-suggestions")
def get_readability_suggestions(req: SuggestionsRequest):
    api_key = get_decrypted_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is not configured. Please add it in Configuration.")
        
    model = get_configured_model()
    
    prompt = (
        "You are an expert copyeditor. Analyze the following text for readability and clarity.\n"
        "Calculate its readability metrics mentally, then provide a list of exactly 3 to 5 concrete, "
        "actionable recommendations to improve its readability (e.g. split long sentences, replace "
        "complex vocabulary, use active voice). Do not include general advice; refer to specific parts "
        "of the text.\n\n"
        "Return your suggestions ONLY as a JSON list of strings. Do not include markdown block syntax "
        "like ```json. For example:\n"
        "[\"Recommendation 1\", \"Recommendation 2\"]\n\n"
        f"Text to analyze:\n{req.text}"
    )
    
    try:
        client = Client(api_key=api_key)
        response = client.models.generate_content(
            model=model,
            contents=prompt
        )
        
        response_text = response.text.strip() if response.text else ""
        if response_text.startswith("```"):
            response_text = re.sub(r"^```(?:json)?\n", "", response_text)
            response_text = re.sub(r"\n```$", "", response_text)
            
        suggestions = json.loads(response_text)
        if not isinstance(suggestions, list):
            raise ValueError("Response is not a list")
            
        prompt_tokens = 0
        candidate_tokens = 0
        total_tokens = 0
        if response.usage_metadata:
            prompt_tokens = response.usage_metadata.prompt_token_count or 0
            candidate_tokens = response.usage_metadata.candidates_token_count or 0
            total_tokens = response.usage_metadata.total_token_count or 0
            
        cost = calculate_gemini_cost(model, prompt_tokens, candidate_tokens)
        
        return {
            "suggestions": suggestions,
            "usage": {
                "prompt_tokens": prompt_tokens,
                "candidate_tokens": candidate_tokens,
                "total_tokens": total_tokens,
                "cost": cost
            }
        }
    except Exception as e:
        # Fallback recommendations if API or parsing fails
        return {
            "suggestions": [
                "Break up sentences longer than 25 words to improve reading ease.",
                "Use active verbs instead of passive voice structure where possible.",
                "Simplify complex vocabulary to lower the equivalent grade level."
            ],
            "usage": {
                "prompt_tokens": 0,
                "candidate_tokens": 0,
                "total_tokens": 0,
                "cost": 0.0,
                "fallback": True
            }
        }

# --- Ghost-Text Endpoints ---

from typing import Literal

class GhostTextRequest(BaseModel):
    action: Literal["generate", "reword"]
    topic: str
    key_sections: str
    target_words: int | None = None
    current_draft: str = ""

@app.post("/api/ghost-text")
def run_ghost_text(req: GhostTextRequest):
    api_key = get_decrypted_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is not configured. Please add it in Configuration.")
        
    model = get_configured_model()
    client = Client(api_key=api_key)
    
    # Formulate prompts based on action
    if req.action == "generate":
        prompt = (
            "You are a professional writing assistant. Write a comprehensive, well-structured draft "
            f"document based on the following requirements:\n\n"
            f"Document Topic: {req.topic}\n"
            f"Key Sections to Cover:\n{req.key_sections}\n"
        )
        if req.target_words:
            prompt += f"Target Word Count: approximately {req.target_words} words.\n"
            
        prompt += (
            "\nInstructions:\n"
            "- Just return the raw draft text. Do not wrap in markdown quotes, block formatting, or explain yourself.\n"
            "- Follow a clear, highly readable structure.\n"
        )
    else:  # reword
        prompt = (
            "You are a professional editor. Reword and improve the user's current draft to align "
            f"with their topic and key sections, while optimizing its readability (aiming for clear sentences, "
            "active voice, and simplified vocabulary where appropriate).\n\n"
            f"Document Topic: {req.topic}\n"
            f"Key Sections to Cover:\n{req.key_sections}\n"
            f"User's Current Draft:\n{req.current_draft}\n\n"
            "Instructions:\n"
            "- Return ONLY the final reworded document text. Do not explain changes, do not add introductory comments, "
            "and do not wrap the response in markdown backticks.\n"
            "- Maintain the user's core intent but improve flow, sentence structures, and readability scores.\n"
        )
        
    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt
        )
        draft_text = response.text if response.text else ""
        draft_text = draft_text.strip()
        if draft_text.startswith("```"):
            draft_text = re.sub(r"^```(?:markdown)?\n", "", draft_text)
            draft_text = re.sub(r"\n```$", "", draft_text)
            
        prompt_tokens = 0
        candidate_tokens = 0
        total_tokens = 0
        if response.usage_metadata:
            prompt_tokens = response.usage_metadata.prompt_token_count or 0
            candidate_tokens = response.usage_metadata.candidates_token_count or 0
            total_tokens = response.usage_metadata.total_token_count or 0
            
        cost = calculate_gemini_cost(model, prompt_tokens, candidate_tokens)
        
        return {
            "draft": draft_text.strip(),
            "usage": {
                "prompt_tokens": prompt_tokens,
                "candidate_tokens": candidate_tokens,
                "total_tokens": total_tokens,
                "cost": cost
            }
        }
    except Exception as e:
        # Fallback returned text in case of API failure or missing keys
        if req.action == "generate":
            fallback_text = (
                f"# {req.topic}\n\n"
                "## Introduction\n"
                "This is a placeholder draft generated locally because the Gemini API request timed out or returned an error. "
                "Verify your API Key configuration in the settings.\n\n"
                "## Key Outline Sections\n"
                f"The outline sections identified are: {req.key_sections}.\n"
            )
        else:
            fallback_text = (
                f"# {req.topic} (Edited)\n\n"
                f"{req.current_draft}\n\n"
                "*(Note: AI rewording failed. Showing the original draft with fallback formatting)*"
            )
        return {
            "draft": fallback_text,
            "usage": {
                "prompt_tokens": 0,
                "candidate_tokens": 0,
                "total_tokens": 0,
                "cost": 0.0,
                "fallback": True
            }
        }

# Resolve static directory path
STATIC_DIR = os.path.join(APP_DIR, "static")

# Mount static files to root "/"
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
