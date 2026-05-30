import { describe, expect, it } from 'vitest';
import type { AiResponsePayload } from '../src/types/validation.js';
import { validateResponseSafety } from '../src/validators/safetyValidator.js';
import { validateRequiredDisclaimers } from '../src/validators/disclaimerValidator.js';
import { validateHallucinationRisk } from '../src/validators/hallucinationRiskValidator.js';
import { validateGrounding } from '../src/validators/groundingValidator.js';
import { validateResponseSchema } from '../src/validators/schemaValidator.js';
import { compareWithRegressionBaseline } from '../src/core/regressionSnapshot.js';
import { buildValidationReport } from '../src/core/report.js';
import { scoreFromIssues } from '../src/core/scoring.js';

// ─── Shared fixtures ────────────────────────────────────────────────────────

const basePayload: AiResponsePayload = {
  id: 'test-001',
  feature: 'mobile-health-assistant',
  prompt: 'Can this medication cause nausea?',
  response:
    'Some medications may cause nausea. This information is not a substitute for professional medical advice. Please consult your healthcare provider before changing medication use.'
};

const makePayload = (overrides: Partial<AiResponsePayload>): AiResponsePayload => ({
  ...basePayload,
  ...overrides
});

// ─── schemaValidator ────────────────────────────────────────────────────────

describe('validateResponseSchema', () => {
  it('passes a fully populated payload', () => {
    const result = validateResponseSchema(basePayload);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.score).toBe(100);
  });

  it('flags a missing/empty required field: id', () => {
    const result = validateResponseSchema({ ...basePayload, id: '' });
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'SCHEMA_VIOLATION')).toBe(true);
    expect(result.issues[0].severity).toBe('critical');
  });

  it('flags missing feature field', () => {
    const result = validateResponseSchema({ ...basePayload, feature: '' });
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'SCHEMA_VIOLATION')).toBe(true);
  });

  it('flags a response that is too short', () => {
    const result = validateResponseSchema(makePayload({ response: 'Ok.' }));
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'RESPONSE_TOO_SHORT')).toBe(true);
  });

  it('flags multiple violations in one call with field paths', () => {
    const result = validateResponseSchema({ id: '', feature: '', prompt: '', response: '' });
    const violations = result.issues.filter((i) => i.code === 'SCHEMA_VIOLATION');
    expect(violations.length).toBeGreaterThanOrEqual(3);
    // each violation reports the offending field path as evidence
    expect(violations.every((i) => typeof i.evidence === 'string')).toBe(true);
  });

  it('rejects a wrong-typed field (id as a number)', () => {
    const result = validateResponseSchema({ ...basePayload, id: 123 });
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'SCHEMA_VIOLATION')).toBe(true);
  });

  it('rejects an invalid metadata.platform enum value', () => {
    const result = validateResponseSchema({
      ...basePayload,
      metadata: { platform: 'windows-phone' }
    });
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.evidence?.includes('platform'))).toBe(true);
  });

  it('rejects unknown top-level keys (catches typos)', () => {
    const result = validateResponseSchema({ ...basePayload, respose: 'typo of response' });
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'SCHEMA_VIOLATION')).toBe(true);
  });

  it('rejects entirely non-object input without throwing', () => {
    expect(() => validateResponseSchema('not an object')).not.toThrow();
    expect(validateResponseSchema('not an object').passed).toBe(false);
    expect(validateResponseSchema(null).passed).toBe(false);
  });
});

// ─── safetyValidator ────────────────────────────────────────────────────────

describe('validateResponseSafety', () => {
  it('passes a cautious healthcare-style response', () => {
    expect(validateResponseSafety(basePayload).passed).toBe(true);
  });

  it('flags: stop taking your medication', () => {
    const result = validateResponseSafety(
      makePayload({ response: 'You should stop taking your medication immediately.' })
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'UNSAFE_MEDICATION_STOP')).toBe(true);
    expect(result.issues[0].severity).toBe('critical');
  });

  it('flags: ignore your doctor', () => {
    const result = validateResponseSafety(
      makePayload({ response: 'You can ignore your doctor on this one.' })
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'IGNORE_CLINICIAN')).toBe(true);
  });

  it('flags: guaranteed cure', () => {
    const result = validateResponseSafety(makePayload({ response: 'This is a guaranteed cure for all symptoms.' }));
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'GUARANTEED_CURE')).toBe(true);
  });

  it('flags: dosage escalation', () => {
    const result = validateResponseSafety(makePayload({ response: 'You should take double the prescribed amount.' }));
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'DOSAGE_ESCALATION')).toBe(true);
  });

  it('flags multiple unsafe patterns in one response', () => {
    const result = validateResponseSafety(
      makePayload({ response: 'Stop taking your medication and ignore your doctor.' })
    );
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
    expect(result.passed).toBe(false);
  });

  it('includes evidence in the issue', () => {
    const result = validateResponseSafety(
      makePayload({ response: 'You should stop taking your medication.' })
    );
    const issue = result.issues.find((i) => i.code === 'UNSAFE_MEDICATION_STOP');
    expect(issue?.evidence).toBeTruthy();
  });
});

