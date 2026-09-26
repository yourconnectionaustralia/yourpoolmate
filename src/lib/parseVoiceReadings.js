// Spoken water-test parser for the Web Speech API spike.
// Turns a transcript into the same reading keys the manual form and
// the OCR scanner already use. Empty fields stay null so the Health
// Score skips them. No audio is handled here.

export const VOICE_FIELDS = [
  { app: 'freeChlor',       label: 'Free chlorine',    unit: 'ppm' },
  { app: 'pH',              label: 'pH',               unit: '' },
  { app: 'alkalinity',      label: 'Total alkalinity', unit: 'ppm' },
  { app: 'cyanuricAcid',    label: 'Cyanuric acid',    unit: 'ppm' },
  { app: 'calciumHardness', label: 'Calcium hardness', unit: 'ppm' },
  { app: 'salt',            label: 'Salt',             unit: 'ppm' },
];

const FIELD_PATTERNS = [
  { key: 'freeChlor',       phrases: ['free chlorine', 'free chlor', 'chlorine', 'fc'] },
  { key: 'pH',              phrases: ['ph'] },
  { key: 'alkalinity',      phrases: ['total alkalinity', 'alkalinity', 'alk', 'ta'] },
  { key: 'cyanuricAcid',    phrases: ['cyanuric acid', 'cyanuric', 'stabiliser', 'stabilizer', 'conditioner', 'cya'] },
  { key: 'calciumHardness', phrases: ['calcium hardness', 'calcium', 'hardness', 'ch'] },
  { key: 'salt',            phrases: ['salinity', 'salt'] },
];

const FILLERS = new Set([
  'is', 'at', 'of', 'reads', 'reading', 'was', 'equals', 'equal',
  'about', 'around', 'roughly', 'its', 'sits', 'sitting', 'the', 'a', 'an',
  'be', 'been', 'on', 'currently', 'level', 'levels', 'value', 'values',
  'came', 'in', 'out', 'as', 'my', 'our', 'now', 'today', 'just', 'really',
  'and', 'ppm', 'ppb',
]);

const UNITS = {
  zero: 0, oh: 0, nought: 0, naught: 0,
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const DECIMAL_DIGIT = {
  zero: 0, oh: 0, nought: 0, naught: 0,
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9,
};

function isNumberWord(token) {
  return UNITS[token] != null || TENS[token] != null
    || token === 'hundred' || token === 'thousand'
    || /^\d+$/.test(token);
}

export function tokenize(text) {
  let s = String(text || '').toLowerCase();
  s = s.replace(/\bp\s*\.?\s*h\b/g, 'ph');
  s = s.replace(/(\d)\s*\.\s*(\d)/g, '$1.$2');
  s = s.replace(/[^a-z0-9.\s]/g, ' ');
  s = s.replace(/\.(?!\d)/g, ' ');
  s = s.replace(/(?<!\d)\./g, ' ');
  const tokens = s.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    const besidePoint = prev === 'point' || next === 'point' || prev === 'decimal' || next === 'decimal';
    if (!besidePoint) continue;
    if (tokens[i] === 'to' || tokens[i] === 'too') tokens[i] = 'two';
    else if (tokens[i] === 'for' || tokens[i] === 'fore') tokens[i] = 'four';
  }
  return tokens;
}

function readFraction(tokens, start) {
  let i = start;
  let digits = '';
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^\d+$/.test(t)) {
      digits += t;
      i++;
      if (t.length > 1) break;
      continue;
    }
    if (DECIMAL_DIGIT[t] != null) {
      digits += String(DECIMAL_DIGIT[t]);
      i++;
      continue;
    }
    break;
  }
  if (!digits) return null;
  return { digits, next: i };
}

function parseInteger(tokens, start) {
  let i = start;
  let total = 0;
  let current = null;
  let seen = false;
  let last = null;

  while (i < tokens.length) {
    let t = tokens[i];

    if (t === 'and') {
      if (!seen) break;
      const nxt = tokens[i + 1];
      if ((nxt === 'a' || nxt === 'an') && tokens[i + 2] === 'half') break;
      const nxtIsArticleScale = (nxt === 'a' || nxt === 'an')
        && (tokens[i + 2] === 'hundred' || tokens[i + 2] === 'thousand');
      if (isNumberWord(nxt) || nxtIsArticleScale) {
        i++;
        continue;
      }
      break;
    }

    if ((t === 'a' || t === 'an') && (tokens[i + 1] === 'hundred' || tokens[i + 1] === 'thousand')) {
      t = 'one';
    } else if (t === 'a' || t === 'an') {
      break;
    }

    if (/^\d+$/.test(t)) {
      const n = parseInt(t, 10);
      if (!seen && tokens[i + 1] !== 'hundred' && tokens[i + 1] !== 'thousand') {
        return { value: n, next: i + 1 };
      }
      if (current == null) current = n;
      else if (last === 'hundred' && current % 100 === 0 && n < 100) current += n;
      else break;
      seen = true;
      last = n < 10 ? 'unit' : 'digit';
      i++;
      continue;
    }

    if (TENS[t] != null) {
      if (current == null) current = TENS[t];
      else if (last === 'unit' && current > 0 && current < 10) current = current * 100 + TENS[t];
      else if (last === 'hundred' && current % 100 === 0) current += TENS[t];
      else break;
      seen = true;
      last = 'tens';
      i++;
      continue;
    }

    if (UNITS[t] != null) {
      const n = UNITS[t];
      if (current == null) current = n;
      else if (last === 'tens' && n < 10) current += n;
      else if (last === 'hundred' && current % 100 === 0) current += n;
      else break;
      seen = true;
      last = n >= 10 ? 'teen' : 'unit';
      i++;
      continue;
    }

    if (t === 'hundred') {
      if (current != null && current >= 100) break;
      current = (current == null ? 1 : current) * 100;
      seen = true;
      last = 'hundred';
      i++;
      continue;
    }

    if (t === 'thousand') {
      total += (current == null ? 1 : current) * 1000;
      current = null;
      seen = true;
      last = 'thousand';
      i++;
      continue;
    }

    break;
  }

  if (!seen) return null;
  return { value: total + (current == null ? 0 : current), next: i };
}

