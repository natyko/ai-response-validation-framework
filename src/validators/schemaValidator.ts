import type { ValidationResult, ValidationIssue } from '../types/validation.js';
import { parsePayload } from '../schema/payloadSchema.js';
import { scoreFromIssues } from '../core/scoring.js';

/**
 * Validates payload structure using the canonical Zod schema.
 *
 * Unlike the previous hand-rolled field check, this:
 *  - validates types, not just presence (e.g. metadata.platform must be a known enum)
 *  - rejects unknown keys (`.strict()`), catching silent typos
 *  - reports the exact failing field path
 *
 * It deliberately accepts `unknown` because in real pipelines the input is
 * untrusted JSON, not an already-typed object.
 */
export function validateResponseSchema(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const parsed = parsePayload(input);

  if (!parsed.ok) {
    for (const issue of parsed.issues) {
      issues.push({
        code: 'SCHEMA_VIOLATION',
        severity: 'critical',
        message: `Schema violation at "${issue.path}": ${issue.message}`,
        evidence: issue.path
      });
    }

    return {
      validator: 'schema-validation',
      passed: false,
      score: scoreFromIssues(issues),
      issues
    };
  }

  // Structurally valid — apply soft quality heuristics that aren't schema errors.
  if (parsed.data.response.length < 20) {
    issues.push({
      code: 'RESPONSE_TOO_SHORT',
      severity: 'medium',
      message: 'Response is unusually short and may not be useful.'
    });
  }

  return {
    validator: 'schema-validation',
    passed: issues.length === 0,
    score: scoreFromIssues(issues),
    issues
  };
}
