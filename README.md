# AI Response Validation Framework

[![AI Response Validation CI](https://github.com/natyko/ai-response-validation-framework/actions/workflows/ai-response-validation.yml/badge.svg)](https://github.com/natyko/ai-response-validation-framework/actions/workflows/ai-response-validation.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)](./tsconfig.json)
[![Tests](https://img.shields.io/badge/tests-46%20passing-brightgreen.svg)](./tests/validators.test.ts)

An open, reusable quality-engineering system that automatically evaluates AI-generated
responses for **patient-safety risk, hallucination risk, regulatory disclaimer compliance,
schema conformance, source grounding, and regression drift** before those responses reach
end users. The core is deterministic and rule-based, so every decision is auditable, and the
full validation suite runs in CI on every pull request and produces machine-readable JSON
reports suitable for QA, clinical-safety, and compliance review.

> This project uses **synthetic examples only**. It does not include proprietary code,
> patient data, production prompts, internal APIs, or employer-specific implementation details.

## Why this project exists

AI-enabled mobile and healthcare-adjacent applications need repeatable validation before
responses are released to users. This framework demonstrates how QA-automation and
quality-engineering teams can evaluate AI-generated responses for safety, consistency,
regression risk, and review readiness — as a public, employer-neutral reference methodology.

## National importance & standards alignment

Generative AI is being deployed rapidly in patient-facing mobile apps, triage assistants,
medication-information tools, and clinical-decision-support interfaces. Unvalidated AI
responses can recommend stopping medication, contradict clinicians, fabricate dosages, or
omit required cautionary language — each a direct patient-safety risk. This framework
provides a reproducible, automated layer of defense that **operationalizes recognized U.S.
AI-safety standards**.

### Alignment with the NIST AI Risk Management Framework (AI RMF 1.0)

The framework operationalizes the AI RMF characteristics of trustworthy AI — *valid and
reliable, safe, accountable, transparent, and explainable* — and maps to its four core
functions:

| NIST AI RMF function | How this framework supports it |
| --- | --- |
| **GOVERN** | Deterministic, rule-based validators with auditable logic; human-in-the-loop review workflow for AI-generated test cases. |
| **MAP**     | Schema validation and source-grounding context establish what a response must contain and what it is accountable to. |
| **MEASURE** | Safety, hallucination-risk, disclaimer, grounding, and regression validators produce quantitative per-validator scores. |
| **MANAGE**  | A CI quality gate blocks release on failure and uploads JSON audit artifacts for traceability. |

### Alignment with FDA Good Machine Learning Practice (GMLP) and SaMD

The framework reflects selected FDA/MHRA/Health Canada *Good Machine Learning Practice for
Medical Device Development* guiding principles and the Software-as-a-Medical-Device (SaMD)
lifecycle expectation of continuous evaluation:

| GMLP guiding principle | How this framework supports it |
| --- | --- |
| Good software-engineering and security practices | Strict TypeScript, Zod schema enforcement, unit tests, and CI on every change. |
| Testing demonstrates performance under clinically relevant conditions | Safety, disclaimer, and grounding validators exercise healthcare-style content. |
| Deployed models are monitored for performance | Regression-snapshot comparison detects behavioral drift across model versions, locales, and releases. |
| Human-AI team performance is considered | Human-in-the-loop review workflow quality-gates AI-authored test cases before approval. |

### Cross-industry applicability

While the validators are demonstrated on healthcare-style content, the architecture — safety
rules, hallucination detection, grounding checks, regression snapshots, and CI gates —
generalizes to any U.S. industry deploying generative AI under regulatory or safety
constraints, including financial services, legal technology, insurance, and public-sector
services.

## What it validates

- Response safety checks
- Hallucination-risk checks
- Required disclaimer validation
- Response schema validation (Zod)
- Source-grounding check
- Regression snapshot comparison
- AI-generated test-case review workflow
- GitHub Actions CI reporting

## Example use cases

- Validate healthcare-style AI assistant responses before release
- Add AI response checks to mobile regression pipelines
- Review AI-generated regression test cases before human approval
- Track response quality across app versions, locales, and platforms
- Generate CI artifacts for audit-friendly QA reporting

## Project structure

```text
src/
  validators/
    safetyValidator.ts             # unsafe / overly directive guidance
    hallucinationRiskValidator.ts  # unsupported absolute & diagnostic claims
    disclaimerValidator.ts         # required cautionary language
    schemaValidator.ts             # Zod structural validation
    groundingValidator.ts          # ratio of response grounded in sources
  core/
    regressionSnapshot.ts          # required/forbidden phrase & length baselines
    scoring.ts                     # severity-weighted scoring
    report.ts                      # aggregate validation report
  schema/
    payloadSchema.ts               # Zod response-payload contract
  types/
    validation.ts                  # shared types
  cli/
    validate.ts                    # validate a response JSON file
    review-test-cases.ts           # review AI-generated test cases
  index.ts                         # public API surface
examples/
  responses/sample-response.json
  test-cases/ai-generated-test-cases.json
tests/
  validators.test.ts              # 46 unit tests
.github/workflows/
  ai-response-validation.yml       # CI quality gate
```

## Quick start

```bash
npm install
npm run build
npm test
npm run validate:sample
npm run review:testcases
```

Run the full CI-style workflow locally:

```bash
npm run ci:report
```

Reports are written to:

```text
reports/validation-report.json
reports/test-case-review-report.json
```

## Validation modules

### 1. Response safety checks

Flags unsafe or overly directive healthcare-style guidance, such as telling a user to stop
medication, ignore a clinician, or trust a guaranteed cure.

### 2. Hallucination-risk checks

Detects strong medical or factual claims that are not qualified, sourced, or escalated to a
professional when appropriate. This layer is intentionally rule-based for transparency; in
production it can be combined with model-based evaluation, retrieval checks, or domain rules.

### 3. Required disclaimer validation

Checks whether healthcare-style responses include appropriate cautionary language when the
prompt or response includes medication, symptoms, treatment, or diagnostic context.

### 4. Schema validation

Ensures AI response payloads include required fields such as ID, feature, prompt, and
response, using a Zod contract. Useful for CI pipelines and audit-friendly reporting.

### 5. Source-grounding check

Measures the ratio of response content supported by the provided sources, with special,
higher-severity handling for ungrounded numeric claims. When no sources are supplied it
reports `NOT_ASSESSED` rather than silently passing.

### 6. Regression snapshot comparison

Compares a response against a baseline of required phrases, forbidden phrases, and minimum
length to detect regressions in AI response behavior across model versions, locales, and
releases.

### 7. AI-generated test-case review workflow

Reviews AI-generated regression test cases for common quality gaps:

- weak title
- insufficient steps
- vague expected result
- missing risk area
- missing human-review marker

The goal is not to replace QA judgment, but to make AI-assisted test generation safer, more
consistent, and easier to review.

## GitHub Actions

The included workflow runs on pull requests and pushes to `main`:

```text
.github/workflows/ai-response-validation.yml
```

It performs:

1. dependency installation
2. TypeScript build
3. unit tests
4. sample AI response validation
5. AI-generated test-case review
6. report artifact upload

## Example validation result

```json
{
  "responseId": "mobile-health-response-001",
  "feature": "mobile-health-assistant",
  "overallScore": 100,
  "passed": true,
  "results": [
    {
      "validator": "response-safety-checks",
      "passed": true,
      "score": 100,
      "issues": []
    }
  ]
}
```

## Reproducibility

Anyone can clone the repository, install dependencies, and run `npm run ci:report` to obtain
a deterministic JSON quality report — meeting the scientific and regulatory bar of
repeatability. The validation core is rule-based and contains no randomness, so identical
inputs always produce identical reports.

## Roadmap

- Add Playwright integration example
- Add Appium mobile validation example
- Add HTML report generation
- Add configurable validation policies
- Add response comparison across model versions
- Add locale-specific validation rules
- Add JSON schema support with configurable contracts

## Professional positioning

This project demonstrates practical expertise in:

- AI quality engineering
- QA automation architecture
- mobile application validation
- healthcare-style response safety
- regression risk management
- CI/CD quality gates
- human-in-the-loop review workflows

## Disclaimer

This project is for educational and demonstration purposes. It does not provide medical
advice and should not be used as a substitute for professional healthcare, legal, security,
or compliance review.
