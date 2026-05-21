import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

interface AiGeneratedTestCase {
  id: string;
  title: string;
  priority?: 'low' | 'medium' | 'high';
  preconditions?: string[];
  steps: string[];
  expectedResult: string;
  riskArea?: string;
  humanReviewed?: boolean;
}

interface ReviewIssue {
  testCaseId: string;
  code: string;
  message: string;
}

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('Usage: npm run review:testcases -- <path-to-test-cases-json>');
  process.exit(1);
}

const testCases = JSON.parse(readFileSync(resolve(inputPath), 'utf8')) as AiGeneratedTestCase[];
const issues: ReviewIssue[] = [];

for (const testCase of testCases) {
  if (!testCase.title || testCase.title.length < 8) {
    issues.push({ testCaseId: testCase.id, code: 'WEAK_TITLE', message: 'Title is missing or too vague.' });
  }

  if (!testCase.steps || testCase.steps.length < 2) {
    issues.push({ testCaseId: testCase.id, code: 'INSUFFICIENT_STEPS', message: 'Test case needs at least two executable steps.' });
  }

  if (!testCase.expectedResult || testCase.expectedResult.length < 15) {
    issues.push({ testCaseId: testCase.id, code: 'WEAK_EXPECTED_RESULT', message: 'Expected result is missing or too vague.' });
  }

  if (!testCase.riskArea) {
    issues.push({ testCaseId: testCase.id, code: 'MISSING_RISK_AREA', message: 'Risk area should be documented for regression prioritization.' });
  }

  if (!testCase.humanReviewed) {
    issues.push({ testCaseId: testCase.id, code: 'HUMAN_REVIEW_REQUIRED', message: 'AI-generated test cases require human review before use.' });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  totalTestCases: testCases.length,
  issueCount: issues.length,
  passed: issues.length === 0,
  issues
};

const outputPath = resolve('reports/test-case-review-report.json');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (!report.passed) {
  process.exit(1);
}
