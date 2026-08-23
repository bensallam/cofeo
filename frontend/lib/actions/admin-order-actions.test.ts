import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/woocommerce/rest-client", () => ({
  wcRestFetch: vi.fn(),
}));

import { wcRestFetch } from "@/lib/woocommerce/rest-client";
import { updateOrderStatusAction } from "./admin-order-actions";

const wcRestFetchMock = vi.mocked(wcRestFetch);

beforeEach(() => {
  wcRestFetchMock.mockReset();
});

/**
 * This is the only entry point a browser can actually reach. Since
 * COFEO has no admin authentication mechanism yet (see this file's own
 * docblock), it must refuse every caller unconditionally — proving that
 * here, at the actual reachable boundary, is what backs the "client
 * cannot impersonate admin" / "client cannot force arbitrary status"
 * guarantees, not just the pure transitionOrderCofeoStatus function.
 */
describe("updateOrderStatusAction — no admin auth mechanism exists yet", () => {
  it("refuses a plausible, well-formed request", async () => {
    const result = await updateOrderStatusAction(1, "CONFIRMED");
    expect(result).toEqual({ success: false, code: "UNAUTHORIZED" });
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });

  it("refuses regardless of which order id or status is requested", async () => {
    const result = await updateOrderStatusAction(999999, "DELIVERED");
    expect(result).toEqual({ success: false, code: "UNAUTHORIZED" });
    expect(wcRestFetchMock).not.toHaveBeenCalled();
  });
});
