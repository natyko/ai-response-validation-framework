import type { Severity, ValidationIssue } from '../types/validation.js';

const severityPenalty: Record<Severity, number> = {
  low: 5,
  medium: 15,
  high: 30,
  critical: 50
};

export function scoreFromIssues(issues: ValidationIssue[]): number {
  const penalty = issues.reduce((sum, issue) => sum + severityPenalty[issue.severity], 0);
  return Math.max(0, 100 - penalty);
}
