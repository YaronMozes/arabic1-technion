import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const ENTRIES_PATH = path.join(ROOT, "data", "dictionary", "entries.ndjson");
const SPACES_DIR = path.join(ROOT, "data", "spaces");
const SPACE_INDEX_PATH = path.join(SPACES_DIR, "index.json");

const errors = [];
const warnings = [];

function error(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeSpaces(value) {
  return value.trim().replace(/\s+/g, " ");
}

function stripArabicDiacritics(value) {
  return value
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/ـ/g, "");
}

function hasArabicDiacritics(value) {
  return /[\u064B-\u065F\u0670\u06D6-\u06ED]/.test(value);
}

function hasArabicLetters(value) {
  return /[\u0621-\u063A\u0641-\u064A\u066E-\u066F\u0671-\u06D3\u06FA-\u06FC\u06FF]/.test(
    String(value)
  );
}

function normalizeArabicLetters(value) {
  return String(value)
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي");
}

function validateArrayOfStrings(value, label, context) {
  if (!Array.isArray(value)) {
    error(`${context}: "${label}" must be an array.`);
    return;
  }
  if (value.length === 0) {
    error(`${context}: "${label}" must not be empty.`);
    return;
  }
  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) {
      error(`${context}: "${label}[${index}]" must be a non-empty string.`);
    }
  });
}

function validateEntry(entry, lineNumber, entryIdSet) {
  const context = `data/dictionary/entries.ndjson line ${lineNumber}`;
  if (!isPlainObject(entry)) {
    error(`${context}: entry must be a JSON object.`);
    return;
  }

  const id = entry.id;
  if (!isNonEmptyString(id)) {
    error(`${context}: "id" must be a non-empty string.`);
  } else if (entryIdSet.has(id)) {
    error(`${context}: duplicate entry id "${id}".`);
  } else {
    entryIdSet.add(id);
  }

  if (!isPlainObject(entry.ar)) {
    error(`${context}: "ar" must be an object with "vocalized" and "plain".`);
  } else {
    const vocalized = entry.ar.vocalized;
    const plain = entry.ar.plain;

    if (!isNonEmptyString(vocalized)) {
      error(`${context}: "ar.vocalized" must be a non-empty string.`);
    }
    if (!isNonEmptyString(plain)) {
      error(`${context}: "ar.plain" must be a non-empty string.`);
    }

    const plainHasArabic = isNonEmptyString(plain) && hasArabicLetters(plain);
    const vocalizedHasArabic = isNonEmptyString(vocalized) && hasArabicLetters(vocalized);

    if (plainHasArabic && hasArabicDiacritics(plain)) {
      error(`${context}: "ar.plain" must not contain Arabic diacritics.`);
    }

    // Compare vocalized/plain consistency only for Arabic-script rows.
    if (vocalizedHasArabic && plainHasArabic) {
      const stripped = normalizeSpaces(
        normalizeArabicLetters(stripArabicDiacritics(vocalized))
      );
      const normalizedPlain = normalizeSpaces(normalizeArabicLetters(plain));
      if (stripped !== normalizedPlain) {
        warn(
          `${context}: "ar.vocalized" stripped form differs from "ar.plain" for id "${id}".`
        );
      }
    }
  }

  validateArrayOfStrings(entry.he, "he", context);

  if ("pos" in entry && !isNonEmptyString(entry.pos)) {
    error(`${context}: "pos" must be a non-empty string when provided.`);
  }

  if ("translit" in entry) {
    if (!isPlainObject(entry.translit)) {
      error(`${context}: "translit" must be an object when provided.`);
    } else {
      const { latin, he } = entry.translit;
      if ("latin" in entry.translit && !isNonEmptyString(latin)) {
        error(`${context}: "translit.latin" must be a non-empty string when provided.`);
      }
      if ("he" in entry.translit && !isNonEmptyString(he)) {
        error(`${context}: "translit.he" must be a non-empty string when provided.`);
      }
      if (!("latin" in entry.translit) && !("he" in entry.translit)) {
        warn(`${context}: "translit" has no known keys ("latin"/"he").`);
      }
    }
  }

  if ("tags" in entry) {
    validateArrayOfStrings(entry.tags, "tags", context);
  }

  if ("difficulty" in entry) {
    if (
      !Number.isInteger(entry.difficulty) ||
      entry.difficulty < 1 ||
      entry.difficulty > 5
    ) {
      error(`${context}: "difficulty" must be an integer between 1 and 5.`);
    }
  }

  if ("notes_he" in entry && typeof entry.notes_he !== "string") {
    error(`${context}: "notes_he" must be a string when provided.`);
  }

  if ("examples" in entry) {
    validateArrayOfStrings(entry.examples, "examples", context);
  }

  if ("source" in entry && !isPlainObject(entry.source)) {
    error(`${context}: "source" must be an object when provided.`);
  }
}

