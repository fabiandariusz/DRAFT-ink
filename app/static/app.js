// Application State
let appState = {
    activePanel: null, // 'config', 'ghost', 'readability' or null
    theme: 'dark',
    model: 'gemini-2.5-flash',
    saveFolder: 'capstone/drafts',
    activeDraftName: 'active_draft.md'
};

// DOM Elements
const editor = document.getElementById('editor');
const wordCountEl = document.getElementById('word-count');
const saveStatusEl = document.getElementById('save-status');
const activeModelEl = document.getElementById('active-model');

const sidePanel = document.getElementById('side-panel');
const panelTitle = document.getElementById('panel-title');
const panelContent = document.getElementById('panel-content');
const closePanelBtn = document.getElementById('close-panel');

const toggleConfigBtn = document.getElementById('toggle-config');
const toggleGhostBtn = document.getElementById('toggle-ghost');
const toggleReadabilityBtn = document.getElementById('toggle-readability');

// Initial Setup
window.addEventListener('DOMContentLoaded', () => {
    // Load local storage states if available
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

    // Load configuration from backend
    loadConfig();

    // Start with a blank editor — user opens a draft explicitly via the dropdown
    appState.activeDraftName = null;
    editor.value = '';
    updateWordCount();
    saveStatusEl.textContent = 'New document — start writing!';

    // Event Listeners
    editor.addEventListener('input', () => {
        updateWordCount();
        triggerAutoSave();
        
        // Update reword button disabled state if it exists
        const rewordBtn = document.getElementById('reword-draft-btn');
        if (rewordBtn) {
            rewordBtn.disabled = editor.value.trim() === '';
        }
    });

    // Panel Toggles
    toggleConfigBtn.addEventListener('click', () => togglePanel('config'));
    toggleGhostBtn.addEventListener('click', () => togglePanel('ghost'));
    toggleReadabilityBtn.addEventListener('click', () => togglePanel('readability'));
    closePanelBtn.addEventListener('click', () => closePanel());

    // Diff Modal Event Listeners
    document.getElementById('close-diff-modal').addEventListener('click', closeDiffModal);
    document.getElementById('reject-diff-btn').addEventListener('click', closeDiffModal);
    document.getElementById('accept-diff-btn').addEventListener('click', acceptDiffChanges);

    // Draft Manager Event Listeners
    const selectEl = document.getElementById('draft-select');
    if (selectEl) {
        selectEl.addEventListener('change', (e) => {
            const chosen = e.target.value;
            if (!chosen) return; // Ignore the placeholder option
            appState.activeDraftName = chosen;
            loadActiveDraft();
        });
    }
    
    const renameBtn = document.getElementById('rename-draft-btn');
    if (renameBtn) {
        renameBtn.addEventListener('click', handleRenameDraft);
    }
    
    // Readability Popover close button
    const closePopoverBtn = document.getElementById('close-popover-btn');
    if (closePopoverBtn) {
        closePopoverBtn.addEventListener('click', () => {
            document.getElementById('readability-popover').classList.add('hidden');
        });
    }
    
    // Initial drafts list load
    refreshDraftsList();
});

// Word Count Engine
function countWords(str) {
    if (!str || str.trim() === "") return 0;
    return str.trim().split(/\s+/).length;
}

function updateWordCount() {
    const text = editor.value;
    const count = countWords(text);
    wordCountEl.textContent = `${count} word${count === 1 ? '' : 's'}`;
}

// Themes System
function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    appState.theme = themeName;
    localStorage.setItem('theme', themeName);
}

// Side Panel Management
function togglePanel(panelName) {
    // If clicking active panel, close it
    if (appState.activePanel === panelName) {
        closePanel();
        return;
    }

    if (panelName !== 'readability' && isOverlayActive) {
        handleToggleOverlay();
    }

    appState.activePanel = panelName;
    
    // Highlight active button
    toggleConfigBtn.classList.toggle('active', panelName === 'config');
    toggleGhostBtn.classList.toggle('active', panelName === 'ghost');
    toggleReadabilityBtn.classList.toggle('active', panelName === 'readability');

    // Slide in
    sidePanel.classList.remove('hidden');

    // Render contents
    renderPanelContent(panelName);
}

