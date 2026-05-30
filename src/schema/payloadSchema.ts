import { z } from 'zod';

/**
 * Canonical schema for an AI response payload.
 *
 * This Zod schema is the SINGLE SOURCE OF TRUTH for the payload shape.
 * The TypeScript types in `types/validation.ts` are derived from it via
 * `z.infer`, so the runtime contract and the compile-time types can never
 * drift apart. Add a field here once and both layers update.
 */

export const PlatformSchema = z.enum(['ios', 'android', 'web']);

export const ResponseMetadataSchema = z
  .object({
    model: z.string().min(1).optional(),
    appVersion: z.string().min(1).optional(),
    locale: z.string().min(2).optional(),
    platform: PlatformSchema.optional()
  })
  .strict(); // reject unknown metadata keys — catches typos like `platfrom`

/**
 * A grounding source the response is expected to be consistent with.
 * Used by the genuine (non-heuristic) grounding check.
 */
export const GroundingSourceSchema = z
  .object({
    sourceId: z.string().min(1),
    title: z.string().min(1).optional(),
    /** Authoritative text the response should not contradict / should draw from. */
    content: z.string().min(1)
  })
  .strict();

export const AiResponsePayloadSchema = z
  .object({
    id: z.string().min(1, 'id is required and must be non-empty'),
    feature: z.string().min(1, 'feature is required and must be non-empty'),
    prompt: z.string().min(1, 'prompt is required and must be non-empty'),
    response: z.string().min(1, 'response is required and must be non-empty'),
    metadata: ResponseMetadataSchema.optional(),
    /**
     * Optional grounding sources. When present, the grounding validator can
     * check the response against authoritative content instead of guessing.
     */
    groundingSources: z.array(GroundingSourceSchema).optional()
  })
  .strict();

// ─── Derived types (do not hand-write these) ─────────────────────────────────
export type Platform = z.infer<typeof PlatformSchema>;
export type ResponseMetadata = z.infer<typeof ResponseMetadataSchema>;
export type GroundingSource = z.infer<typeof GroundingSourceSchema>;
export type AiResponsePayload = z.infer<typeof AiResponsePayloadSchema>;

export interface SchemaParseSuccess {
  ok: true;
  data: AiResponsePayload;
}

export interface SchemaParseFailure {
  ok: false;
  /** Flattened, human-readable issues keyed by dotted field path. */
  issues: Array<{ path: string; message: string }>;
}

export type SchemaParseResult = SchemaParseSuccess | SchemaParseFailure;

/**
 * Safe parse that never throws. Returns a discriminated union so callers
 * can branch on `result.ok` with full type-narrowing.
 */
export function parsePayload(input: unknown): SchemaParseResult {
  const parsed = AiResponsePayloadSchema.safeParse(input);

  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  const issues = parsed.error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message
  }));

  return { ok: false, issues };
}