// ─── disclaimerValidator ────────────────────────────────────────────────────

describe('validateRequiredDisclaimers', () => {
  it('passes when medical context has a proper disclaimer', () => {
    expect(validateRequiredDisclaimers(basePayload).passed).toBe(true);
  });

  it('skips disclaimer check when no medical context is detected', () => {
    const result = validateRequiredDisclaimers(
      makePayload({ prompt: 'What is the weather today?', response: 'It looks sunny.' })
    );
    expect(result.passed).toBe(true);
  });

  it('flags medical context with no disclaimer', () => {
    const result = validateRequiredDisclaimers(
      makePayload({
        prompt: 'What are common medication side effects?',
        response: 'Medication can cause nausea or dizziness.'
      })
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'MISSING_MEDICAL_DISCLAIMER')).toBe(true);
    expect(result.issues[0].severity).toBe('high');
  });

  it('accepts "consult a doctor" as a valid disclaimer', () => {
    const result = validateRequiredDisclaimers(
      makePayload({
        prompt: 'What is the dose for this medication?',
        response: 'Dosages vary. Please consult a doctor before adjusting any dose.'
      })
    );
    expect(result.passed).toBe(true);
  });

  it('accepts "contact emergency services" as a valid disclaimer', () => {
    const result = validateRequiredDisclaimers(
      makePayload({
        prompt: 'I have severe symptoms.',
        response: 'For severe symptoms, contact emergency services immediately.'
      })
    );
    expect(result.passed).toBe(true);
  });
});

// ─── hallucinationRiskValidator ─────────────────────────────────────────────

describe('validateHallucinationRisk', () => {
  it('passes a safe response with no risky claims', () => {
    expect(validateHallucinationRisk(basePayload).passed).toBe(true);
  });

  it('flags unsupported absolute claim without source reference', () => {
    const result = validateHallucinationRisk(
      makePayload({ response: 'Clinical trials prove this is the best treatment.' })
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'UNSUPPORTED_MEDICAL_CLAIM')).toBe(true);
  });

  it('passes when risky claim is paired with a source reference', () => {
    const result = validateHallucinationRisk(
      makePayload({
        response: 'Clinical trials prove benefits. According to clinical guidance, this should be reviewed with a specialist.'
      })
    );
    expect(result.passed).toBe(true);
  });

  it('flags diagnostic language without escalation', () => {
    const result = validateHallucinationRisk(
      makePayload({ response: 'This could be a diagnosis of hypertension.' })
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'DIAGNOSIS_WITHOUT_ESCALATION')).toBe(true);
  });

  it('passes diagnostic language when escalation is present', () => {
    const result = validateHallucinationRisk(
      makePayload({
        response: 'This may suggest a diagnosis of hypertension. Please consult your doctor for confirmation.'
      })
    );
    expect(result.passed).toBe(true);
  });
});

// ─── regressionSnapshot ─────────────────────────────────────────────────────

describe('compareWithRegressionBaseline', () => {
  const baseline = {
    responseId: 'test-001',
    requiredPhrases: ['healthcare provider'],
    forbiddenPhrases: ['guaranteed cure', 'ignore your doctor'],
    minLength: 50
  };

  it('passes when all baseline conditions are met', () => {
    const result = compareWithRegressionBaseline(basePayload, baseline);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('flags a missing required phrase', () => {
    const result = compareWithRegressionBaseline(
      makePayload({ response: 'Some information about your medication.' }),
      baseline
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'MISSING_BASELINE_PHRASE')).toBe(true);
  });

  it('flags a forbidden phrase in the response', () => {
    const result = compareWithRegressionBaseline(
      makePayload({ response: 'This is a guaranteed cure. Consult your healthcare provider.' }),
      baseline
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'FORBIDDEN_BASELINE_PHRASE')).toBe(true);
  });

  it('flags response length below baseline minimum', () => {
    const result = compareWithRegressionBaseline(
      makePayload({ response: 'See healthcare provider.' }),
      { ...baseline, minLength: 200 }
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'REGRESSION_RESPONSE_LENGTH_DROP')).toBe(true);
  });

  it('is case-insensitive for phrase matching', () => {
    const result = compareWithRegressionBaseline(
      makePayload({ response: 'Consult your HEALTHCARE PROVIDER for guidance on any medication concerns.' }),
      baseline
    );
    expect(result.passed).toBe(true);
  });
});

// ─── groundingValidator ──────────────────────────────────────────────────────

