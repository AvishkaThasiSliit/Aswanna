/**
 * Consistent error shape: { error: { code, message, fields?, warnings? } }
 * Every thrown AppError is caught by the central error handler.
 */
export class AppError extends Error {
  /**
   * @param {string} code   – machine-readable error code
   * @param {string} message – human-readable message
   * @param {number} status  – HTTP status
   * @param {object|null} fields – field-level errors
   * @param {array} warnings – non-blocking warnings
   */
  constructor(code, message, status = 400, fields = null, warnings = []) {
    super(message);
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.warnings = warnings;
  }
}

/** Utility – wrap async route handlers so we don't need try/catch everywhere */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Format field errors into standard shape: { path: [{ code, message, key }] } */
function formatFieldErrors(rawFields, defaultCode = 'VALIDATION_ERROR') {
  if (!rawFields) return {};
  const result = {};
  for (const [k, v] of Object.entries(rawFields)) {
    if (Array.isArray(v)) {
      result[k] = v.map((item) =>
        typeof item === 'string'
          ? { code: defaultCode, message: item, key: `validation.errors.${defaultCode.toLowerCase()}` }
          : item
      );
    } else if (typeof v === 'object' && v !== null && v.code) {
      result[k] = [v];
    } else {
      result[k] = [
        {
          code: defaultCode,
          message: String(v),
          key: `validation.errors.${defaultCode.toLowerCase()}`,
        },
      ];
    }
  }
  return result;
}

/** Central error handler – must be registered last in app.js */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // ── Zod validation errors ────────────────────────────────────────────────
  if (err.name === 'ZodError') {
    const fields = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'root';
      if (!fields[key]) fields[key] = [];
      fields[key].push({
        code: issue.code || 'VALIDATION_ERROR',
        message: issue.message,
        key: `validation.errors.${(issue.code || 'invalid').toLowerCase()}`,
      });
    }
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields, warnings: [] },
    });
  }

  // ── Mongoose ValidationError → 422 with per-field details ───────────────
  if (err.name === 'ValidationError') {
    const fields = {};
    for (const [path, ve] of Object.entries(err.errors || {})) {
      fields[path] = [
        {
          code: 'VALIDATION_ERROR',
          message: ve.message,
          key: 'validation.errors.invalid',
        },
      ];
    }
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields, warnings: [] },
    });
  }

  // ── Payload Too Large (Express body-parser) → 400/413 ───────────────────
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(400).json({
      error: { code: 'AUDIO_SIZE_EXCEEDED', message: 'Payload exceeds size limit' }
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
    const keys = Object.keys(err.keyPattern || {});
    const field = keys.includes('landCode') ? 'landCode' : (keys[0] || 'field');
    const msg = field === 'landCode'
      ? 'This Land Code is already in use by another of your lands'
      : `Duplicate value for ${field}`;
    return res.status(409).json({
      error: {
        code: 'DUPLICATE',
        message: msg,
        fields: formatFieldErrors({ [field]: msg }, 'DUPLICATE'),
      },
    });
  }

  // ── Our own AppError ──────────────────────────────────────────────────────
  if (err instanceof AppError) {
    const body = { error: { code: err.code, message: err.message } };
    if (err.fields) {
      body.error.fields = formatFieldErrors(err.fields, err.code);
    }
    if (err.status === 422) {
      body.error.warnings = err.warnings || [];
    }
    return res.status(err.status).json(body);
  }

  // ── Truly unexpected – strict security hygiene: NO stack traces to clients ─
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    console.error('UNHANDLED ERROR:', err);
  }
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