async function readJsonFile(filePath, context) {
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (readError) {
    error(`${context}: cannot read file (${readError.message}).`);
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (parseError) {
    error(`${context}: invalid JSON (${parseError.message}).`);
    return null;
  }
}

async function loadEntries() {
  let text;
  try {
    text = await fs.readFile(ENTRIES_PATH, "utf8");
  } catch (readError) {
    error(`Cannot read ${path.relative(ROOT, ENTRIES_PATH)}: ${readError.message}`);
    return new Set();
  }

  const lines = text.split(/\r?\n/);
  const entryIdSet = new Set();

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }
    try {
      const entry = JSON.parse(line);
      validateEntry(entry, index + 1, entryIdSet);
    } catch (parseError) {
      error(`data/dictionary/entries.ndjson line ${index + 1}: invalid JSON (${parseError.message}).`);
    }
  });

  return entryIdSet;
}

async function loadSpaceIndex() {
  const context = "data/spaces/index.json";
  const payload = await readJsonFile(SPACE_INDEX_PATH, context);
  if (!payload) {
    return [];
  }

  if (!isPlainObject(payload)) {
    error(`${context}: root must be a JSON object.`);
    return [];
  }

  if (!Array.isArray(payload.spaces)) {
    error(`${context}: "spaces" must be an array.`);
    return [];
  }

  if (payload.spaces.length === 0) {
    error(`${context}: "spaces" must include at least one row.`);
    return [];
  }

  const seenCodes = new Set();
  const seenNumbers = new Set();
  const spaces = [];

  payload.spaces.forEach((row, index) => {
    const itemContext = `${context} spaces[${index}]`;
    if (!isPlainObject(row)) {
      error(`${itemContext}: space row must be an object.`);
      return;
    }

    const spaceOrder = Number.parseInt(String(row.order ?? ""), 10);
    if (!Number.isInteger(spaceOrder) || spaceOrder < 1) {
      error(`${itemContext}: "order" must be a positive integer.`);
      return;
    }

    const code = isNonEmptyString(row.code) ? row.code.trim() : "";
    if (!isNonEmptyString(row.code)) {
      error(`${itemContext}: "code" must be a non-empty string.`);
    }

    if (!isNonEmptyString(row.title)) {
      error(`${itemContext}: "title" must be a non-empty string.`);
    }
    const title = isNonEmptyString(row.title) ? row.title.trim() : `מרחב ${spaceOrder}`;

    if (seenCodes.has(code)) {
      error(`${itemContext}: duplicate space code "${code}".`);
    } else {
      seenCodes.add(code);
    }

    if (seenNumbers.has(spaceOrder)) {
      error(`${itemContext}: duplicate space order "${spaceOrder}".`);
    } else {
      seenNumbers.add(spaceOrder);
    }

    spaces.push({
      code,
      order: spaceOrder,
      title
    });
  });

  const sortedSpaceOrders = spaces.map((row) => row.order).sort((a, b) => a - b);
  for (let index = 0; index < sortedSpaceOrders.length; index += 1) {
    const expected = index + 1;
    if (sortedSpaceOrders[index] !== expected) {
      warn(
        `${context}: space order values are not sequential from 1 (missing or out of order around ${expected}).`
      );
      break;
    }
  }

  return spaces;
}