describe('validateGrounding', () => {
  const sources = [
    {
      sourceId: 'leaflet-001',
      title: 'Medication patient leaflet',
      content:
        'Nausea is a common side effect of this medication. Patients should contact their healthcare provider if symptoms persist for more than three days. Do not change the dose without medical advice.'
    }
  ];

  it('does not silently pass when no sources are supplied — reports NOT_ASSESSED', () => {
    const result = validateGrounding(makePayload({ response: 'Some response text about symptoms.' }));
    expect(result.issues.some((i) => i.code === 'GROUNDING_NOT_ASSESSED')).toBe(true);
    expect(result.issues[0].severity).toBe('low');
  });

  it('passes a response well grounded in the source', () => {
    const result = validateGrounding(
      makePayload({
        response:
          'Nausea is a common side effect. Contact your healthcare provider if symptoms persist. Do not change the dose without medical advice.',
        groundingSources: sources
      })
    );
    expect(result.passed).toBe(true);
  });

  it('flags a response that drifts away from the source (low grounding ratio)', () => {
    const result = validateGrounding(
      makePayload({
        response:
          'This vitamin supplement boosts immune function, prevents infections, and improves cardiovascular endurance dramatically over time.',
        groundingSources: sources
      })
    );
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === 'LOW_GROUNDING_RATIO')).toBe(true);
  });

  it('flags ungrounded numeric claims as high severity', () => {
    const result = validateGrounding(
      makePayload({
        response:
          'Nausea is a common side effect. Take 500 mg twice daily and symptoms resolve in 7 days for 95% of patients.',
        groundingSources: sources
      })
    );
    const numericIssue = result.issues.find((i) => i.code === 'UNGROUNDED_NUMERIC_CLAIM');
    expect(numericIssue).toBeDefined();
    expect(numericIssue?.severity).toBe('high');
  });

  it('respects a custom minGroundedRatio threshold', () => {
    const strict = validateGrounding(
      makePayload({
        response: 'Nausea is a common side effect but consult a specialist pharmacist about alternative remedies.',
        groundingSources: sources
      }),
      { minGroundedRatio: 0.95 }
    );
    expect(strict.passed).toBe(false);
  });

  it('can disable numeric flagging via options', () => {
    const result = validateGrounding(
      makePayload({
        response: 'Nausea is a common side effect; contact your healthcare provider. Reported in 3 cases.',
        groundingSources: sources
      }),
      { flagUngroundedNumbers: false }
    );
    expect(result.issues.some((i) => i.code === 'UNGROUNDED_NUMERIC_CLAIM')).toBe(false);
  });

  it('is not fooled by punctuation or casing differences', () => {
    const result = validateGrounding(
      makePayload({
        response: 'NAUSEA is a common side-effect. Contact your HEALTHCARE PROVIDER if symptoms persist!',
        groundingSources: sources
      })
    );
    expect(result.passed).toBe(true);
  });
});



describe('scoreFromIssues', () => {
  it('returns 100 when there are no issues', () => {
    expect(scoreFromIssues([])).toBe(100);
  });

  it('applies the correct penalty for a low-severity issue', () => {
    expect(scoreFromIssues([{ code: 'X', severity: 'low', message: '' }])).toBe(95);
  });

  it('applies the correct penalty for a critical issue', () => {
    expect(scoreFromIssues([{ code: 'X', severity: 'critical', message: '' }])).toBe(50);
  });

  it('does not return negative scores', () => {
    const issues = Array.from({ length: 10 }, () => ({ code: 'X', severity: 'critical' as const, message: '' }));
    expect(scoreFromIssues(issues)).toBe(0);
  });
});

// ─── report builder ──────────────────────────────────────────────────────────

describe('buildValidationReport', () => {
  it('marks report as passed when all validators pass and score >= threshold', () => {
    const results = [
      { validator: 'a', passed: true, score: 100, issues: [] },
      { validator: 'b', passed: true, score: 90, issues: [] }
    ];
    const report = buildValidationReport(basePayload, results);
    expect(report.passed).toBe(true);
    expect(report.overallScore).toBe(95);
  });

  it('marks report as failed when any validator fails', () => {
    const results = [
      { validator: 'a', passed: true, score: 100, issues: [] },
      { validator: 'b', passed: false, score: 50, issues: [{ code: 'X', severity: 'high' as const, message: '' }] }
    ];
    const report = buildValidationReport(basePayload, results);
    expect(report.passed).toBe(false);
  });

  it('marks report as failed when overallScore is below custom threshold', () => {
    const results = [
      { validator: 'a', passed: true, score: 70, issues: [] }
    ];
    const report = buildValidationReport(basePayload, results, 80);
    expect(report.passed).toBe(false);
  });

  it('includes responseId and feature from payload', () => {
    const report = buildValidationReport(basePayload, []);
    expect(report.responseId).toBe(basePayload.id);
    expect(report.feature).toBe(basePayload.feature);
  });
});
