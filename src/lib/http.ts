import { NextResponse } from 'next/server';

export type ApiResponsePayload = {
  data: unknown;
  error: unknown;
};

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateApiResponse(payload: unknown): ApiResponsePayload {
  if (!isObjectLike(payload)) {
    throw new Error('Invalid response structure: expected an object payload');
  }

  if (!Object.prototype.hasOwnProperty.call(payload, 'data') || !Object.prototype.hasOwnProperty.call(payload, 'error')) {
    throw new Error("Invalid response structure: missing required 'data' or 'error' property");
  }

  return payload as ApiResponsePayload;
}

export function safeJson(payload: unknown, init?: ResponseInit) {
  const validated = validateApiResponse(payload);
  return NextResponse.json(validated, init);
}
