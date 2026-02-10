import { getParam, loadEntriesNdjson, loadJson, pickRandom, shuffle } from "./data.js";

function byId(id){ return document.getElementById(id); }

function renderLessonCards(){
  const grid = byId("lessons-grid");
  if(!grid) return;
  for(let i=1;i<=13;i++){
    const l = String(i).padStart(2,"0");
    const a = document.createElement("a");
    a.className = "card";
    a.href = `lesson.html?l=${l}`;
    a.innerHTML = `<h3>Lesson ${i}</h3><p>Vocabulary + games</p>`;
    grid.appendChild(a);
  }
}

async function loadLessonSet(l){
  const lesson = await loadJson(`data/lessons/${l}.json`);
  const entries = await loadEntriesNdjson("data/entries.ndjson");
  const map = new Map(entries.map(e => [e.id, e]));
  const items = (lesson.items || []).map(id => map.get(id)).filter(Boolean);
  return { lesson, entries, items };
}

function fmtHe(he){
  if(Array.isArray(he)) return he.join(" / ");
  return he ?? "";
}

function fmtTr(entry){
  const tr = entry.translit || entry.tr || {};
  const latin = tr.latin || "";
  const he = tr.he || "";
  if(latin && he) return `${latin} • ${he}`;
  return latin || he || "";
}

function entryArabic(entry){
  const ar = entry.ar || {};
  return ar.vocalized || ar.v || ar.plain || ar.p || "";
}

