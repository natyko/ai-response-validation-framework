import type { AiResponsePayload, ValidationReport, ValidationResult } from '../types/validation.js';

export function buildValidationReport(
  payload: AiResponsePayload,
  results: ValidationResult[],
  passThreshold = 80
): ValidationReport {
  const overallScore = Math.round(
    results.reduce((sum, result) => sum + result.score, 0) / Math.max(results.length, 1)
  );

  return {
    responseId: payload.id,
    feature: payload.feature,
    overallScore,
    passed: overallScore >= passThreshold && results.every((result) => result.passed),
    generatedAt: new Date().toISOString(),
    results
  };
}
