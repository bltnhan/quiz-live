import { TOPICS, TERM_BANKS, STOPWORDS } from "./wordbanks";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function splitSentences(message) {
  return message
    .split(/(?<=[.!?\n])|(?<=[;])/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 10 && s.split(/\s+/).length >= 3);
}

function cleanToken(tok) {
  return tok.replace(/[^\p{L}\p{N}]+/gu, "").trim();
}

// Pull candidate keywords (with their original casing) out of a sentence,
// longest / most "term-like" first.
function extractKeywords(sentence) {
  const rawTokens = sentence.split(/\s+/);
  const candidates = [];
  for (const raw of rawTokens) {
    const clean = cleanToken(raw);
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (clean.length < 4) continue;
    if (STOPWORDS.has(lower)) continue;
    if (/^\d+$/.test(clean)) continue;
    candidates.push(clean);
  }
  // De-dupe (case-insensitive) while keeping order, prefer longer words first
  const seen = new Set();
  const unique = [];
  for (const c of [...candidates].sort((a, b) => b.length - a.length)) {
    const lower = c.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    unique.push(c);
  }
  return unique;
}

function blankSentence(sentence, keyword) {
  const re = new RegExp(
    keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "i"
  );
  return sentence.replace(re, "_____");
}

// A message-derived candidate only makes a decent multiple-choice
// distractor if it looks like an actual term (has an uppercase letter,
// e.g. "PivotTable"/"VLOOKUP") rather than a stray syllable picked up by
// naive whitespace tokenization (Vietnamese words are written as
// space-separated syllables, so plain tokenizing can yield fragments like
// "liệu" out of "dữ liệu"). Those fragments are fine as *correct* answers
// when they're the longest/most prominent word in a sentence, but make
// confusing wrong options, so we keep them out of the distractor pool.
function looksLikeTerm(word) {
  if (word.length < 4) return false;
  // Detect "has an uppercase letter" in a way that's actually correct for
  // Vietnamese: Unicode code-point ranges like A-Z or À-Ỵ do NOT cleanly
  // separate upper/lowercase Vietnamese diacritic letters (they're
  // interleaved by code point), so a regex range like [A-ZÀ-Ỵ] ends up
  // matching plenty of lowercase letters too (e.g. "ế", "ồ"). Comparing a
  // character against its own case transforms is locale-correct instead.
  for (const ch of word) {
    if (ch !== ch.toLowerCase() && ch === ch.toUpperCase()) {
      return true;
    }
  }
  return false;
}

function pickDistractors(correct, pool, topicId, count) {
  const correctLower = correct.toLowerCase();
  const used = new Set([correctLower]);
  const result = [];

  // Prefer the curated topic word bank first — these always read as
  // plausible, professional wrong answers.
  const bank = shuffle(TERM_BANKS[topicId] || []);
  for (const w of bank) {
    const l = w.toLowerCase();
    if (used.has(l)) continue;
    used.add(l);
    result.push(w);
    if (result.length >= count) break;
  }

  // Fall back to other message keywords (only "term-like" ones) if the
  // word bank couldn't fill every slot.
  if (result.length < count) {
    const shuffledPool = shuffle(pool.filter(looksLikeTerm));
    for (const w of shuffledPool) {
      const l = w.toLowerCase();
      if (used.has(l)) continue;
      used.add(l);
      result.push(w);
      if (result.length >= count) break;
    }
  }

  // Last resort: any remaining message keyword, term-like or not.
  if (result.length < count) {
    const shuffledPool = shuffle(pool);
    for (const w of shuffledPool) {
      const l = w.toLowerCase();
      if (used.has(l)) continue;
      used.add(l);
      result.push(w);
      if (result.length >= count) break;
    }
  }

  return result.slice(0, count);
}

/**
 * Build 5 multiple-choice "fill in the blank" questions out of a host
 * supplied message for a given round topic. The correct answer to every
 * question is a keyword taken directly from the message itself, so the
 * message the host reads out is literally the answer key.
 */
