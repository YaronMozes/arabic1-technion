# Data Schema (Long-Term)

This project uses a dictionary-first model:

- `data/dictionary/entries.ndjson` is the canonical source of vocabulary entries.
- `data/spaces/index.json` is the study-space manifest (order, labels, codes).
- `data/spaces/<code>.json` maps each study space to entry IDs.
- `data/exam-prep/*.json` stores focused exam-prep sentence datasets.

This keeps content deduplicated and supports space games, mixed exam prep flows, and future features.

## Entry Schema (`data/dictionary/entries.ndjson`)

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
- `tags` (array of strings): free tags, for example `space:vocab`, `topic:school`.
- `difficulty` (integer 1-5): estimated learner difficulty.
- `notes_he` (string): concise Hebrew study note.
- `examples` (array of strings): sentence/example IDs.
- `source` (object): provenance metadata.

Example:

```json
{"id":"a1-0001","pos":"noun","ar":{"vocalized":"كِتابٌ","plain":"كتاب"},"he":["ספר"],"translit":{"latin":"kitab","he":"כתאב"},"tags":["space:vocab","topic:school"],"difficulty":1}
```

## Study-Space Manifest Schema (`data/spaces/index.json`)

Required fields:

- `spaces` (array): ordered list used by UI navigation.
- `spaces[].code` (string): file code, for example `vocab`, `greetings`, `enrichment`.
- `spaces[].order` (integer): stable display order number.
- `spaces[].title` (string): Hebrew title shown in UI.

Example:

```json
{
  "spaces": [
    { "code": "vocab", "order": 1, "title": "אוצר מילים" },
    { "code": "greetings", "order": 2, "title": "ברכות" },
    { "code": "enrichment", "order": 3, "title": "העשרה" }
  ]
}
```

## Study-Space Schema (`data/spaces/<code>.json`)

Required fields:

- `order` (integer): display order from the manifest.
- `items` (array of strings): list of entry IDs from `data/dictionary/entries.ndjson`.

Optional fields:

- `title` or `title_he` (string): space title in Hebrew.
- `tags` (array of strings): space-level tags.
- `notes_he` (string): space-level notes.
- `allow_empty_items` (boolean): set `true` when an empty list is intentional.
- `aggregate` (string): optional aggregate behavior. Use `all_spaces` to union other spaces.
- `source_spaces` (array of strings): optional source-space codes used when `aggregate` is set.

Example:

```json
{
  "order": 1,
  "title": "אוצר מילים",
  "items": ["a1-0001", "a1-0002"]
}
```

## Rules Enforced by Validator

- Every entry ID is unique.
- Space manifest rows are validated for code/order/title consistency.
- Every space listed in `data/spaces/index.json` must have a matching `data/spaces/<code>.json` file.
- Every space ID reference exists in `data/dictionary/entries.ndjson`.
- Space references are unique across spaces (no duplication).
- `ar.plain` must not contain Arabic diacritics.
- Field types are checked for required and supported optional fields.

## Planned Extensions

When these datasets are added, keep the same ID-linking approach:

- `data/sentences.ndjson` for cloze/sentence exercises referencing entry IDs.
