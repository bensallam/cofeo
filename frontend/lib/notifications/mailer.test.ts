import { describe, expect, it, vi, beforeEach } from "vitest";
import { LogMailer, getMailer, resetMailerForTests } from "@/lib/notifications/mailer";

describe("LogMailer", () => {
  it("reports success without contacting any real mail server", async () => {
    const mailer = new LogMailer();
    const result = await mailer.send({
      to: "customer@example.com",
      subject: "Test",
      html: "<p>hi</p>",
      text: "hi",
    });
    expect(result).toEqual({ success: true });
  });

  it("never logs the message body (only recipient/subject) — no PII in logs", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const mailer = new LogMailer();
    await mailer.send({
      to: "customer@example.com",
      subject: "Order update",
      html: "<p>SECRET_CUSTOMER_ADDRESS</p>",
      text: "SECRET_CUSTOMER_ADDRESS",
    });
    const loggedText = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(loggedText).toContain("customer@example.com");
    expect(loggedText).not.toContain("SECRET_CUSTOMER_ADDRESS");
    logSpy.mockRestore();
  });
});

describe("getMailer", () => {
  beforeEach(() => resetMailerForTests());

  it("returns a LogMailer by default — no real provider is configured for this environment", () => {
    expect(getMailer()).toBeInstanceOf(LogMailer);
  });

  it("returns the same instance across calls", () => {
    expect(getMailer()).toBe(getMailer());
  });
});
