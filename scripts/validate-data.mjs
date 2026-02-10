import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const ENTRIES_PATH = path.join(ROOT, "data", "entries.ndjson");
const LESSONS_DIR = path.join(ROOT, "data", "lessons");
const LESSON_INDEX_PATH = path.join(LESSONS_DIR, "index.json");

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

function normalizeLessonCode(lessonNumber) {
  if (!Number.isInteger(lessonNumber) || lessonNumber < 1) {
    return "";
  }
  return String(lessonNumber).padStart(2, "0");
}

function stripArabicDiacritics(value) {
  return value
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/ـ/g, "");
}

function hasArabicDiacritics(value) {
  return /[\u064B-\u065F\u0670\u06D6-\u06ED]/.test(value);
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
  const context = `entries.ndjson line ${lineNumber}`;
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

    if (isNonEmptyString(plain) && hasArabicDiacritics(plain)) {
      error(`${context}: "ar.plain" must not contain Arabic diacritics.`);
    }

    if (isNonEmptyString(vocalized) && isNonEmptyString(plain)) {
      const stripped = normalizeSpaces(stripArabicDiacritics(vocalized));
      const normalizedPlain = normalizeSpaces(plain);
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
      error(`entries.ndjson line ${index + 1}: invalid JSON (${parseError.message}).`);
    }
  });

  return entryIdSet;
}

async function loadLessonIndex() {
  const context = "data/lessons/index.json";
  const payload = await readJsonFile(LESSON_INDEX_PATH, context);
  if (!payload) {
    return [];
  }

  if (!isPlainObject(payload)) {
    error(`${context}: root must be a JSON object.`);
    return [];
  }

  if (!Array.isArray(payload.lessons)) {
    error(`${context}: "lessons" must be an array.`);
    return [];
  }

  if (payload.lessons.length === 0) {
    error(`${context}: "lessons" must include at least one lesson.`);
    return [];
  }

  const seenCodes = new Set();
  const seenNumbers = new Set();
  const lessons = [];

  payload.lessons.forEach((row, index) => {
    const itemContext = `${context} lessons[${index}]`;
    if (!isPlainObject(row)) {
      error(`${itemContext}: lesson row must be an object.`);
      return;
    }

    const lessonNumber = Number.parseInt(String(row.lesson ?? ""), 10);
    if (!Number.isInteger(lessonNumber) || lessonNumber < 1) {
      error(`${itemContext}: "lesson" must be a positive integer.`);
      return;
    }

    const expectedCode = normalizeLessonCode(lessonNumber);
    const code = isNonEmptyString(row.code) ? row.code.trim() : expectedCode;
    if (!isNonEmptyString(row.code)) {
      error(`${itemContext}: "code" must be a non-empty string.`);
    } else if (code !== expectedCode) {
      error(`${itemContext}: "code" must be "${expectedCode}" for lesson ${lessonNumber}.`);
    }

    if (!isNonEmptyString(row.title)) {
      error(`${itemContext}: "title" must be a non-empty string.`);
    }
    const title = isNonEmptyString(row.title) ? row.title.trim() : `שיעור ${lessonNumber}`;

    if (seenCodes.has(code)) {
      error(`${itemContext}: duplicate lesson code "${code}".`);
    } else {
      seenCodes.add(code);
    }

    if (seenNumbers.has(lessonNumber)) {
      error(`${itemContext}: duplicate lesson number "${lessonNumber}".`);
    } else {
      seenNumbers.add(lessonNumber);
    }

    lessons.push({
      code,
      lesson: lessonNumber,
      title
    });
  });

  const sortedLessonNumbers = lessons.map((row) => row.lesson).sort((a, b) => a - b);
  for (let index = 0; index < sortedLessonNumbers.length; index += 1) {
    const expected = index + 1;
    if (sortedLessonNumbers[index] !== expected) {
      warn(
        `${context}: lesson numbers are not sequential from 1 (missing or out of order around ${expected}).`
      );
      break;
    }
  }

  return lessons;
}