function closePanel() {
    appState.activePanel = null;
    toggleConfigBtn.classList.remove('active');
    toggleGhostBtn.classList.remove('active');
    toggleReadabilityBtn.classList.remove('active');
    sidePanel.classList.add('hidden');
    
    if (isOverlayActive) {
        handleToggleOverlay();
    }
}

function renderPanelContent(panelName) {
    panelContent.innerHTML = '';
    
    if (panelName === 'config') {
        panelTitle.textContent = 'Configuration';
        panelContent.innerHTML = `
            <form id="config-form" class="fade-in">
                <div class="form-group">
                    <label for="config-folder">Document Folder</label>
                    <input type="text" id="config-folder" value="${appState.saveFolder}" required placeholder="e.g. capstone/drafts">
                    <span class="field-hint">Draft files will be auto-saved here.</span>
                </div>
                <div class="form-group">
                    <label for="config-theme">Theme</label>
                    <select id="config-theme">
                        <option value="dark" ${appState.theme === 'dark' ? 'selected' : ''}>Sleek Dark</option>
                        <option value="light" ${appState.theme === 'light' ? 'selected' : ''}>Elegant Light</option>
                        <option value="sepia" ${appState.theme === 'sepia' ? 'selected' : ''}>Warm Sepia</option>
                        <option value="glass" ${appState.theme === 'glass' ? 'selected' : ''}>Glassmorphism</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="config-model">AI Model</label>
                    <select id="config-model">
                        <option value="gemini-2.5-flash" ${appState.model === 'gemini-2.5-flash' ? 'selected' : ''}>gemini-2.5-flash (Recommended)</option>
                        <option value="gemini-2.5-pro" ${appState.model === 'gemini-2.5-pro' ? 'selected' : ''}>gemini-2.5-pro</option>
                        <option value="gemini-1.5-flash" ${appState.model === 'gemini-1.5-flash' ? 'selected' : ''}>gemini-1.5-flash</option>
                        <option value="gemini-1.5-pro" ${appState.model === 'gemini-1.5-pro' ? 'selected' : ''}>gemini-1.5-pro</option>
                    </select>
                    <span class="field-hint">Highly efficient models for text generation are recommended.</span>
                </div>
                <div class="form-group">
                    <label for="config-key">Gemini API Key</label>
                    <input type="password" id="config-key" placeholder="${appState.apiKey ? '••••••••••••••••••••' : 'Enter Gemini API key...'}" value="${appState.apiKey || ''}">
                    <span class="field-hint">Stored securely using AES-256 encryption.</span>
                </div>
                <button type="submit" class="btn btn-primary btn-block" id="save-config-btn">Save Configuration</button>
            </form>
        `;
        
        document.getElementById('config-form').addEventListener('submit', handleConfigSubmit);
    } else if (panelName === 'ghost') {
        panelTitle.textContent = 'Ghost-Text Co-writer';
        panelContent.innerHTML = `
            <div class="ghost-panel fade-in" style="display: flex; flex-direction: column; gap: 16px; padding: 16px 0;">
                <div class="form-group">
                    <label for="ghost-topic">Topic / Goal</label>
                    <input type="text" id="ghost-topic" placeholder="e.g. Executive summary of project" style="width: 100%; box-sizing: border-box;">
                </div>
                <div class="form-group">
                    <label for="ghost-sections">Key Outline Sections</label>
                    <textarea id="ghost-sections" rows="6" placeholder="e.g. - Background&#10;- Key Objectives&#10;- Next Steps" style="width: 100%; box-sizing: border-box; resize: vertical;"></textarea>
                </div>
                <div class="form-group">
                    <label for="ghost-words">Target Words (Optional)</label>
                    <input type="number" id="ghost-words" min="50" step="50" placeholder="e.g. 300" style="width: 100%; box-sizing: border-box;">
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
                    <button id="generate-draft-btn" class="btn btn-primary btn-block">
                        Generate Draft
                    </button>
                    <button id="reword-draft-btn" class="btn btn-secondary btn-block" ${editor.value.trim() ? '' : 'disabled'}>
                        Reword Draft
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('generate-draft-btn').addEventListener('click', () => handleGhostText('generate'));
        document.getElementById('reword-draft-btn').addEventListener('click', () => handleGhostText('reword'));
    } else if (panelName === 'readability') {
        panelTitle.textContent = 'Readability Check';
        panelContent.innerHTML = `
            <div class="readability-panel fade-in">
                <button id="run-readability-btn" class="btn btn-primary btn-block" style="margin-bottom: 10px;">
                    Run Readability Check
                </button>
                <button id="toggle-overlay-btn" class="btn btn-secondary btn-block" style="margin-bottom: 24px;">
                    Show Review Overlay
                </button>
                
                <div id="readability-results" class="hidden">
                    <div class="score-card">
                        <div class="score-header">
                            <span>Flesch Reading Ease</span>
                            <span id="reading-ease-score" class="score-val">0.0</span>
                        </div>
                        <div class="progress-bar-container">
                            <div id="reading-ease-bar" class="progress-bar" style="width: 0%"></div>
                        </div>
                        <div class="score-label" id="reading-ease-label">Standard</div>
                    </div>
                    
                    <div class="score-card" style="margin-top: 16px;">
                        <div class="score-header">
                            <span>Kincaid Grade Level</span>
                            <span id="grade-level-score" class="score-val">0.0</span>
                        </div>
                        <div class="score-label" id="grade-level-label">8th Grade</div>
                    </div>
                    
                    <div class="divider" style="margin: 20px 0;"></div>
                    
                    <div class="metrics-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
                        <div class="stat-box" style="padding: 10px; text-align: center; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px;">
                            <span style="font-size: 10px; text-transform: uppercase; color: var(--text-muted);">Words</span>
                            <div id="metric-words" style="font-size: 16px; font-weight: 700; margin-top: 4px;">0</div>
                        </div>
                        <div class="stat-box" style="padding: 10px; text-align: center; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px;">
                            <span style="font-size: 10px; text-transform: uppercase; color: var(--text-muted);">Sentences</span>
                            <div id="metric-sentences" style="font-size: 16px; font-weight: 700; margin-top: 4px;">0</div>
                        </div>
                        <div class="stat-box" style="padding: 10px; text-align: center; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px;">
                            <span style="font-size: 10px; text-transform: uppercase; color: var(--text-muted);">Syllables</span>
                            <div id="metric-syllables" style="font-size: 16px; font-weight: 700; margin-top: 4px;">0</div>
                        </div>
                    </div>
                    
                    <div class="divider" style="margin: 20px 0;"></div>
                    
                    <div class="suggestions-header" style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="font-size: 14px; font-weight: 600;">AI Suggestions</h4>
                        <button id="get-suggestions-btn" class="btn" style="padding: 4px 10px; font-size: 11px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-main);">
                            Analyze
                        </button>
                    </div>
                    <div id="suggestions-list" class="suggestions-list-container">
                        <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5;">
                            Click Analyze to get AI tips on improving readability. (Needs API Key)
                        </p>
                    </div>
                </div>
                
                <div id="readability-empty" class="panel-placeholder">
                    <p style="color: var(--text-muted); font-size: 14px; line-height: 1.6;">
                        Click the button above to run readability analysis on the current draft.
                    </p>
                </div>
            </div>
        `;
        
        document.getElementById('run-readability-btn').addEventListener('click', handleRunReadability);
        
        // Handle overlay button text state dynamically
        const toggleBtn = document.getElementById('toggle-overlay-btn');
        if (toggleBtn) {
            if (isOverlayActive) {
                toggleBtn.textContent = 'Hide Review Overlay';
                toggleBtn.classList.remove('btn-secondary');
                toggleBtn.classList.add('btn-primary');
            } else {
                toggleBtn.textContent = 'Show Review Overlay';
                toggleBtn.classList.remove('btn-primary');
                toggleBtn.classList.add('btn-secondary');
            }
            toggleBtn.addEventListener('click', handleToggleOverlay);
        }
    }
}

// Load configuration from backend
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const config = await response.json();
            appState.saveFolder = config.document_folder;
            appState.theme = config.theme;
            appState.model = config.api_model;
            appState.apiKey = config.api_key;
            
            // Apply theme and model indicator
            setTheme(config.theme);
            activeModelEl.textContent = config.api_model;
        }
    } catch (err) {
        console.error("Failed to load config:", err);
    }
}

// Handle configuration submission
async function handleConfigSubmit(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('save-config-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    const folder = document.getElementById('config-folder').value.trim();
    const theme = document.getElementById('config-theme').value;
    const model = document.getElementById('config-model').value;
    const key = document.getElementById('config-key').value;
    
    const payload = {
        document_folder: folder,
        theme: theme,
        api_model: model,
        api_key: key
    };
    
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            appState.saveFolder = folder;
            appState.theme = theme;
            appState.model = model;
            if (key && !key.includes('•••')) {
                appState.apiKey = '••••••••••••••••••••';
            } else if (!key) {
                appState.apiKey = '';
            }
            
            // Apply configurations
            setTheme(theme);
            activeModelEl.textContent = model;
            
            saveBtn.textContent = 'Saved!';
            saveStatusEl.textContent = 'Configuration saved';
            
            setTimeout(() => {
                if (appState.activePanel === 'config') {
                    renderPanelContent('config');
                }
            }, 1000);
        } else {
            saveBtn.textContent = 'Save Failed';
            saveBtn.disabled = false;
        }
    } catch (err) {
        console.error("Config save error:", err);
        saveBtn.textContent = 'Save Error';
        saveBtn.disabled = false;
    }
}

// Handle Readability Check Execution
async function handleRunReadability() {
    const runBtn = document.getElementById('run-readability-btn');
    const originalText = runBtn.textContent;
    runBtn.textContent = 'Analyzing...';
    runBtn.disabled = true;
    
    try {
        const response = await fetch('/api/readability', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: editor.value })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Show results view
            document.getElementById('readability-results').classList.remove('hidden');
            document.getElementById('readability-empty').classList.add('hidden');
            
            // Set scores
            document.getElementById('reading-ease-score').textContent = data.reading_ease.toFixed(1);
            document.getElementById('grade-level-score').textContent = data.grade_level.toFixed(1);
            
            // Set metrics
            document.getElementById('metric-words').textContent = data.words;
            document.getElementById('metric-sentences').textContent = data.sentences;
            document.getElementById('metric-syllables').textContent = data.syllables;
            
            // Update Reading Ease Progress Bar and Color
            const easeBar = document.getElementById('reading-ease-bar');
            const easePct = Math.max(0, Math.min(100, data.reading_ease));
            easeBar.style.width = `${easePct}%`;
            
            let easeColor = '#ef4444'; // Red
            let easeDesc = 'Very Difficult (College Graduate)';
            if (data.reading_ease >= 90) {
                easeColor = '#10b981'; // Green
                easeDesc = 'Very Easy (5th Grade)';
            } else if (data.reading_ease >= 80) {
                easeColor = '#10b981';
                easeDesc = 'Easy (6th Grade)';
            } else if (data.reading_ease >= 70) {
                easeColor = '#84cc16'; // Yellow-Green
                easeDesc = 'Fairly Easy (7th Grade)';
            } else if (data.reading_ease >= 60) {
                easeColor = '#eab308'; // Yellow
                easeDesc = 'Standard / Plain English (8th & 9th Grade)';
            } else if (data.reading_ease >= 50) {
                easeColor = '#f97316'; // Orange
                easeDesc = 'Fairly Difficult (10th to 12th Grade)';
            } else if (data.reading_ease >= 30) {
                easeColor = '#f97316';
                easeDesc = 'Difficult (College)';
            }
            easeBar.style.backgroundColor = easeColor;
            document.getElementById('reading-ease-label').textContent = easeDesc;
            document.getElementById('reading-ease-label').style.color = easeColor;
            
            // Set Grade Level label
            let gradeDesc = 'College Graduate';
            if (data.grade_level < 6) {
                gradeDesc = 'Elementary School';
            } else if (data.grade_level < 9) {
                gradeDesc = 'Middle School';
            } else if (data.grade_level < 12) {
                gradeDesc = 'High School';
            } else if (data.grade_level < 16) {
                gradeDesc = 'College Level';
            }
            document.getElementById('grade-level-label').textContent = `Equivalent: ${gradeDesc}`;
            
            // Re-bind click event for suggestions (we'll implement the actual API in capstone-0005)
            const suggestBtn = document.getElementById('get-suggestions-btn');
            if (suggestBtn) {
                suggestBtn.addEventListener('click', handleGetSuggestions);
            }
            
        } else {
            alert("Failed to analyze draft readability.");
        }
    } catch (err) {
        console.error("Readability check error:", err);
        alert("Error occurred while analyzing readability.");
    } finally {
        runBtn.textContent = originalText;
        runBtn.disabled = false;
    }
}

// AI Suggestions Loader
async function handleGetSuggestions() {
    const suggestBtn = document.getElementById('get-suggestions-btn');
    const suggestionsList = document.getElementById('suggestions-list');
    
    suggestBtn.disabled = true;
    suggestBtn.textContent = 'Analyzing...';
    suggestionsList.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; padding: 20px 0;">
            <div class="spinner" style="width: 16px; height: 16px; border: 2px solid var(--text-muted); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
            <span style="font-size: 12px; color: var(--text-muted); margin-left: 8px;">Generating suggestions...</span>
        </div>
    `;
    
    try {
        const response = await fetch('/api/readability-suggestions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: editor.value })
        });
        
        if (response.ok) {
            const data = await response.json();
            const suggestions = data.suggestions || [];
            const usage = data.usage || {};
            
            suggestionsList.innerHTML = '';
            
            if (suggestions.length === 0) {
                suggestionsList.innerHTML = `
                    <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5;">
                        Your text looks fantastic! No suggestions for improvement.
                    </p>
                `;
            } else {
                suggestions.forEach(s => {
                    const card = document.createElement('div');
                    card.className = 'suggestion-card fade-in';
                    card.innerHTML = `
                        <div class="suggestion-bullet"></div>
                        <div class="suggestion-text">${escapeHtml(s)}</div>
                    `;
                    suggestionsList.appendChild(card);
                });
                
                // Add token usage indicator
                if (usage && usage.total_tokens !== undefined) {
                    const usageDiv = document.createElement('div');
                    usageDiv.style.fontSize = '10px';
                    usageDiv.style.color = 'var(--text-muted)';
                    usageDiv.style.marginTop = '12px';
                    usageDiv.style.textAlign = 'right';
                    usageDiv.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
                    usageDiv.textContent = `Gemini Usage: ${usage.total_tokens} tokens ($${usage.cost.toFixed(6)})`;
                    suggestionsList.appendChild(usageDiv);
                }
            }
        } else {
            const errData = await response.json();
            suggestionsList.innerHTML = `
                <p style="font-size: 12px; color: var(--danger); line-height: 1.5;">
                    ${escapeHtml(errData.detail || 'Failed to generate suggestions.')}
                </p>
            `;
        }
    } catch (err) {
        console.error("Suggestions fetch error:", err);
        suggestionsList.innerHTML = `
            <p style="font-size: 12px; color: var(--danger); line-height: 1.5;">
                Error fetching AI suggestions.
            </p>
        `;
    } finally {
        suggestBtn.disabled = false;
        suggestBtn.textContent = 'Analyze';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load draft from backend
async function loadActiveDraft() {
    saveStatusEl.textContent = 'Loading draft...';
    try {
        const response = await fetch(`/api/draft?filename=${encodeURIComponent(appState.activeDraftName)}`);
        if (response.ok) {
            const data = await response.json();
            editor.value = data.content || '';
            updateWordCount();
            saveStatusEl.textContent = 'Ready';
        } else if (response.status === 404) {
            editor.value = '';
            updateWordCount();
            saveStatusEl.textContent = 'Ready (New draft)';
        } else {
            saveStatusEl.textContent = 'Failed to load draft';
        }
    } catch (err) {
        console.error("Error loading draft:", err);
        saveStatusEl.textContent = 'Offline - unable to load';
    }
}

// Auto-Save System with 1s debouncing
let autoSaveTimeout = null;
function triggerAutoSave() {
    // Don't auto-save until the user has named the document
    if (!appState.activeDraftName) {
        saveStatusEl.textContent = 'Unsaved — click Rename to save';
        return;
    }
    saveStatusEl.textContent = 'Saving...';
    
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async () => {
        try {
            const payload = {
                filename: appState.activeDraftName,
                content: editor.value
            };
            const response = await fetch('/api/draft', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                saveStatusEl.textContent = 'All changes saved locally';
            } else {
                saveStatusEl.textContent = 'Save failed';
            }
        } catch (err) {
            console.error("Save error:", err);
            saveStatusEl.textContent = 'Save failed (offline)';
        }
    }, 1000);
}

// State to hold temporary proposed draft during review
let proposedDraftContent = '';

// Load and populate drafts list
async function refreshDraftsList(selectedFilename = null) {
    try {
        const response = await fetch('/api/drafts');
        if (response.ok) {
            const drafts = await response.json();
            const selectEl = document.getElementById('draft-select');
            if (!selectEl) return;
            
            selectEl.innerHTML = '';
            
            // Add a blank placeholder as the first option
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = '— Select a draft —';
            placeholder.disabled = true;
            placeholder.selected = !selectedFilename && !appState.activeDraftName;
            selectEl.appendChild(placeholder);
            
            drafts.forEach(filename => {
                const opt = document.createElement('option');
                opt.value = filename;
                opt.textContent = filename;
                if (filename === (selectedFilename || appState.activeDraftName)) {
                    opt.selected = true;
                }
                selectEl.appendChild(opt);
            });
            
            // If a specific file was just created/renamed, add it if not in the list
            if (selectedFilename && !drafts.includes(selectedFilename)) {
                const opt = document.createElement('option');
                opt.value = selectedFilename;
                opt.textContent = selectedFilename;
                opt.selected = true;
                selectEl.insertBefore(opt, placeholder.nextSibling);
            }
        }
    } catch (err) {
        console.error("Failed to list drafts:", err);
    }
}

// Rename active draft
async function handleRenameDraft() {
    const currentName = appState.activeDraftName;
    const suggestedName = currentName || 'my-draft.md';
    const newName = prompt("Enter a name for this document (must end with .md):", suggestedName);
    if (!newName || newName === currentName) return;
    
    if (!newName.endsWith('.md')) {
        alert("Filename must end with .md");
        return;
    }
    
    try {
        // Strategy: always save current content to new filename first.
        // If old file existed on disk, attempt to delete it via rename endpoint.
        const saveResponse = await fetch('/api/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: newName, content: editor.value })
        });
        
        if (!saveResponse.ok) {
            const err = await saveResponse.json();
            alert(`Save failed: ${err.detail || 'Unknown error'}`);
            return;
        }
        
        // If there was a prior saved file with a different name, delete it
        if (currentName && currentName !== newName) {
            try {
                await fetch('/api/draft/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: currentName })
                });
                // Ignore errors — file may not have existed on disk yet
            } catch (_) {}
        }
        
        appState.activeDraftName = newName;
        await refreshDraftsList(newName);
        saveStatusEl.textContent = `Saved as "${newName}"`;
    } catch (err) {
        console.error("Rename error:", err);
        alert("Error saving document.");
    }
}

