import { NextResponse } from 'next/server';
import { z, ZodSchema } from 'zod';

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

type ApiResponse<T> = { data: T; error: null } | { data: null; error: string };

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Return a successful API response
 */
export function success<T>(data: T, init?: ResponseInit): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data, error: null }, init);
}

/**
 * Return an error API response
 */
export function fail(error: string, status = 400): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ data: null, error }, { status });
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

type ParseResult<T> = 
  | { success: true; data: T }
  | { success: false; response: NextResponse<ApiResponse<never>> };

/**
 * Validate request body against a Zod schema.
 * Returns typed data on success, formatted error response on failure.
 * 
 * @example
 * const parsed = parseBody(PatientLeadInput, body);
 * if (!parsed.success) return parsed.response;
 * // parsed.data is now fully typed and validated
 */
export function parseBody<T extends ZodSchema>(
  schema: T,
  data: unknown
): ParseResult<z.infer<T>> {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue.path.join('.');
    const message = path 
      ? `${path}: ${firstIssue.message}` 
      : firstIssue.message;
    
    return { success: false, response: fail(message) };
  }
  
  return { success: true, data: result.data };
}

/**
 * Validate query parameters against a Zod schema.
 * Handles URLSearchParams → object conversion.
 * 
 * @example
 * const url = new URL(req.url);
 * const parsed = parseQuery(TherapistListQuery, url.searchParams);
 * if (!parsed.success) return parsed.response;
 */
export function parseQuery<T extends ZodSchema>(
  schema: T,
  params: URLSearchParams
): ParseResult<z.infer<T>> {
  const raw: Record<string, string | string[]> = {};
  
  params.forEach((value, key) => {
    // Handle array params (e.g., ?modality=narm&modality=hakomi)
    if (raw[key]) {
      if (Array.isArray(raw[key])) {
        (raw[key] as string[]).push(value);
      } else {
        raw[key] = [raw[key] as string, value];
      }
    } else {
      raw[key] = value;
    }
  });
  
  return parseBody(schema, raw);
}

/**
 * Validate FormData against a Zod schema.
 * Handles form field → object conversion.
 * 
 * @example
 * const formData = await req.formData();
 * const parsed = await parseFormData(TherapistProfileUpdate, formData);
 * if (!parsed.success) return parsed.response;
 */
export async function parseFormData<T extends ZodSchema>(
  schema: T,
  formData: FormData
): Promise<ParseResult<z.infer<T>>> {
  const raw: Record<string, unknown> = {};
  
  formData.forEach((value, key) => {
    // Skip files - handle separately
    if (value instanceof File) return;
    
    // Handle booleans
    if (value === 'true') raw[key] = true;
    else if (value === 'false') raw[key] = false;
    else raw[key] = value;
  });
  
  return parseBody(schema, raw);
}

// ============================================================================
// ASYNC REQUEST BODY HELPER
// ============================================================================

/**
 * Safely parse JSON body and validate against schema in one step.
 * 
 * @example
 * const parsed = await parseRequestBody(req, PatientLeadInput);
 * if (!parsed.success) return parsed.response;
 */
export async function parseRequestBody<T extends ZodSchema>(
  req: Request,
  schema: T
): Promise<ParseResult<z.infer<T>>> {
  try {
    const body = await req.json();
    return parseBody(schema, body);
  } catch {
    return { success: false, response: fail('Ungültiger Request Body') };
  }
}

/**
 * Parse and validate query params from a NextRequest against a Zod schema.
 * Convenience wrapper around parseQuery that extracts searchParams from URL.
 * 
 * @example
 * const parsed = parseQueryParams(req, CalSlotsInput);
 * if (!parsed.success) return parsed.response;
 */
export function parseQueryParams<T extends ZodSchema>(
  req: Request,
  schema: T
): ParseResult<z.infer<T>> {
  const url = new URL(req.url);
  return parseQuery(schema, url.searchParams);
}
