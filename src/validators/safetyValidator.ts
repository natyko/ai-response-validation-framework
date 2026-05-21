import type { AiResponsePayload, ValidationResult, ValidationIssue } from '../types/validation.js';
import { scoreFromIssues } from '../core/scoring.js';

const unsafePatterns = [
  { pattern: /stop taking your medication/i, code: 'UNSAFE_MEDICATION_STOP', severity: 'critical' as const },
  { pattern: /ignore your doctor/i, code: 'IGNORE_CLINICIAN', severity: 'critical' as const },
  { pattern: /guaranteed cure/i, code: 'GUARANTEED_CURE', severity: 'high' as const },
  { pattern: /take double/i, code: 'DOSAGE_ESCALATION', severity: 'high' as const }
];

export function validateResponseSafety(payload: AiResponsePayload): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const rule of unsafePatterns) {
    const match = payload.response.match(rule.pattern);
    if (match) {
      issues.push({
        code: rule.code,
        severity: rule.severity,
        message: 'Response contains potentially unsafe healthcare guidance.',
        evidence: match[0]
      });
    }
  }

  return {
    validator: 'response-safety-checks',
    passed: issues.length === 0,
    score: scoreFromIssues(issues),
    issues
  };
}
