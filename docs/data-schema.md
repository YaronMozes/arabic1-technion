# Data Schema (Long-Term)

This project uses a dictionary-first model:

- `data/entries.ndjson` is the canonical source of vocabulary entries.
- `data/lessons/XX.json` maps lesson numbers to entry IDs.

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
- `tags` (array of strings): free tags, for example `lesson:01`, `topic:school`.
- `difficulty` (integer 1-5): estimated learner difficulty.
- `notes_he` (string): concise Hebrew study note.
- `examples` (array of strings): sentence/example IDs.
- `source` (object): provenance metadata.

Example:

```json
{"id":"a1-0001","pos":"noun","ar":{"vocalized":"كِتابٌ","plain":"كتاب"},"he":["ספר"],"translit":{"latin":"kitab","he":"כתאב"},"tags":["lesson:01","topic:school"],"difficulty":1}
```

## Lesson Schema (`data/lessons/XX.json`)

Required fields:

- `lesson` (integer): lesson number, must match file name (`01.json` => `1`).
- `items` (array of strings): list of entry IDs from `entries.ndjson`.

Optional fields:

- `title` or `title_he` (string): lesson title in Hebrew.
- `tags` (array of strings): lesson-level tags.
- `notes_he` (string): lesson-level notes.

Example:

```json
{
  "lesson": 1,
  "title": "שיעור 1",
  "items": ["a1-0001", "a1-0002"]
}
```

## Rules Enforced by Validator

- Every entry ID is unique.
- Every lesson ID reference exists in `entries.ndjson`.
- Lesson references are unique across lessons (no duplication).
- `ar.plain` must not contain Arabic diacritics.
- Field types are checked for required and supported optional fields.

## Planned Extensions

When these datasets are added, keep the same ID-linking approach:

- `data/packs/*.json` for Test Center extras packs.
- `data/sentences.ndjson` for cloze/sentence exercises referencing entry IDs.