async function initLessonPage(){
  const l = getParam("l");
  if(!l) return;
  byId("lesson-title").textContent = `Lesson ${parseInt(l,10)}`;

  const { items } = await loadLessonSet(l);

  if(items.length === 0){
    byId("lesson-empty").style.display = "block";
    byId("lesson-table-wrap").style.display = "none";
  }else{
    byId("lesson-empty").style.display = "none";
    byId("lesson-table-wrap").style.display = "block";
  }

  const tbody = byId("lesson-tbody");
  tbody.innerHTML = "";
  for(const e of items){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="rtl ar">${entryArabic(e)}</td>
      <td class="rtl">${fmtHe(e.he)}</td>
      <td class="ltr muted">${fmtTr(e)}</td>
    `;
    tbody.appendChild(tr);
  }

  byId("btn-flashcards").href = `game.html?l=${l}&mode=flashcards`;
  byId("btn-quiz").href = `game.html?l=${l}&mode=quiz`;
}

function storageKey(prefix, l){ return `a1:${prefix}:${l}`; }

async function initGamePage(){
  const l = getParam("l");
  const mode = getParam("mode") || "flashcards";
  if(!l) return;

  const { items } = await loadLessonSet(l);
  byId("game-title").textContent = `Lesson ${parseInt(l,10)} • ${mode}`;
  if(items.length === 0){
    byId("game-wrap").innerHTML = `<div class="notice">This lesson has no words yet. Add IDs to <span class="kbd">data/lessons/${l}.json</span>.</div>`;
    return;
  }

  if(mode === "flashcards") runFlashcards(l, items);
  else runQuiz(l, items);
}

function runFlashcards(l, items){
  const wrap = byId("game-wrap");
  const state = {
    idx: 0,
    flipped: false,
    known: JSON.parse(localStorage.getItem(storageKey("known", l)) || "[]")
  };
  const knownSet = new Set(state.known);

  const card = document.createElement("div");
  card.className = "card bigcard";
  card.style.cursor = "pointer";

  const controls = document.createElement("div");
  controls.className = "row";
  controls.innerHTML = `
    <button class="btn" id="prev">← Prev</button>
    <button class="btn" id="flip">Flip</button>
    <button class="btn" id="next">Next →</button>
    <span class="pill" id="progress"></span>
  `;

  const markRow = document.createElement("div");
  markRow.className = "row";
  markRow.innerHTML = `
    <button class="btn good" id="mark-known">Mark Known</button>
    <button class="btn bad" id="unmark-known">Unmark</button>
    <span class="pill" id="known-count"></span>
  `;

  wrap.appendChild(card);
  wrap.appendChild(controls);
  wrap.appendChild(markRow);

  function fmtHe(he){ return Array.isArray(he) ? he.join(" / ") : (he ?? ""); }
  function fmtTr(entry){
    const tr = entry.translit || entry.tr || {};
    return tr.latin || tr.he || "";
  }
  function entryArabic(entry){
    const ar = entry.ar || {};
    return ar.vocalized || ar.v || ar.plain || ar.p || "";
  }

  function render(){
    const e = items[state.idx];
    const front = entryArabic(e);
    const back = `
      <div class="rtl">${fmtHe(e.he)}</div>
      <div class="ltr muted" style="margin-top:6px">${fmtTr(e)}</div>
    `;
    card.innerHTML = state.flipped
      ? `<div class="back">${back}</div>`
      : `<div class="front rtl">${front}</div>`;

    byId("progress").textContent = `${state.idx+1} / ${items.length}`;
    byId("known-count").textContent = `Known: ${knownSet.size}`;

    if(knownSet.has(e.id)) card.style.borderColor = "rgba(65,209,155,.6)";
    else card.style.borderColor = "";
  }

  function saveKnown(){
    localStorage.setItem(storageKey("known", l), JSON.stringify([...knownSet]));
  }

  card.addEventListener("click", () => { state.flipped = !state.flipped; render(); });
  controls.querySelector("#flip").addEventListener("click", () => { state.flipped = !state.flipped; render(); });
  controls.querySelector("#prev").addEventListener("click", () => { state.idx = (state.idx - 1 + items.length) % items.length; state.flipped = false; render(); });
  controls.querySelector("#next").addEventListener("click", () => { state.idx = (state.idx + 1) % items.length; state.flipped = false; render(); });

  markRow.querySelector("#mark-known").addEventListener("click", () => { knownSet.add(items[state.idx].id); saveKnown(); render(); });
  markRow.querySelector("#unmark-known").addEventListener("click", () => { knownSet.delete(items[state.idx].id); saveKnown(); render(); });

  window.addEventListener("keydown", (e) => {
    if(e.key === "ArrowRight"){ controls.querySelector("#next").click(); }
    if(e.key === "ArrowLeft"){ controls.querySelector("#prev").click(); }
    if(e.key === " "){ e.preventDefault(); controls.querySelector("#flip").click(); }
  });

  render();
}

function runQuiz(l, items){
  const wrap = byId("game-wrap");
  const state = { score: 0, streak: 0, total: 0, current: null, locked: false };

  const top = document.createElement("div");
  top.className = "row";
  top.innerHTML = `
    <span class="pill" id="score"></span>
    <button class="btn" id="nextq" type="button">Next question</button>
    <a class="btn" href="lesson.html?l=${l}">Back to lesson</a>
  `;

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div id="prompt" class="rtl ar" style="text-align:center;font-size:34px;margin:8px 0 4px"></div>
    <div class="muted" style="text-align:center">Pick the correct meaning</div>
    <div id="choices" class="choicegrid"></div>
    <div id="feedback" class="muted" style="margin-top:10px;text-align:center"></div>
  `;

  wrap.appendChild(top);
  wrap.appendChild(card);

  function fmtHe(he){ return Array.isArray(he) ? he.join(" / ") : (he ?? ""); }
  function entryArabic(entry){
    const ar = entry.ar || {};
    return ar.vocalized || ar.v || ar.plain || ar.p || "";
  }

  function updateScore(){
    byId("score").textContent = `Score: ${state.score} • Streak: ${state.streak} • Q: ${state.total}`;
  }

  function makeQuestion(){
    state.locked = false;
    state.total += 1;

    const answer = pickRandom(items);
    const distractors = shuffle(items.filter(x => x.id !== answer.id)).slice(0,3);
    const options = shuffle([answer, ...distractors]);

    state.current = { answer, options };

    byId("prompt").textContent = entryArabic(answer);
    const choices = byId("choices");
    choices.innerHTML = "";
    for(const opt of options){
      const b = document.createElement("div");
      b.className = "choice rtl";
      b.textContent = fmtHe(opt.he);
      b.addEventListener("click", () => onPick(b, opt));
      choices.appendChild(b);
    }
    byId("feedback").textContent = "";
    updateScore();
  }

  function onPick(el, picked){
    if(state.locked) return;
    state.locked = true;
    const { answer } = state.current;
    const correct = picked.id === answer.id;

    if(correct){
      el.classList.add("correct");
      state.score += 1;
      state.streak += 1;
      byId("feedback").textContent = "✅ Correct";
    }else{
      el.classList.add("wrong");
      state.streak = 0;
      const choices = [...byId("choices").children];
      for(const c of choices){
        if(c.textContent === fmtHe(answer.he)){
          c.classList.add("correct");
        }
      }
      byId("feedback").textContent = `❌ Correct answer: ${fmtHe(answer.he)}`;

      const missKey = storageKey("missed", l);
      const prev = new Set(JSON.parse(localStorage.getItem(missKey) || "[]"));
      prev.add(answer.id);
      localStorage.setItem(missKey, JSON.stringify([...prev]));
    }
    updateScore();
  }

  top.querySelector("#nextq").addEventListener("click", makeQuestion);
  makeQuestion();
}

async function initTestPage(){
  const form = byId("test-form");
  if(!form) return;

  const box = byId("lesson-checks");
  for(let i=1;i<=13;i++){
    const l = String(i).padStart(2,"0");
    const label = document.createElement("label");
    label.style.display = "inline-flex";
    label.style.alignItems = "center";
    label.style.gap = "8px";
    label.style.margin = "6px 12px 6px 0";
    label.innerHTML = `<input type="checkbox" name="lesson" value="${l}" checked /> Lesson ${i}`;
    box.appendChild(label);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const mode = form.querySelector('input[name="mode"]:checked').value;
    const chosen = [...form.querySelectorAll('input[name="lesson"]:checked')].map(x => x.value);
    if(chosen.length === 0){
      alert("Pick at least one lesson.");
      return;
    }

    const entries = await loadEntriesNdjson("data/entries.ndjson");
    const map = new Map(entries.map(e => [e.id, e]));

    const allItems = [];
    for(const l of chosen){
      const lesson = await loadJson(`data/lessons/${l}.json`);
      for(const id of (lesson.items || [])){
        const ent = map.get(id);
        if(ent) allItems.push(ent);
      }
    }

    if(allItems.length === 0){
      alert("Those lessons are empty right now. Add IDs in the lesson JSON files.");
      return;
    }

    const packId = `pack-${Date.now()}`;
    sessionStorage.setItem(packId, JSON.stringify({ items: allItems }));
    window.location.href = `test-run.html?pack=${encodeURIComponent(packId)}&mode=${encodeURIComponent(mode)}`;
  });
}

async function initTestRunPage(){
  const packId = getParam("pack");
  const mode = getParam("mode") || "quiz";
  if(!packId) return;

  const payload = sessionStorage.getItem(packId);
  if(!payload){
    byId("run-wrap").innerHTML = `<div class="notice">Pack not found (maybe you refreshed). Go back to Test Center and start again.</div>`;
    return;
  }
  const { items } = JSON.parse(payload);
  byId("run-title").textContent = `Test Center • ${mode} • ${items.length} items`;

  // Reuse the same game renderers by mounting into the existing page
  const gameWrap = document.createElement("div");
  gameWrap.id = "game-wrap";
  byId("run-wrap").appendChild(gameWrap);

  if(mode === "quiz") runQuiz("test", items);
  else runFlashcards("test", items);
}

document.addEventListener("DOMContentLoaded", () => {
  renderLessonCards();
  initLessonPage().catch(console.error);
  initGamePage().catch(console.error);
  initTestPage().catch(console.error);
  initTestRunPage().catch(console.error);
});
