# Arabic 1 (Technion) – Study Hub (Starter)

This starter gives you:
- 13 lessons (each lesson references entry IDs)
- Flashcards + Quiz (MCQ)
- A "Test Center" that mixes selected lessons
- Data stored cleanly as NDJSON + lesson mapping (good long-term)

## Data structure (recommended)

- `data/entries.ndjson` – one JSON object per line (stable, easy diffs)
- `data/lessons/01.json` … `13.json` – list of entry IDs for each lesson

### Entry format (example)

```json
{"id":"a1-0001","pos":"noun","ar":{"vocalized":"كِتابٌ","plain":"كتاب"},"he":["ספר"],"translit":{"latin":"kitābun","he":"כִּתַאבּוּן"},"tags":["lesson:01"]}
```

Tips:
- Put Arabic with tashkīl in `ar.vocalized` and a plain version in `ar.plain`.
- Hebrew can be a string or an array of alternatives.
- Transliteration can be Latin and/or Hebrew.

## How to add lesson words

1) Add word objects to `data/entries.ndjson` (give each a unique `id`).
2) Add those IDs to the lesson file, e.g. `data/lessons/01.json`:
```json
{ "lesson": 1, "title": "Lesson 1", "items": ["a1-0001","a1-0002"] }
```

## Games

- Flashcards: `game.html?l=01&mode=flashcards`
- Quiz: `game.html?l=01&mode=quiz`

Test Center builds a temporary pack in `sessionStorage` so it works without a backend.

## Next upgrades (easy)
- Typing mode (Arabic/Hebrew) with diacritics-insensitive matching
- Matching game (pairs)
- Sentence cloze using `data/sentences.json`