// Handle Ghost-Text Generation and Rewording
async function handleGhostText(action) {
    const topic = document.getElementById('ghost-topic').value.trim();
    const sections = document.getElementById('ghost-sections').value.trim();
    const wordsInput = document.getElementById('ghost-words').value;
    const targetWords = wordsInput ? parseInt(wordsInput, 10) : null;
    
    if (!topic || !sections) {
        alert("Please provide both Topic and Key Sections outline.");
        return;
    }
    
    const genBtn = document.getElementById('generate-draft-btn');
    const rewordBtn = document.getElementById('reword-draft-btn');
    
    const originalGenText = genBtn.textContent;
    const originalRewordText = rewordBtn.textContent;
    
    if (action === 'generate') {
        genBtn.textContent = 'Generating...';
        genBtn.disabled = true;
        rewordBtn.disabled = true;
    } else {
        rewordBtn.textContent = 'Rewording...';
        genBtn.disabled = true;
        rewordBtn.disabled = true;
    }
    
    try {
        const payload = {
            action: action,
            topic: topic,
            key_sections: sections,
            target_words: targetWords,
            current_draft: action === 'reword' ? editor.value : ''
        };
        
        const response = await fetch('/api/ghost-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            const data = await response.json();
            const returnedDraft = data.draft;
            const usage = data.usage || {};
            
            if (action === 'generate') {
                // Generate a new unique filename
                let baseName = `AI-Draft-${topic.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 15)}`;
                baseName = baseName.replace(/-+/g, '-').replace(/^-|-$/g, '');
                if (!baseName) baseName = 'AI-Draft';
                
                const selectEl = document.getElementById('draft-select');
                const existingNames = selectEl ? Array.from(selectEl.options).map(o => o.value) : [];
                let finalFilename = `${baseName}.md`;
                let counter = 1;
                while (existingNames.includes(finalFilename)) {
                    finalFilename = `${baseName}-${counter}.md`;
                    counter++;
                }
                
                // Add AI Generated Draft label header at the top
                const labeledContent = `[AI Generated Draft: ${topic}]\n\n${returnedDraft}`;
                
                // Save immediately to the new file on the backend
                const saveResponse = await fetch('/api/draft', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        filename: finalFilename,
                        content: labeledContent
                    })
                });
                
                if (saveResponse.ok) {
                    appState.activeDraftName = finalFilename;
                    editor.value = labeledContent;
                    updateWordCount();
                    await refreshDraftsList(finalFilename);
                    saveStatusEl.textContent = 'New draft created';
                    alert(`New document "${finalFilename}" generated successfully! Your existing draft was preserved.`);
                    if (rewordBtn) rewordBtn.disabled = false;
                } else {
                    alert("Failed to save the generated draft.");
                }
            } else {
                // Show side-by-side visual Diff modal for rewording
                proposedDraftContent = returnedDraft;
                const diffs = generateSideBySideDiffHtml(editor.value, returnedDraft);
                
                document.getElementById('diff-original-content').innerHTML = diffs.originalHtml;
                document.getElementById('diff-proposed-content').innerHTML = diffs.proposedHtml;
                
                // Update token usage details in the footer
                const usageText = usage.total_tokens !== undefined 
                    ? `API Token Usage: ${usage.total_tokens} tokens | Cost: $${usage.cost.toFixed(6)}`
                    : `API Token Usage: N/A (Fallback)`;
                document.getElementById('diff-token-usage').textContent = usageText;
                
                document.getElementById('diff-modal').classList.remove('hidden');
            }
        } else {
            const err = await response.json();
            alert(`Error: ${err.detail || 'Failed to execute Ghost-Text assistant.'}`);
        }
    } catch (err) {
        console.error("Ghost-Text error:", err);
        alert("Error calling Ghost-Text assistant.");
    } finally {
        genBtn.textContent = originalGenText;
        rewordBtn.textContent = originalRewordText;
        genBtn.disabled = false;
        rewordBtn.disabled = editor.value.trim() === '';
    }
}

