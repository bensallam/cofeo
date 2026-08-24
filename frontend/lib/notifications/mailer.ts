import type { Mailer, EmailMessage, MailerResult } from "@/lib/notifications/types";

/**
 * Development/test-only Mailer. There is no real email provider
 * configured for this environment — no SMTP/Resend/SES credentials
 * exist anywhere in this repo (checked as part of the Phase 4B audit:
 * no such package is installed, no such env var is declared). This is
 * exactly the same "do not invent credentials" rule the project
 * applies to WhatsApp (see lib/notifications/types.ts), applied here
 * to email for the same reason: none exist to invent.
 *
 * This adapter never contacts a real mail server — it only logs that
 * it would have sent the message and reports success, so the rest of
 * the pipeline (idempotency, template rendering, failure handling, the
 * order-note audit trail) is fully exercised and testable without one.
 * It must never be mistaken for real delivery; nothing downstream
 * treats a LogMailer success as proof an inbox actually received
 * anything.
 *
 * Swapping in a real provider later means adding ONE new class
 * implementing `Mailer` (e.g. a ResendMailer/SmtpMailer, reading its
 * own credentials from a new optional serverEnv entry the same way
 * WC_CONSUMER_KEY/SECRET are handled) and changing what getMailer()
 * below constructs — nothing in dispatch.ts or the webhook route needs
 * to change.
 */
export class LogMailer implements Mailer {
  async send(message: EmailMessage): Promise<MailerResult> {
    // Deliberately logs only recipient/subject, never the rendered
    // body (which carries the customer's name and order details) —
    // matches this codebase's existing "no PII in logs" posture (see
    // e.g. rest-client.ts never logging response bodies).
    console.log(`[LogMailer] would send email — to=${message.to} subject="${message.subject}"`);
    return { success: true };
  }
}

let mailerInstance: Mailer | null = null;

/** Single point of extension for a real provider later — see the
 *  class docblock above. */
export function getMailer(): Mailer {
  if (!mailerInstance) {
    mailerInstance = new LogMailer();
  }
  return mailerInstance;
}

/** Test-only: forces the next getMailer() call to construct a fresh
 *  instance, so tests that inject their own mock via module mocking
 *  aren't affected by a leftover singleton from an earlier test. */
export function resetMailerForTests(): void {
  mailerInstance = null;
}
