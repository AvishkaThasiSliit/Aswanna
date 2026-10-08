/**
 * Consistent error shape: { error: { code, message, fields? } }
 * Every thrown AppError is caught by the central error handler.
 */
export class AppError extends Error {
  /**
   * @param {string} code   – machine-readable error code
   * @param {string} message – human-readable message
   * @param {number} status  – HTTP status
   * @param {object|null} fields – field-level errors (Zod, etc.)
   */
  constructor(code, message, status = 400, fields = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

/** Utility – wrap async route handlers so we don't need try/catch everywhere */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Central error handler – must be registered last in app.js */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // ── Zod validation errors ────────────────────────────────────────────────
  if (err.name === 'ZodError') {
    const fields = {};
    for (const issue of err.errors) {
      const key = issue.path.join('.');
      fields[key] = issue.message;
    }
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields },
    });
  }

  // ── Mongoose ValidationError → 422 with per-field details ───────────────
  if (err.name === 'ValidationError') {
    const fields = {};
    for (const [path, ve] of Object.entries(err.errors || {})) {
      fields[path] = ve.message;
    }
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields },
    });
  }

  // ── Mongoose CastError (malformed ObjectId, wrong type) → 400 ───────────
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: { code: 'INVALID_ID', message: `Invalid value for field: ${err.path}` },
    });
  }

  // ── Mongoose duplicate-key → 409 ─────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({
      error: { code: 'DUPLICATE', message: `Duplicate value for ${field}` },
    });
  }

  // ── Our own AppError ──────────────────────────────────────────────────────
  if (err instanceof AppError) {
    const body = { error: { code: err.code, message: err.message } };
    if (err.fields) body.error.fields = err.fields;
    return res.status(err.status).json(body);
  }

  // ── Truly unexpected – don't leak internals in production ─────────────────
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    console.error('UNHANDLED ERROR:', err);
  }
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev ? err.message : 'An unexpected error occurred',
    },
  });
}