async function validateSpaces(entryIdSet, spaceDefs) {
  if (spaceDefs.length === 0) {
    error("No spaces were loaded from data/spaces/index.json.");
    return;
  }

  let spaceFiles = [];
  try {
    spaceFiles = await fs.readdir(SPACES_DIR);
  } catch (readError) {
    error(`Cannot read ${path.relative(ROOT, SPACES_DIR)}: ${readError.message}`);
    return;
  }

  const expectedFileNames = new Set(spaceDefs.map((row) => `${row.code}.json`));

  spaceDefs.forEach((row) => {
    const fileName = `${row.code}.json`;
    if (!spaceFiles.includes(fileName)) {
      error(`Missing required space file: data/spaces/${fileName}`);
    }
  });

  spaceFiles
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .forEach((fileName) => {
      if (fileName === "index.json") {
        return;
      }
      if (!expectedFileNames.has(fileName)) {
        warn(`Unexpected space file present: data/spaces/${fileName}`);
      }
    });

  const idToSpaces = new Map();

  for (const spaceDef of spaceDefs) {
    const spaceCode = spaceDef.code;
    const spaceOrder = spaceDef.order;
    const expectedTitle = spaceDef.title;

    const filePath = path.join(SPACES_DIR, `${spaceCode}.json`);
    const context = `data/spaces/${spaceCode}.json`;
    const space = await readJsonFile(filePath, context);
    if (!space) {
      continue;
    }

    if (!isPlainObject(space)) {
      error(`${context}: root must be a JSON object.`);
      continue;
    }

    const declaredOrder = Number.parseInt(String(space.order ?? ""), 10);
    if (declaredOrder !== spaceOrder) {
      error(`${context}: "order" must be ${spaceOrder}.`);
    }

    if ("title" in space && !isNonEmptyString(space.title)) {
      error(`${context}: "title" must be a non-empty string when provided.`);
    }
    if (isNonEmptyString(space.title) && space.title.trim() !== expectedTitle) {
      warn(
        `${context}: title "${space.title.trim()}" differs from space index title "${expectedTitle}".`
      );
    }

    if ("title_he" in space && !isNonEmptyString(space.title_he)) {
      error(`${context}: "title_he" must be a non-empty string when provided.`);
    }

    if ("allow_empty_items" in space && typeof space.allow_empty_items !== "boolean") {
      error(`${context}: "allow_empty_items" must be boolean when provided.`);
    }

    if (!Array.isArray(space.items)) {
      error(`${context}: "items" must be an array.`);
      continue;
    }

    const allowEmptyItems = space.allow_empty_items === true;
    if (space.items.length === 0 && !allowEmptyItems) {
      warn(`${context}: "items" is empty.`);
    }

    const localSet = new Set();
    space.items.forEach((itemId, itemIndex) => {
      const itemContext = `${context} items[${itemIndex}]`;
      if (!isNonEmptyString(itemId)) {
        error(`${itemContext}: entry ID must be a non-empty string.`);
        return;
      }

      if (localSet.has(itemId)) {
        error(`${itemContext}: duplicate entry ID "${itemId}" within space file.`);
      } else {
        localSet.add(itemId);
      }

      if (!entryIdSet.has(itemId)) {
        error(`${itemContext}: unknown entry ID "${itemId}".`);
      }

      const spaces = idToSpaces.get(itemId) ?? [];
      spaces.push(spaceCode);
      idToSpaces.set(itemId, spaces);
    });
  }

  for (const [entryId, spaceCodes] of idToSpaces.entries()) {
    if (spaceCodes.length > 1) {
      error(
        `Entry "${entryId}" is assigned to multiple spaces: ${spaceCodes
          .map((code) => String(code))
          .join(", ")}.`
      );
    }
  }
}

function printReport(entryCount, spaceCount) {
  warnings.forEach((message) => {
    console.warn(`WARN  ${message}`);
  });
  errors.forEach((message) => {
    console.error(`ERROR ${message}`);
  });

  if (errors.length > 0) {
    console.error(
      `Validation failed with ${errors.length} error(s) and ${warnings.length} warning(s).`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Validation passed for ${entryCount} entries and ${spaceCount} space files.`);
  if (warnings.length > 0) {
    console.log(`Completed with ${warnings.length} warning(s).`);
  }
}

async function main() {
  const entryIds = await loadEntries();
  const spaceDefs = await loadSpaceIndex();
  await validateSpaces(entryIds, spaceDefs);
  printReport(entryIds.size, spaceDefs.length);
}

main().catch((runtimeError) => {
  console.error(`ERROR Unexpected validator failure: ${runtimeError.message}`);
  process.exitCode = 1;
});

