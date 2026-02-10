# Arabic 1 (Technion) — Hebrew Study Hub (Unofficial)

A GitHub Pages website for **Hebrew speakers** who want to practice **spoken Arabic** for the Technion course “Arabic 1”.

- **Website UI:** Hebrew (RTL)
- **Repo, docs, and commit messages:** English

Live site (GitHub Pages):
https://yaronmozes.github.io/arabic1-technion/

> אתר תרגול לא רשמי לקורס ערבית 1 בטכניון — מיועד לדוברי עברית.

---

## Features (current)
- 13 lesson pages (Lesson 1–13)
- Lesson vocabulary table
- Per-lesson games:
  - Flashcards
  - Multiple-choice quiz (MCQ)
- Test Center:
  - Mix selected lessons
  - Run Flashcards or Quiz on the combined set

---

## Project structure

```
/
  index.html
  lesson.html
  game.html
  test.html
  test-run.html
  /assets
    styles.css
    app.js
    data.js
  /data
    entries.ndjson
    /lessons
      01.json
      02.json
      ...
      13.json
```

### Why this data model?
This repo is designed for long-term growth (many words + multiple game modes):

- `data/entries.ndjson` is the **canonical dictionary** (one JSON object per line).
- Each lesson file `data/lessons/XX.json` contains only a list of **entry IDs**.
  - This avoids duplication and makes “Test packs” easy.

---

## Data formats

### `data/entries.ndjson` (dictionary)
One JSON object per line:

```json
{"id":"a1-0001","pos":"noun","ar":{"vocalized":"كِتابٌ","plain":"كتاب"},"he":["ספר"],"translit":{"latin":"kitābun","he":"כתאבון"},"tags":["lesson:01"]}
```

Recommended fields:
- `id` (string): stable unique ID (never reuse)
- `pos` (string): noun / verb / prep / phrase / etc. (optional but useful)
- `ar.vocalized`: Arabic **with** tashkīl (for display)
- `ar.plain`: Arabic **without** tashkīl (for matching/typing)
- `he`: Hebrew meaning (string or array of alternatives)
- `translit.latin`: transliteration in Latin (recommended)
- `translit.he`: transliteration written in Hebrew letters (optional)
- `tags`: anything helpful (lesson, topic, difficulty, etc.)

### `data/lessons/01.json` … `13.json` (lesson mapping)
Example:

```json
{
  "lesson": 1,
  "title": "שיעור 1",
  "items": ["a1-0001", "a1-0002"]
}
```

---

## How to add words / build lessons

1) Add new entries to `data/entries.ndjson`
   - Give each entry a new unique `id`.
2) Add the entry IDs to the lesson file:
   - `data/lessons/01.json` for Lesson 1
   - ...
   - `data/lessons/13.json` for Lesson 13
3) Commit + push — GitHub Pages updates automatically.

---

## Local development (Windows + VS Code)

### Requirements
- VS Code
- Git for Windows
- (Optional) Python for a local server **or** the VS Code “Live Server” extension

### Clone + run
```bash
git clone https://github.com/YaronMozes/arabic1-technion.git
cd arabic1-technion
```

Because the site uses ES modules (`<script type="module">`), open it using a local server (not `file://`).

**Option A — Python:**
```bash
python -m http.server 8000
```
Open:
http://localhost:8000/

**Option B — VS Code extension:**
Install “Live Server”, then right-click `index.html` → “Open with Live Server”.

---

## Roadmap (planned)
- Typing mode (Arabic / Hebrew), including diacritics-insensitive checking
- Matching game (pairs)
- Sentence completion (cloze) using `data/sentences.json`
- Dictionary search page (browse + filters)

---

## Disclaimer
This is an **unofficial** study companion and is not affiliated with the Technion.
