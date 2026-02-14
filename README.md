# Arabic 1 (Technion) — Hebrew Study Hub (Unofficial)

A GitHub Pages website for **Hebrew speakers** who want to practice **spoken Arabic** for the Technion course “Arabic 1”.

- **Website UI:** Hebrew (RTL)
- **Repo, docs, and commit messages:** English

Live site (GitHub Pages):
https://yaronmozes.github.io/arabic1-technion/

> אתר תרגול לא רשמי לקורס ערבית 1 בטכניון — מיועד לדוברי עברית.

---

## Features (current)
- 3 core study spaces:
  - אוצר מילים
  - ברכות
  - העשרה
- Lesson vocabulary table
- Per-space practice:
  - Multiple-choice quiz (MCQ)
  - Matching game (Arabic ↔ Hebrew)
- Test Center:
  - Mix selected spaces
  - Run Quiz on the combined set

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
  /docs
    data-schema.md
  /data
    entries.ndjson
    /lessons
      index.json
      vocab.json
      greetings.json
      enrichment.json
  /scripts
    validate-data.mjs
```

### Why this data model?
This repo is designed for long-term growth (many words + multiple game modes):

- `data/entries.ndjson` is the **canonical dictionary** (one JSON object per line).
- `data/lessons/index.json` is the **lesson manifest** (order, labels, navigation).
- Each lesson file `data/lessons/<code>.json` contains only a list of **entry IDs**.
  - This avoids duplication and makes “Test packs” easy.

---

## Data formats

### `data/entries.ndjson` (dictionary)
One JSON object per line:

```json
{"id":"a1-0001","pos":"noun","ar":{"vocalized":"كِتابٌ","plain":"كتاب"},"he":["ספר"],"translit":{"latin":"kitābun","he":"כתאבון"},"tags":["lesson:vocab"]}
```

Recommended fields:
- `id` (string): stable unique ID (never reuse)
- `pos` (string): noun / verb / prep / phrase / etc. (optional but useful)
- `ar.vocalized`: Arabic **with** tashkīl (for display)
- `ar.plain`: Arabic **without** tashkīl (for matching/typing)
- `he`: Hebrew meanings (array of alternatives)
- `translit.latin`: transliteration in Latin (recommended)
- `translit.he`: transliteration written in Hebrew letters (optional)
- `tags`: anything helpful (lesson, topic, difficulty, etc.)

Schema reference:
- `docs/data-schema.md`

### `data/lessons/index.json` (lesson manifest)
Defines lesson order and labels used in UI selectors/cards:

```json
{
  "lessons": [
    { "code": "vocab", "lesson": 1, "title": "אוצר מילים" },
    { "code": "greetings", "lesson": 2, "title": "ברכות" },
    { "code": "enrichment", "lesson": 3, "title": "העשרה" }
  ]
}
```

### `data/lessons/vocab.json` (lesson mapping)
Example:

```json
{
  "lesson": 1,
  "title": "אוצר מילים",
  "items": ["a1-0001", "a1-0002"]
}
```

---

## How to add words / build lessons

1) Add new entries to `data/entries.ndjson`
   - Give each entry a new unique `id`.
2) Add the entry IDs to `data/lessons/vocab.json`.
3) For greetings/enrichment-specific items, use `data/lessons/greetings.json` or `data/lessons/enrichment.json`.
4) If lesson order/titles change, update `data/lessons/index.json`.
5) Commit + push — GitHub Pages updates automatically.

---

## Validate data

Run the validator before pushing vocabulary updates:

```bash
node scripts/validate-data.mjs
```

The validator checks:
- NDJSON syntax and required entry fields
- Arabic plain/vocalized consistency rules
- Unique entry IDs
- Lesson manifest schema (`data/lessons/index.json`)
- Lesson file coverage (`vocab.json`, `greetings.json`, `enrichment.json`)
- Missing IDs and duplicated lesson assignments

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

## Navigation drawer
- In lesson/game/test screens, use the floating `ניווט` button to open the right-side navigation drawer.

---

## Roadmap (planned)
- Typing mode (Arabic / Hebrew), including diacritics-insensitive checking
- Sentence completion (cloze) using `data/sentences.json`
- Dictionary search page (browse + filters)

---

## Disclaimer
This is an **unofficial** study companion and is not affiliated with the Technion.
