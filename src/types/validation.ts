export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface AiResponsePayload {
  id: string;
  feature: string;
  prompt: string;
  response: string;
  metadata?: {
    model?: string;
    appVersion?: string;
    locale?: string;
    platform?: 'ios' | 'android' | 'web';
  };
}

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