export function generateQuestions(topicId, message) {
  const topic = TOPICS[topicId] || "Chủ đề";
  const cleanMessage = (message || "").trim();
  const sentences = splitSentences(cleanMessage);

  // Collect a global keyword pool across the whole message for distractors.
  const globalKeywords = [];
  const perSentenceKeywords = sentences.map((s) => {
    const kws = extractKeywords(s);
    globalKeywords.push(...kws);
    return kws;
  });

  const questions = [];
  const usedAnswers = new Set();
  const usedSentenceKeywordPairs = new Set();

  function findNextKeyword(sIdx, requireTermLike) {
    const kws = perSentenceKeywords[sIdx];
    return kws.find((k) => {
      const key = sIdx + "::" + k.toLowerCase();
      if (usedSentenceKeywordPairs.has(key)) return false;
      if (usedAnswers.has(k.toLowerCase())) return false;
      if (requireTermLike && !looksLikeTerm(k)) return false;
      return true;
    });
  }

  // Two passes over the sentences: first only accept keywords that look
  // like real terms/proper nouns (e.g. "PivotTable", "VLOOKUP") so the
  // *correct* answer is always a sensible word, not a stray syllable from
  // naive whitespace tokenization of Vietnamese prose. Only if that isn't
  // enough to reach 5 questions do we fall back to any extracted keyword.
  for (const requireTermLike of [true, false]) {
    if (questions.length >= 5) break;
    let guard = 0;
    let sentenceIdx = 0;
    while (questions.length < 5 && guard < 200 && sentences.length > 0) {
      guard++;
      const sIdx = sentenceIdx % sentences.length;
      sentenceIdx++;
      if (sentenceIdx > sentences.length * 3) break; // exhausted this pass
      const sentence = sentences[sIdx];
      const nextKw = findNextKeyword(sIdx, requireTermLike);
      if (!nextKw) continue;

      const key = sIdx + "::" + nextKw.toLowerCase();
      usedSentenceKeywordPairs.add(key);
      usedAnswers.add(nextKw.toLowerCase());

      const distractorPool = globalKeywords.filter(
        (w) => w.toLowerCase() !== nextKw.toLowerCase()
      );
      const distractors = pickDistractors(nextKw, distractorPool, topicId, 3);
      while (distractors.length < 3) {
        // extremely short message fallback safety net
        const bankPick = TERM_BANKS[topicId][
          Math.floor(Math.random() * TERM_BANKS[topicId].length)
        ];
        if (
          bankPick.toLowerCase() !== nextKw.toLowerCase() &&
          !distractors.some((d) => d.toLowerCase() === bankPick.toLowerCase())
        ) {
          distractors.push(bankPick);
        }
      }

      const options = shuffle([nextKw, ...distractors]);
      const correctIndex = options.findIndex(
        (o) => o.toLowerCase() === nextKw.toLowerCase()
      );

      questions.push({
        id: `q${questions.length + 1}`,
        prompt: `[${topic}] Điền từ/cụm từ còn thiếu trong thông điệp:`,
        text: blankSentence(sentence, nextKw),
        options,
        correctIndex,
      });
    }
  }

  // Absolute fallback: if the host typed something too short/empty to build
  // any sentence-based question from, generate generic "which term belongs
  // to this topic" questions from the topic word bank so the round can
  // still run.
  if (questions.length < 5) {
    const bank = shuffle(TERM_BANKS[topicId] || []);
    let bIdx = 0;
    while (questions.length < 5 && bIdx < bank.length) {
      const correct = bank[bIdx++];
      if (usedAnswers.has(correct.toLowerCase())) continue;
      usedAnswers.add(correct.toLowerCase());
      const distractors = pickDistractors(
        correct,
        bank.filter((w) => w !== correct),
        topicId,
        3
      );
      const options = shuffle([correct, ...distractors]);
      const correctIndex = options.findIndex(
        (o) => o.toLowerCase() === correct.toLowerCase()
      );
      questions.push({
        id: `q${questions.length + 1}`,
        prompt: `[${topic}] Thuật ngữ nào sau đây liên quan đến chủ đề "${topic}"?`,
        text: cleanMessage
          ? cleanMessage
          : `Chủ đề vòng này là "${topic}". Hãy chọn thuật ngữ đúng.`,
        options,
        correctIndex,
      });
    }
  }

  return questions.slice(0, 5);
}

export function sanitizeQuestionForPlayer(question) {
  if (!question) return null;
  const { correctIndex, ...rest } = question;
  return rest;
}