// Side by Side LCS Word Diff Engine
function generateSideBySideDiffHtml(original, proposed) {
    const originalWords = original.split(/(\s+)/);
    const proposedWords = proposed.split(/(\s+)/);
    
    // Setup LCS DP table
    const dp = Array(originalWords.length + 1).fill().map(() => Array(proposedWords.length + 1).fill(0));
    
    for (let i = 1; i <= originalWords.length; i++) {
        for (let j = 1; j <= proposedWords.length; j++) {
            if (originalWords[i - 1] === proposedWords[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    
    let i = originalWords.length;
    let j = proposedWords.length;
    const chunks = [];
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && originalWords[i - 1] === proposedWords[j - 1]) {
            chunks.push({ type: 'equal', text: originalWords[i - 1] });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            chunks.push({ type: 'added', text: proposedWords[j - 1] });
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
            chunks.push({ type: 'removed', text: originalWords[i - 1] });
            i--;
        }
    }
    
    chunks.reverse();
    
    const originalHtml = chunks.map(c => {
        if (c.type === 'removed') {
            return `<span class="diff-removed">${escapeHtml(c.text)}</span>`;
        } else if (c.type === 'equal') {
            return escapeHtml(c.text);
        }
        return ''; // Ignore added words in original column
    }).join('');
    
    const proposedHtml = chunks.map(c => {
        if (c.type === 'added') {
            return `<span class="diff-added">${escapeHtml(c.text)}</span>`;
        } else if (c.type === 'equal') {
            return escapeHtml(c.text);
        }
        return ''; // Ignore removed words in proposed column
    }).join('');
    
    return { originalHtml, proposedHtml };
}

function closeDiffModal() {
    document.getElementById('diff-modal').classList.add('hidden');
    proposedDraftContent = '';
}

function acceptDiffChanges() {
    if (proposedDraftContent) {
        editor.value = proposedDraftContent;
        updateWordCount();
        triggerAutoSave();
        
        // Update reword button disabled state if it exists
        const rewordBtn = document.getElementById('reword-draft-btn');
        if (rewordBtn) {
            rewordBtn.disabled = false;
        }
    }
    closeDiffModal();
}

// Readability overlay state
let isOverlayActive = false;

function handleToggleOverlay() {
    const overlay = document.getElementById('editor-overlay');
    const toggleBtn = document.getElementById('toggle-overlay-btn');
    const popover = document.getElementById('readability-popover');
    
    if (isOverlayActive) {
        overlay.classList.add('hidden');
        popover.classList.add('hidden');
        if (toggleBtn) {
            toggleBtn.textContent = 'Show Review Overlay';
            toggleBtn.classList.remove('btn-primary');
            toggleBtn.classList.add('btn-secondary');
        }
        // Sync scroll back to editor
        editor.scrollTop = overlay.scrollTop;
        isOverlayActive = false;
    } else {
        buildReadabilityOverlay();
        overlay.classList.remove('hidden');
        // Sync scroll to overlay
        overlay.scrollTop = editor.scrollTop;
        if (toggleBtn) {
            toggleBtn.textContent = 'Hide Review Overlay';
            toggleBtn.classList.remove('btn-secondary');
            toggleBtn.classList.add('btn-primary');
        }
        isOverlayActive = true;
    }
}

function buildReadabilityOverlay() {
    const overlay = document.getElementById('editor-overlay');
    const text = editor.value;
    
    // Split sentences using a basic regex but preserving spacers
    const sentences = text.split(/([.!?]+(?:\s+|$))/);
    
    let overlayHtml = '';
    for (let index = 0; index < sentences.length; index++) {
        const part = sentences[index];
        if (index % 2 === 0) {
            if (!part.trim()) {
                overlayHtml += part;
                continue;
            }
            
            // Count words in this sentence
            const words = part.trim().split(/\s+/).filter(w => w);
            const wordCount = words.length;
            
            let highlightClass = '';
            if (wordCount > 25) {
                highlightClass = 'highlight-red';
            } else if (wordCount > 15) {
                highlightClass = 'highlight-yellow';
            }
            
            if (highlightClass) {
                overlayHtml += `<span class="readability-span ${highlightClass}" data-wordcount="${wordCount}">${escapeHtml(part)}</span>`;
            } else {
                overlayHtml += `<span>${escapeHtml(part)}</span>`;
            }
        } else {
            overlayHtml += escapeHtml(part);
        }
    }
    
    overlay.innerHTML = overlayHtml;
    
    // Bind click events on highlighted spans
    overlay.querySelectorAll('.readability-span').forEach(span => {
        span.addEventListener('click', handleSpanClick);
    });
}

function handleSpanClick(e) {
    const span = e.target;
    const wordCount = span.getAttribute('data-wordcount');
    const popover = document.getElementById('readability-popover');
    
    document.getElementById('popover-sentence-stats').textContent = `Length: ${wordCount} words`;
    
    let tip = '';
    if (wordCount > 25) {
        tip = "This sentence is very long. Consider splitting it into shorter, punchier sentences to improve the reading ease.";
    } else {
        tip = "This sentence is moderately long. Look for complex words you can simplify, or passive structures to rephrase.";
    }
    document.getElementById('popover-sentence-tips').textContent = tip;
    
    // Position popover relative to editor container
    const rect = span.getBoundingClientRect();
    const parentRect = editor.parentNode.getBoundingClientRect();
    
    const top = rect.bottom - parentRect.top + 5;
    const left = Math.min(
        parentRect.width - 290,
        Math.max(10, rect.left - parentRect.left)
    );
    
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.classList.remove('hidden');
}
