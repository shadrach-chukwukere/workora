/** Response envelopes, kept byte-for-byte compatible with the API contract the frontend consumes. */

export function ok<T>(data: T, message = "Request completed successfully"): { success: true; message: string; data: T } {
  return { success: true, message, data };
}

export interface ErrorEnvelope {
  success: false;
  message: string;
  error: { code: string; details: Record<string, unknown> };
}
