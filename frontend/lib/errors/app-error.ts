/**
 * Normalized internal error codes (COFEO master spec, section 37).
 * User-facing messages are resolved from these codes via i18n message
 * catalogs — never surface raw backend/WooCommerce error strings.
 */
export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "INVALID_PHONE",
  "INVALID_CITY",
  "OUT_OF_STOCK",
  "PRICE_CHANGED",
  "SHIPPING_UNAVAILABLE",
  "PAYMENT_FAILED",
  "ORDER_CREATION_FAILED",
  "RATE_LIMITED",
  "NETWORK_ERROR",
  "SERVER_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly cause?: unknown;

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.cause = options?.cause;
  }
}
