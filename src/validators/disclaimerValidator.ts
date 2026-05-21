import type { AiResponsePayload, ValidationResult, ValidationIssue } from '../types/validation.js';
import { scoreFromIssues } from '../core/scoring.js';

const disclaimerPatterns = [
  /not a substitute for professional medical advice/i,
  /consult (a|your) (doctor|clinician|healthcare provider)/i,
  /contact emergency services/i
];

export function validateRequiredDisclaimers(payload: AiResponsePayload): ValidationResult {
  const issues: ValidationIssue[] = [];

  const hasMedicalAdviceContext = /medication|symptom|dose|side effect|treatment|diagnosis/i.test(
    `${payload.prompt} ${payload.response}`
  );

  if (hasMedicalAdviceContext) {
    const hasDisclaimer = disclaimerPatterns.some((pattern) => pattern.test(payload.response));
    if (!hasDisclaimer) {
      issues.push({
        code: 'MISSING_MEDICAL_DISCLAIMER',
        severity: 'high',
        message: 'Healthcare-style response should include an appropriate medical disclaimer.'
      });
    }
  }

  return {
    validator: 'required-disclaimer-validation',
    passed: issues.length === 0,
    score: scoreFromIssues(issues),
    issues
  };
}
