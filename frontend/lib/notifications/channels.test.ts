import { describe, expect, it } from "vitest";
import { NOTIFICATION_CHANNELS, IMPLEMENTED_CHANNELS } from "@/lib/notifications/types";

describe("notification channel abstraction", () => {
  it("knows WhatsApp exists as a future channel, without implementing it", () => {
    expect(NOTIFICATION_CHANNELS).toContain("WHATSAPP");
    expect(IMPLEMENTED_CHANNELS).not.toContain("WHATSAPP");
  });

  it("only implements EMAIL this phase", () => {
    expect(IMPLEMENTED_CHANNELS).toEqual(["EMAIL"]);
  });

  it("every implemented channel is a real declared channel", () => {
    for (const channel of IMPLEMENTED_CHANNELS) {
      expect(NOTIFICATION_CHANNELS).toContain(channel);
    }
  });
});
