# Data Schema (Long-Term)

This project uses a dictionary-first model:

- `data/entries.ndjson` is the canonical source of vocabulary entries.
- `data/lessons/index.json` is the lesson manifest (order, labels, lesson codes).
- `data/lessons/<code>.json` maps each study space to entry IDs.

This keeps content deduplicated and supports lesson games, mixed tests, and future features.

## Entry Schema (`data/entries.ndjson`)

Each line is a standalone JSON object.

Required fields:

- `id` (string): stable unique key, example `a1-0001`.
- `ar.vocalized` (string): Arabic display form with diacritics.
- `ar.plain` (string): Arabic plain form without diacritics.
- `he` (array of strings): one or more Hebrew meanings.

Optional fields:

- `pos` (string): part of speech, for example `noun`, `verb`, `prep`, `phrase`.
- `translit.latin` (string): Latin transliteration.
- `translit.he` (string): Hebrew transliteration.
- `tags` (array of strings): free tags, for example `lesson:vocab`, `topic:school`.
- `difficulty` (integer 1-5): estimated learner difficulty.
- `notes_he` (string): concise Hebrew study note.
- `examples` (array of strings): sentence/example IDs.
- `source` (object): provenance metadata.

Example:

```json
{"id":"a1-0001","pos":"noun","ar":{"vocalized":"كِتابٌ","plain":"كتاب"},"he":["ספר"],"translit":{"latin":"kitab","he":"כתאב"},"tags":["lesson:vocab","topic:school"],"difficulty":1}
```

## Lesson Manifest Schema (`data/lessons/index.json`)

Required fields:

- `lessons` (array): ordered list used by UI navigation.
- `lessons[].code` (string): file code, for example `vocab`, `greetings`, `enrichment`.
- `lessons[].lesson` (integer): stable display order number.
- `lessons[].title` (string): Hebrew lesson title shown in UI.

Example:

```json
{
  "lessons": [
    { "code": "vocab", "lesson": 1, "title": "אוצר מילים" },
    { "code": "greetings", "lesson": 2, "title": "ברכות" },
    { "code": "enrichment", "lesson": 3, "title": "העשרה" }
  ]
}
```

## Lesson Schema (`data/lessons/<code>.json`)

Required fields:

- `lesson` (integer): lesson display order from the manifest.
- `items` (array of strings): list of entry IDs from `entries.ndjson`.

Optional fields:

- `title` or `title_he` (string): lesson title in Hebrew.
- `tags` (array of strings): lesson-level tags.
- `notes_he` (string): lesson-level notes.
- `allow_empty_items` (boolean): set `true` when an empty list is intentional.

Example:

```json
{
  "lesson": 1,
  "title": "אוצר מילים",
  "items": ["a1-0001", "a1-0002"]
}
```

## Rules Enforced by Validator

- Every entry ID is unique.
- Lesson manifest rows are validated for code/number/title consistency.
- Every lesson listed in `data/lessons/index.json` must have a matching `data/lessons/<code>.json` file.
- Every lesson ID reference exists in `entries.ndjson`.
- Lesson references are unique across lessons (no duplication).
- `ar.plain` must not contain Arabic diacritics.
- Field types are checked for required and supported optional fields.

## Planned Extensions

When these datasets are added, keep the same ID-linking approach:

- `data/packs/*.json` for Test Center extras packs.
- `data/sentences.ndjson` for cloze/sentence exercises referencing entry IDs.
