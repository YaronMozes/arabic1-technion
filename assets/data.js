export function getParam(name){
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

export async function loadEntriesNdjson(path){
  const txt = await fetch(path).then(r => {
    if(!r.ok) throw new Error(`Failed to load ${path}`);
    return r.text();
  });
  const lines = txt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const entries = [];
  for(const line of lines){
    try{ entries.push(JSON.parse(line)); } catch(e){ console.warn("Bad JSON line", line); }
  }
  return entries;
}

export async function loadJson(path){
  const r = await fetch(path);
  if(!r.ok) throw new Error(`Failed to load ${path}`);
  return r.json();
}

/** Arabic diacritics / tashkīl removal for "plain" matching */
export function stripArabicDiacritics(s){
  if(!s) return s;
  // Covers common harakat + Quranic marks
  return s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
}

/** Hebrew niqqud removal (optional) */
export function stripHebrewNiqqud(s){
  if(!s) return s;
  return s.replace(/[\u0591-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C5\u05C7]/g, "");
}

export function normSpaces(s){
  return (s ?? "").toString().trim().replace(/\s+/g, " ");
}

export function normalizeArabicForCompare(s){
  return normSpaces(stripArabicDiacritics(s))
    .replace(/[ـ]/g,"")   // tatweel
    .replace(/[“”"]/g,"")
    .replace(/[’']/g,"");
}

export function normalizeHebrewForCompare(s){
  return normSpaces(stripHebrewNiqqud(s))
    .replace(/[״"׳']/g,"");
}

export function pickRandom(arr){
  return arr[Math.floor(Math.random()*arr.length)];
}

export function shuffle(arr){
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
