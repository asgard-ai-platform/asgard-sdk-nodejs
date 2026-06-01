export class AsgardError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = 'AsgardError';
  }
}

// ─── Predicate helpers (mirror Go's client.Is<Status> functions) ─────────────

function hasStatus(err: unknown, code: number): boolean {
  return err instanceof AsgardError && err.statusCode === code;
}

/**
 * Returns the HTTP status code from an AsgardError, or 0 if err is not one.
 * Mirrors Go's client.StatusCode(err).
 */
export function statusCodeOf(err: unknown): number {
  return err instanceof AsgardError ? (err.statusCode ?? 0) : 0;
}

/** Returns true if err is an AsgardError with HTTP 400 Bad Request. */
export function isBadRequest(err: unknown): boolean { return hasStatus(err, 400); }

/** Returns true if err is an AsgardError with HTTP 401 Unauthorized. */
export function isUnauthorized(err: unknown): boolean { return hasStatus(err, 401); }

/** Returns true if err is an AsgardError with HTTP 403 Forbidden. */
export function isForbidden(err: unknown): boolean { return hasStatus(err, 403); }

/** Returns true if err is an AsgardError with HTTP 404 Not Found. */
export function isNotFound(err: unknown): boolean { return hasStatus(err, 404); }

/** Returns true if err is an AsgardError with HTTP 409 Conflict. */
export function isConflict(err: unknown): boolean { return hasStatus(err, 409); }

/**
 * Returns true if err is an AsgardError with HTTP 412 Precondition Failed.
 * asgard-core uses 412 to signal "sandbox not found, please launch via message API first"
 * and similar precondition errors.
 */
export function isPreconditionFailed(err: unknown): boolean { return hasStatus(err, 412); }
