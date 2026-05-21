import type { AiResponsePayload, ValidationResult, ValidationIssue } from '../types/validation.js';
import { scoreFromIssues } from '../core/scoring.js';

export function validateResponseSchema(payload: Partial<AiResponsePayload>): ValidationResult {
  const issues: ValidationIssue[] = [];

  const requiredFields: Array<keyof AiResponsePayload> = ['id', 'feature', 'prompt', 'response'];

  for (const field of requiredFields) {
    if (!payload[field]) {
      issues.push({
        code: 'MISSING_REQUIRED_FIELD',
        severity: 'critical',
        message: `Missing required field: ${field}`
      });
    }
  }

  if (payload.response && payload.response.length < 20) {
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
