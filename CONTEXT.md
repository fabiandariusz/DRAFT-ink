# DraftInk

An application to help users draft work documents with AI-assisted co-writing and readability analysis.

## Language

**Draft**:
The user's actively edited document content.
_Avoid_: File, manuscript, project

**Document Folder**:
The local filesystem directory on the backend where Drafts are saved.
_Avoid_: Workspace, repository, save folder

**Ghost-Text**:
An AI feature that generates drafts or rewords existing text based on user requirements.
_Avoid_: Copilot, AI write, autocomplete

**Readability Check**:
An analysis of the Draft using Flesch-Kincaid metrics and AI-generated style improvement suggestions.
_Avoid_: Proofread, spelling checker

## Relationships

- A **Draft** is saved within the **Document Folder**.
- **Ghost-Text** reads and updates the **Draft** based on user requirements.
- **Readability Check** analyzes the **Draft** to produce readability scores and suggestions.

## Example Dialogue

> **Dev:** "When the user edits the **Draft**, do we immediately save it to the **Document Folder**?"
> **Domain expert:** "Yes, we auto-save the active **Draft** as a Markdown file in the configured **Document Folder**."

## Flagged Ambiguities

- "folder" vs "directory" — resolved: we use **Document Folder** to mean the backend directory configured for storing drafts.