async function validateLessons(entryIdSet, lessonDefs) {
  if (lessonDefs.length === 0) {
    error("No lessons were loaded from data/lessons/index.json.");
    return;
  }

  let lessonFiles = [];
  try {
    lessonFiles = await fs.readdir(LESSONS_DIR);
  } catch (readError) {
    error(`Cannot read ${path.relative(ROOT, LESSONS_DIR)}: ${readError.message}`);
    return;
  }

  const expectedFileNames = new Set(lessonDefs.map((row) => `${row.code}.json`));

  lessonDefs.forEach((row) => {
    const fileName = `${row.code}.json`;
    if (!lessonFiles.includes(fileName)) {
      error(`Missing required lesson file: data/lessons/${fileName}`);
    }
  });

  lessonFiles
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .forEach((fileName) => {
      if (fileName === "index.json") {
        return;
      }
      if (!expectedFileNames.has(fileName)) {
        warn(`Unexpected lesson file present: data/lessons/${fileName}`);
      }
    });

  const idToLessons = new Map();

  for (const lessonDef of lessonDefs) {
    const lessonCode = lessonDef.code;
    const lessonNumber = lessonDef.lesson;
    const expectedTitle = lessonDef.title;

    const filePath = path.join(LESSONS_DIR, `${lessonCode}.json`);
    const context = `data/lessons/${lessonCode}.json`;
    const lesson = await readJsonFile(filePath, context);
    if (!lesson) {
      continue;
    }

    if (!isPlainObject(lesson)) {
      error(`${context}: root must be a JSON object.`);
      continue;
    }

    if (lesson.lesson !== lessonNumber) {
      error(`${context}: "lesson" must be ${lessonNumber}.`);
    }

    if ("title" in lesson && !isNonEmptyString(lesson.title)) {
      error(`${context}: "title" must be a non-empty string when provided.`);
    }
    if (isNonEmptyString(lesson.title) && lesson.title.trim() !== expectedTitle) {
      warn(
        `${context}: title "${lesson.title.trim()}" differs from lesson index title "${expectedTitle}".`
      );
    }

    if ("title_he" in lesson && !isNonEmptyString(lesson.title_he)) {
      error(`${context}: "title_he" must be a non-empty string when provided.`);
    }

    if (!Array.isArray(lesson.items)) {
      error(`${context}: "items" must be an array.`);
      continue;
    }

    if (lesson.items.length === 0) {
      warn(`${context}: "items" is empty.`);
    }

    const localSet = new Set();
    lesson.items.forEach((itemId, itemIndex) => {
      const itemContext = `${context} items[${itemIndex}]`;
      if (!isNonEmptyString(itemId)) {
        error(`${itemContext}: entry ID must be a non-empty string.`);
        return;
      }

      if (localSet.has(itemId)) {
        error(`${itemContext}: duplicate entry ID "${itemId}" within lesson file.`);
      } else {
        localSet.add(itemId);
      }

      if (!entryIdSet.has(itemId)) {
        error(`${itemContext}: unknown entry ID "${itemId}".`);
      }

      const lessons = idToLessons.get(itemId) ?? [];
      lessons.push(lessonCode);
      idToLessons.set(itemId, lessons);
    });
  }

  for (const [entryId, lessonCodes] of idToLessons.entries()) {
    if (lessonCodes.length > 1) {
      error(
        `Entry "${entryId}" is assigned to multiple lessons: ${lessonCodes
          .map((code) => Number(code))
          .join(", ")}.`
      );
    }
  }
}

function printReport(entryCount, lessonCount) {
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

  console.log(`Validation passed for ${entryCount} entries and ${lessonCount} lesson files.`);
  if (warnings.length > 0) {
    console.log(`Completed with ${warnings.length} warning(s).`);
  }
}

async function main() {
  const entryIds = await loadEntries();
  const lessonDefs = await loadLessonIndex();
  await validateLessons(entryIds, lessonDefs);
  printReport(entryIds.size, lessonDefs.length);
}

main().catch((runtimeError) => {
  console.error(`ERROR Unexpected validator failure: ${runtimeError.message}`);
  process.exitCode = 1;
});
