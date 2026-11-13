/** Response envelopes, kept byte-for-byte compatible with the API contract the frontend consumes. */
export function ok(data, message = "Request completed successfully") {
    return { success: true, message, data };
}
