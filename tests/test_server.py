from fastapi.testclient import TestClient
import pytest
import google.genai
import os

def test_root_serves_editor_html():
    from app.server import app
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert 'id="editor"' in response.text

def test_static_css_served():
    from app.server import app
    client = TestClient(app)
    response = client.get("/style.css")
    assert response.status_code == 200

def test_static_js_served():
    from app.server import app
    client = TestClient(app)
    response = client.get("/app.js")
    assert response.status_code == 200

def test_save_and_load_draft(tmp_path):
    from app.server import app, set_document_folder
    import os
    
    test_folder = str(tmp_path / "test_drafts")
    set_document_folder(test_folder)
    
    client = TestClient(app)
    
    # Save a draft
    save_response = client.post("/api/draft", json={
        "filename": "my_test_draft.md",
        "content": "This is a test draft content."
    })
    assert save_response.status_code == 200
    assert save_response.json() == {"status": "success", "filename": "my_test_draft.md"}
    
    # Verify file was written to disk
    file_path = os.path.join(test_folder, "my_test_draft.md")
    assert os.path.exists(file_path)
    with open(file_path, "r") as f:
        assert f.read() == "This is a test draft content."
        
    # Load the draft
    load_response = client.get("/api/draft?filename=my_test_draft.md")
    assert load_response.status_code == 200
    assert load_response.json() == {
        "filename": "my_test_draft.md",
        "content": "This is a test draft content."
    }

def test_encryption_decryption(tmp_path):
    from app.server import encrypt_api_key, decrypt_api_key, set_key_file_path
    import os
    
    test_key_file = str(tmp_path / "test.key")
    set_key_file_path(test_key_file)
    
    original_key = "AIzaSyTestAPIKey12345"
    
    # Encrypt
    encrypted_data, nonce = encrypt_api_key(original_key)
    assert encrypted_data != original_key
    assert len(encrypted_data) > 0
    assert len(nonce) > 0
    
    # Decrypt
    decrypted_key = decrypt_api_key(encrypted_data, nonce)
    assert decrypted_key == original_key

def test_config_endpoints(tmp_path):
    from app.server import app, set_config_file_path, set_key_file_path, PROJECT_ROOT
    
    test_key_file = str(tmp_path / "test.key")
    test_config_file = str(tmp_path / "test_config.json")
    set_key_file_path(test_key_file)
    set_config_file_path(test_config_file)
    
    client = TestClient(app)
    
    valid_folder = os.path.join(PROJECT_ROOT, "test_drafts_dir")
    
    # Post new config (valid)
    payload = {
        "document_folder": valid_folder,
        "theme": "sepia",
        "api_model": "gemini-2.5-flash",
        "api_key": "AIzaSyTestAPIKey12345"
    }
    post_response = client.post("/api/config", json=payload)
    assert post_response.status_code == 200
    assert post_response.json()["status"] == "success"
    
    # Get config (should return masked API key)
    get_response = client.get("/api/config")
    assert get_response.status_code == 200
    config_data = get_response.json()
    assert config_data["document_folder"] == valid_folder
    assert config_data["theme"] == "sepia"
    assert config_data["api_model"] == "gemini-2.5-flash"
    assert config_data["api_key"] == "••••••••••••••••••••"

def test_config_folder_traversal_blocked(tmp_path):
    from app.server import app, set_config_file_path, set_key_file_path
    
    test_key_file = str(tmp_path / "test.key")
    test_config_file = str(tmp_path / "test_config.json")
    set_key_file_path(test_key_file)
    set_config_file_path(test_config_file)
    
    client = TestClient(app)
    
    # Attempting to point document_folder outside of PROJECT_ROOT (traversal / path injection)
    payload = {
        "document_folder": "/etc/secrets_folder",
        "theme": "dark",
        "api_model": "gemini-2.5-flash",
        "api_key": "AIzaSyTestAPIKey12345"
    }
    post_response = client.post("/api/config", json=payload)
    assert post_response.status_code == 400
    assert "Document folder must reside inside the project workspace directory" in post_response.json()["detail"]

def test_readability_calculations():
    from app.server import calculate_readability
    
    # Simple sentence: "The cat sat on the mat."
    res1 = calculate_readability("The cat sat on the mat.")
    assert res1["words"] == 6
    assert res1["sentences"] == 1
    assert res1["syllables"] == 6
    assert res1["reading_ease"] > 100
    
    # Complex sentence: "This is a simple sentence to verify readability calculations."
    # Words: 9
    # Sentences: 1
    # Syllables: This(1), is(1), a(1), simple(2), sentence(2), to(1), verify(3), readability(5), calculations(4) = 20
    res2 = calculate_readability("This is a simple sentence to verify readability calculations.")
    assert res2["words"] == 9
    assert res2["sentences"] == 1
    assert res2["syllables"] == 20

def test_readability_endpoint():
    from app.server import app
    client = TestClient(app)
    
    response = client.post("/api/readability", json={"text": "The cat sat on the mat."})
    assert response.status_code == 200
    data = response.json()
    assert data["words"] == 6
    assert data["sentences"] == 1
    assert "reading_ease" in data
    assert "grade_level" in data

