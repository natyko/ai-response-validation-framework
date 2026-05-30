import type {
  AiResponsePayload,
  GroundingSource,
  ValidationIssue,
  ValidationResult
} from '../types/validation.js';
import { scoreFromIssues } from '../core/scoring.js';

/**
 * GROUNDING VALIDATOR
 * ===================
 *
 * Checks whether an AI response is *grounded* in the authoritative source
 * documents supplied on the payload (`groundingSources`). The goal is to flag
 * responses that introduce substantive claims with NO support in any source —
 * a common failure mode for hallucination in retrieval-augmented systems.
 *
 * WHAT THIS CHECK DOES (and is honest about):
 *  - It is a LEXICAL grounding check. It measures overlap of meaningful content
 *    terms between the response and the source documents.
 *  - It identifies "unsupported content terms": substantive words/numbers in the
 *    response that appear in NONE of the sources. A high proportion of these is a
 *    strong signal the response drifted away from its evidence.
 *  - It pays special attention to NUMERIC claims (doses, percentages, counts),
 *    because fabricated numbers are both common and high-risk in healthcare.
 *
 * WHAT THIS CHECK DOES NOT DO (stated plainly, on purpose):
 *  - It does NOT understand meaning. A response can be lexically grounded yet
 *    semantically wrong (e.g. negation: "is NOT safe" vs source "is safe").
 *  - It does NOT replace human review or a model-based entailment/NLI check.
 *    For production use, pair this with a semantic verifier. This module is the
 *    fast, deterministic, explainable first line of defense.
 *
 * This honest scoping is intentional: a deterministic, auditable check whose
 * limits are documented is more trustworthy in a regulated context than a
 * black-box claim of "hallucination detection".
 */

export interface GroundingOptions {
  /**
   * Minimum proportion (0–1) of substantive response terms that must be found
   * in the sources for the response to be considered adequately grounded.
   * Default 0.5 — at least half of the meaningful terms should be traceable.
   */
  minGroundedRatio: number;
  /**
   * If true, any numeric token in the response that does not appear in the
   * sources is flagged individually as high severity. Default true.
   */
  flagUngroundedNumbers: boolean;
}

const DEFAULT_OPTIONS: GroundingOptions = {
  minGroundedRatio: 0.5,
  flagUngroundedNumbers: true
};

/**
 * Common English function words that carry no grounding signal. Kept small and
 * explicit rather than pulling a heavyweight NLP dependency — predictable and
 * auditable.
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'so', 'as', 'of', 'to',
  'in', 'on', 'at', 'by', 'for', 'with', 'about', 'into', 'from', 'up', 'down',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'do', 'does', 'did',
  'have', 'has', 'had', 'this', 'that', 'these', 'those', 'it', 'its', 'you',
  'your', 'i', 'we', 'they', 'he', 'she', 'them', 'their', 'my', 'me', 'our',
  'can', 'could', 'should', 'would', 'will', 'may', 'might', 'must', 'shall',
  'not', 'no', 'yes', 'any', 'some', 'all', 'each', 'when', 'where', 'how',
  'what', 'which', 'who', 'why', 'there', 'here', 'than', 'too', 'very', 'just',
  'also', 'more', 'most', 'such', 'only', 'own', 'same', 'other'
]);

const NUMERIC_PATTERN = /\d/;

/** Lowercase, strip punctuation, split into tokens. Deterministic & auditable. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.%-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** A "content term" is a non-stopword token of length >= 3, or any numeric token. */
function isContentTerm(token: string): boolean {
  if (NUMERIC_PATTERN.test(token)) return true;
  if (token.length < 3) return false;
  if (STOP_WORDS.has(token)) return false;
  return true;
}

function buildSourceVocabulary(sources: GroundingSource[]): Set<string> {
  const vocab = new Set<string>();
  for (const source of sources) {
    for (const token of tokenize(source.content)) {
      vocab.add(token);
    }
    if (source.title) {
      for (const token of tokenize(source.title)) vocab.add(token);
    }
  }
  return vocab;
}

export function validateGrounding(
  payload: AiResponsePayload,
  options: Partial<GroundingOptions> = {}
): ValidationResult {
  const opts: GroundingOptions = { ...DEFAULT_OPTIONS, ...options };
  const issues: ValidationIssue[] = [];
  const sources = payload.groundingSources ?? [];

  // No sources supplied: this check is not applicable. We do NOT pass silently —
  // we surface that grounding could not be assessed, so a green report never
  // implies grounding was verified when it wasn't.
  if (sources.length === 0) {
    issues.push({
      code: 'GROUNDING_NOT_ASSESSED',
      severity: 'low',
      message:
        'No grounding sources were supplied, so factual grounding could not be assessed. Provide groundingSources to enable this check.'
    });
    return {
      validator: 'grounding-check',
      passed: true, // not a failure — just not applicable; low-severity note only
      score: scoreFromIssues(issues),
      issues
    };
  }

  const vocabulary = buildSourceVocabulary(sources);
  const responseTerms = tokenize(payload.response).filter(isContentTerm);
  const uniqueResponseTerms = Array.from(new Set(responseTerms));

  // Degenerate case: response has no substantive terms to check.
  if (uniqueResponseTerms.length === 0) {
    return {
      validator: 'grounding-check',
      passed: true,
      score: 100,
      issues
    };
  }

  const ungroundedTerms: string[] = [];
  const ungroundedNumbers: string[] = [];

  for (const term of uniqueResponseTerms) {
    if (!vocabulary.has(term)) {
      ungroundedTerms.push(term);
      if (NUMERIC_PATTERN.test(term)) ungroundedNumbers.push(term);
    }
  }

  const groundedCount = uniqueResponseTerms.length - ungroundedTerms.length;
  const groundedRatio = groundedCount / uniqueResponseTerms.length;

  // High-risk: ungrounded numeric claims (fabricated doses/percentages/counts).
  if (opts.flagUngroundedNumbers && ungroundedNumbers.length > 0) {
    issues.push({
      code: 'UNGROUNDED_NUMERIC_CLAIM',
      severity: 'high',
      message: `Response contains ${ungroundedNumbers.length} numeric value(s) not found in any source document. Numeric claims must be traceable to a source.`,
      evidence: ungroundedNumbers.slice(0, 10).join(', ')
    });
  }

  // Overall grounding ratio below threshold => likely drift from evidence.
  if (groundedRatio < opts.minGroundedRatio) {
    issues.push({
      code: 'LOW_GROUNDING_RATIO',
      severity: 'high',
      message: `Only ${(groundedRatio * 100).toFixed(0)}% of substantive response terms are supported by the source documents (threshold: ${(opts.minGroundedRatio * 100).toFixed(0)}%). The response may contain unsupported claims.`,
      evidence: ungroundedTerms.slice(0, 15).join(', ')
    });
  }

  return {
    validator: 'grounding-check',
    passed: issues.length === 0,
    score: scoreFromIssues(issues),
    issues
  };
}
