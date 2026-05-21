import type { AiResponsePayload, ValidationIssue, ValidationResult } from '../types/validation.js';
import { scoreFromIssues } from './scoring.js';

export interface RegressionBaseline {
  responseId: string;
  requiredPhrases: string[];
  forbiddenPhrases: string[];
  minLength: number;
}

export function compareWithRegressionBaseline(
  payload: AiResponsePayload,
  baseline: RegressionBaseline
): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const phrase of baseline.requiredPhrases) {
    if (!payload.response.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push({
        code: 'MISSING_BASELINE_PHRASE',
        severity: 'medium',
        message: `Expected baseline phrase is missing: ${phrase}`
      });
    }
  }

  for (const phrase of baseline.forbiddenPhrases) {
    if (payload.response.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push({
        code: 'FORBIDDEN_BASELINE_PHRASE',
        severity: 'high',
        message: `Forbidden baseline phrase appeared: ${phrase}`
      });
    }
  }

  if (payload.response.length < baseline.minLength) {
    issues.push({
      code: 'REGRESSION_RESPONSE_LENGTH_DROP',
      severity: 'medium',
      message: `Response length dropped below baseline minimum: ${baseline.minLength}`
    });
  }

  return {
    validator: 'regression-snapshot-comparison',
    passed: issues.length === 0,
    score: scoreFromIssues(issues),
    issues
  };
}