from unittest.mock import patch, MagicMock

@patch("app.server.Client")
def test_readability_suggestions_endpoint(mock_client_class, tmp_path):
    from app.server import app, set_config_file_path, set_key_file_path, PROJECT_ROOT
    
    test_key_file = str(tmp_path / "test.key")
    test_config_file = str(tmp_path / "test_config.json")
    set_key_file_path(test_key_file)
    set_config_file_path(test_config_file)
    
    client = TestClient(app)
    client.post("/api/config", json={
        "document_folder": os.path.join(PROJECT_ROOT, "test_drafts_dir"),
        "theme": "dark",
        "api_model": "gemini-2.5-flash",
        "api_key": "AIzaSyFakeKey"
    })
    
    # Mock client and response
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    
    mock_response = MagicMock()
    mock_response.text = '["Use shorter sentences in Paragraph 1", "Replace complex words like utilize"]'
    mock_client.models.generate_content.return_value = mock_response
    
    # Call endpoint
    response = client.post("/api/readability-suggestions", json={"text": "This is some complex text."})
    assert response.status_code == 200
    data = response.json()
    assert "suggestions" in data
    assert "usage" in data
    suggestions = data["suggestions"]
    assert len(suggestions) == 2
    assert "Paragraph 1" in suggestions[0]
    assert "utilize" in suggestions[1]

@patch("app.server.Client")
def test_ghost_text_generate_endpoint(mock_client_class, tmp_path):
    from app.server import app, set_config_file_path, set_key_file_path, PROJECT_ROOT
    
    test_key_file = str(tmp_path / "test.key")
    test_config_file = str(tmp_path / "test_config.json")
    set_key_file_path(test_key_file)
    set_config_file_path(test_config_file)
    
    client = TestClient(app)
    client.post("/api/config", json={
        "document_folder": os.path.join(PROJECT_ROOT, "test_drafts_dir"),
        "theme": "dark",
        "api_model": "gemini-2.5-flash",
        "api_key": "AIzaSyFakeKey"
    })
    
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    
    mock_response = MagicMock()
    mock_response.text = "This is a generated draft about Quantum Computing."
    mock_client.models.generate_content.return_value = mock_response
    
    response = client.post("/api/ghost-text", json={
        "action": "generate",
        "topic": "Quantum Computing",
        "key_sections": "Intro, Algorithms",
        "target_words": 100
    })
    assert response.status_code == 200
    data = response.json()
    assert data["draft"] == "This is a generated draft about Quantum Computing."
    assert "usage" in data

@patch("app.server.Client")
def test_ghost_text_reword_endpoint(mock_client_class, tmp_path):
    from app.server import app, set_config_file_path, set_key_file_path, PROJECT_ROOT
    
    test_key_file = str(tmp_path / "test.key")
    test_config_file = str(tmp_path / "test_config.json")
    set_key_file_path(test_key_file)
    set_config_file_path(test_config_file)
    
    client = TestClient(app)
    client.post("/api/config", json={
        "document_folder": os.path.join(PROJECT_ROOT, "test_drafts_dir"),
        "theme": "dark",
        "api_model": "gemini-2.5-flash",
        "api_key": "AIzaSyFakeKey"
    })
    
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    
    mock_response = MagicMock()
    mock_response.text = "This is a reworded version of the text."
    mock_client.models.generate_content.return_value = mock_response
    
    response = client.post("/api/ghost-text", json={
        "action": "reword",
        "topic": "Quantum Computing",
        "key_sections": "Intro, Algorithms",
        "current_draft": "Original text"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["draft"] == "This is a reworded version of the text."
    assert "usage" in data

def test_list_and_rename_drafts(tmp_path):
    from app.server import app, set_config_file_path, set_key_file_path, set_document_folder
    
    test_key_file = str(tmp_path / "test.key")
    test_config_file = str(tmp_path / "test_config.json")
    test_docs_folder = str(tmp_path / "Drafts")
    
    set_key_file_path(test_key_file)
    set_config_file_path(test_config_file)
    set_document_folder(test_docs_folder)
    
    client = TestClient(app)
    
    # Save a draft
    save_resp = client.post("/api/draft", json={
        "filename": "draft1.md",
        "content": "Hello draft 1"
    })
    assert save_resp.status_code == 200
    
    # Save another draft
    save_resp2 = client.post("/api/draft", json={
        "filename": "draft2.md",
        "content": "Hello draft 2"
    })
    assert save_resp2.status_code == 200
    
    # List drafts
    list_resp = client.get("/api/drafts")
    assert list_resp.status_code == 200
    drafts = list_resp.json()
    assert "draft1.md" in drafts
    assert "draft2.md" in drafts
    
    # Rename draft
    rename_resp = client.post("/api/draft/rename", json={
        "old_filename": "draft1.md",
        "new_filename": "draft1_renamed.md"
    })
    assert rename_resp.status_code == 200
    
    # Verify new list
    list_resp2 = client.get("/api/drafts")
    drafts2 = list_resp2.json()
    assert "draft1.md" not in drafts2
    assert "draft1_renamed.md" in drafts2