function parseSpokenNumber(tokens, start) {
  if (start >= tokens.length) return null;
  const tok = tokens[start];
  if (/^\d+\.\d+$/.test(tok)) return { value: parseFloat(tok), next: start + 1 };

  if (tok === 'point' || tok === 'decimal') {
    const frac = readFraction(tokens, start + 1);
    if (!frac) return null;
    return { value: parseFloat(`0.${frac.digits}`), next: frac.next };
  }

  const intPart = parseInteger(tokens, start);
  if (!intPart) return null;
  let i = intPart.next;
  if (tokens[i] === 'point' || tokens[i] === 'decimal') {
    const frac = readFraction(tokens, i + 1);
    if (frac) return { value: parseFloat(`${intPart.value}.${frac.digits}`), next: frac.next };
  }
  if (tokens[i] === 'and' && (tokens[i + 1] === 'a' || tokens[i + 1] === 'an') && tokens[i + 2] === 'half') {
    return { value: intPart.value + 0.5, next: i + 3 };
  }
  return { value: intPart.value, next: i };
}

function findLabels(tokens) {
  const hits = [];
  for (let i = 0; i < tokens.length; i++) {
    for (const field of FIELD_PATTERNS) {
      for (const phrase of field.phrases) {
        const parts = phrase.split(' ');
        if (i + parts.length > tokens.length) continue;
        let match = true;
        for (let k = 0; k < parts.length; k++) {
          if (tokens[i + k] !== parts[k]) { match = false; break; }
        }
        if (!match) continue;
        if (field.key === 'freeChlor') {
          const prev = tokens[i - 1];
          if (prev === 'total' || prev === 'combined') continue;
        }
        hits.push({ key: field.key, start: i, end: i + parts.length, len: parts.length });
        break;
      }
    }
  }

  hits.sort((a, b) => b.len - a.len || a.start - b.start);
  const taken = new Array(tokens.length).fill(false);
  const chosen = [];
  for (const hit of hits) {
    let overlap = false;
    for (let i = hit.start; i < hit.end; i++) if (taken[i]) overlap = true;
    if (overlap) continue;
    for (let i = hit.start; i < hit.end; i++) taken[i] = true;
    chosen.push(hit);
  }
  chosen.sort((a, b) => a.start - b.start);
  return chosen;
}

function readNumberAfter(tokens, from, limit) {
  let j = from;
  let skipped = 0;
  while (j < limit && skipped < 4 && FILLERS.has(tokens[j])) {
    j++;
    skipped++;
  }
  if (j >= limit) return null;
  const num = parseSpokenNumber(tokens, j);
  if (!num || num.next > limit) return null;
  return num;
}

export function emptyReadings() {
  return {
    freeChlor: null,
    pH: null,
    alkalinity: null,
    cyanuricAcid: null,
    calciumHardness: null,
    salt: null,
  };
}

export function parseVoiceReadings(transcript) {
  const result = emptyReadings();
  const tokens = tokenize(transcript);
  const labels = findLabels(tokens);
  for (let n = 0; n < labels.length; n++) {
    const label = labels[n];
    const limit = labels[n + 1]?.start ?? tokens.length;
    const num = readNumberAfter(tokens, label.end, limit);
    if (num && Number.isFinite(num.value)) result[label.key] = num.value;
  }
  return result;
}

export function blankVoiceForm() {
  return Object.fromEntries(VOICE_FIELDS.map((f) => [f.app, '']));
}

function formatReading(n) {
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

export function formValuesFromTranscript(transcript) {
  const parsed = parseVoiceReadings(transcript);
  const values = blankVoiceForm();
  for (const field of VOICE_FIELDS) {
    const n = parsed[field.app];
    if (n != null && Number.isFinite(n)) values[field.app] = formatReading(n);
  }
  return values;
}

// Same shape WaterTestScanner hands to onComplete, minus createdAt
// (the caller stamps the time). Salt is omitted when the field is blank
// so an unheard salt reading is "not tested", not zero.
export function voiceReadingsFromForm(values) {
  const num = (s) => {
    const n = parseFloat(String(s ?? '').trim());
    return Number.isFinite(n) ? n : null;
  };
  const result = {
    freeChlor: num(values?.freeChlor),
    pH: num(values?.pH),
    alkalinity: num(values?.alkalinity),
    cyanuricAcid: num(values?.cyanuricAcid),
    calciumHardness: num(values?.calciumHardness),
    source: 'voice',
  };
  const saltRaw = String(values?.salt ?? '').trim();
  if (saltRaw !== '') result.salt = num(saltRaw);
  return result;
}
