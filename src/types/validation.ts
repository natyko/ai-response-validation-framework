/**
 * Payload shape types are DERIVED from the Zod schema (single source of truth)
 * and re-exported here so existing imports from `types/validation.js` keep
 * working. Do not hand-redefine the payload here — edit `schema/payloadSchema.ts`.
 */
export type {
  AiResponsePayload,
  ResponseMetadata,
  GroundingSource,
  Platform
} from '../schema/payloadSchema.js';

// ─── Validation result types (not payload shape — defined here) ──────────────

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface ValidationIssue {
  code: string;
  severity: Severity;
  message: string;
  evidence?: string;
}

export interface ValidationResult {
  validator: string;
  passed: boolean;
  score: number;
  issues: ValidationIssue[];
}

export interface ValidationReport {
  responseId: string;
  feature: string;
  overallScore: number;
  passed: boolean;
  generatedAt: string;
  results: ValidationResult[];
}
