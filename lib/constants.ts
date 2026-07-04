// Shared, dependency-free limits. Safe to import from both client and server
// (no Node-only deps here, unlike lib/extract.ts).

/** Raw upload cap. Kept well under Vercel's ~4.5 MB function request-body limit,
 *  leaving room for the job-description/role fields in the same multipart body. */
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_FILE_MB = 3;

/** Upper bound on any extracted/pasted resume text we process, so the synchronous
 *  signal-computation pass can never be turned into a CPU/memory DoS. */
export const MAX_TEXT_CHARS = 60_000;

/** Server-side caps on free-text form fields. */
export const MAX_JD_CHARS = 20_000;
export const MAX_ROLE_CHARS = 200;

/** Chat guards. */
export const MAX_CHAT_CONTEXT_CHARS = 1_000;
export const MAX_CHAT_MESSAGES = 40;
