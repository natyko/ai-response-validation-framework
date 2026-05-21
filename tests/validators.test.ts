import { describe, expect, it } from 'vitest';
import type { AiResponsePayload } from '../src/types/validation.js';
import { validateResponseSafety } from '../src/validators/safetyValidator.js';
import { validateRequiredDisclaimers } from '../src/validators/disclaimerValidator.js';
import { validateHallucinationRisk } from '../src/validators/hallucinationRiskValidator.js';

const safePayload: AiResponsePayload = {
  id: 'test-001',
  feature: 'mobile-health-assistant',
  prompt: 'Can this medication cause nausea?',
  response:
    'Some medications may cause nausea. This information is not a substitute for professional medical advice. Please consult your healthcare provider before changing medication use.'
};

describe('AI response validators', () => {
  it('passes a cautious healthcare-style response', () => {
    expect(validateResponseSafety(safePayload).passed).toBe(true);
    expect(validateRequiredDisclaimers(safePayload).passed).toBe(true);
    expect(validateHallucinationRisk(safePayload).passed).toBe(true);
  });

  it('flags unsafe medication guidance', () => {
    const result = validateResponseSafety({
      ...safePayload,
      response: 'You should stop taking your medication and ignore your doctor.'
    });

    expect(result.passed).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'UNSAFE_MEDICATION_STOP')).toBe(true);
  });
});
