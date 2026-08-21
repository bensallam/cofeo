"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { CheckoutModal } from "@/components/checkout/checkout-modal";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { addToCartAction } from "@/lib/actions/cart-actions";
import { getCheckoutBootstrapAction, type CheckoutBootstrap } from "@/lib/actions/checkout-bootstrap-actions";
import { dispatchCartUpdated } from "@/lib/cart/cart-events";
import { MAX_CART_QUANTITY } from "@/lib/validation/cart";
import { cn } from "@/lib/design/cn";
import type { Cart } from "@/lib/woocommerce/cart-types";

type AddToCartBoxProps = {
  productId: number;
  productName: string;
  available: boolean;
};

type BuyNowSession = CheckoutBootstrap & { cart: Cart };

const STEP_BUTTON =
  "inline-flex size-10 items-center justify-center rounded-(--radius-control) border border-border-strong " +
  "text-text-primary transition-colors duration-200 hover:bg-surface-hover " +
  "disabled:pointer-events-none disabled:opacity-40";

/**
 * Real Store API cart mutation (Phase 6) — replaces the Phase 5
 * interaction-boundary simulation. Success/failure both surface via
 * Toast; the fresh cart from the action's result is broadcast via
 * dispatchCartUpdated so the Header's badge/MiniCart update without a
 * page reload, even though they're a separate client subtree.
 *
 * The quantity stepper is purely a pre-add local value — it reuses
 * the same [1, MAX_CART_QUANTITY] bound and Cart.* translations as
 * the cart's own QuantityStepper, but addToCartAction already accepted
 * an arbitrary `quantity` (only the UI hardcoded 1), so wiring this in
 * is additive: the Store API call, its Zod validation, and its real
 * stock enforcement are all unchanged.
 */
export function AddToCartBox({ productId, productName, available }: AddToCartBoxProps) {
  const t = useTranslations("Product");
  const cartT = useTranslations("Cart");
  const checkoutT = useTranslations("Checkout");
  const [quantity, setQuantity] = React.useState(1);
  const [isPending, startTransition] = React.useTransition();
  const [feedback, setFeedback] = React.useState<
    { type: "success" } | { type: "error"; message: string } | null
  >(null);

  // Buy Now's own session, separate from the Add to Cart transition above
  // so neither action's pending/loading state affects the other's button.
  // Once a session exists, reopening the modal never re-runs
  // addToCartAction — that would silently add more units every time the
  // customer closed and reopened via Buy Now. The product is only ever
  // added once per session; "Add to Cart" stays the only repeatable way
  // to add more, exactly as before.
  const [buyNowSession, setBuyNowSession] = React.useState<BuyNowSession | null>(null);
  const [isCheckoutOpen, setCheckoutOpen] = React.useState(false);
  const [isBuyNowPending, startBuyNowTransition] = React.useTransition();

  React.useEffect(() => {
    if (feedback === null) return;
    const timeout = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  /** Mirrors the same OUT_OF_STOCK-with-count vs. generic-error split
   * used by the cart drawer/page (cart-widget.tsx, cart-page-client.tsx)
   * — same error codes, same fallback rule, just surfaced via Toast
   * here instead of an inline alert. */
  function errorMessage(result: Extract<Awaited<ReturnType<typeof addToCartAction>>, { ok: false }>) {
    if (result.code === "OUT_OF_STOCK") {
      return result.availableQuantity !== undefined
        ? cartT("maxAvailableQuantity", { max: result.availableQuantity })
        : cartT("errorOutOfStock");
    }
    return t("addToCartError");
  }

  function handleClick() {
    startTransition(async () => {
      const result = await addToCartAction({ productId, quantity });
      if (result.ok) {
        dispatchCartUpdated(result.cart);
        setFeedback({ type: "success" });
        setQuantity(1);
      } else {
        setFeedback({ type: "error", message: errorMessage(result) });
      }
    });
  }

  function handleBuyNow() {
    if (buyNowSession) {
      setCheckoutOpen(true);
      return;
    }
    startBuyNowTransition(async () => {
      const addResult = await addToCartAction({ productId, quantity });
      if (!addResult.ok) {
        setFeedback({ type: "error", message: errorMessage(addResult) });
        return;
      }
      dispatchCartUpdated(addResult.cart);
      setQuantity(1);
      try {
        const bootstrap = await getCheckoutBootstrapAction();
        setBuyNowSession({ cart: addResult.cart, ...bootstrap });
        setCheckoutOpen(true);
      } catch {
        setFeedback({ type: "error", message: t("addToCartError") });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {available && (
        <div
          role="group"
          aria-label={cartT("quantityInputLabel", { name: productName })}
          className="inline-flex items-center gap-4 self-start"
        >
          <button
            type="button"
            aria-label={cartT("decreaseQuantityLabel")}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={isPending || isBuyNowPending || quantity <= 1}
            className={cn(STEP_BUTTON)}
          >
            −
          </button>
          <span className="min-w-6 text-center text-body font-medium tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            aria-label={cartT("increaseQuantityLabel")}
            onClick={() => setQuantity((q) => Math.min(MAX_CART_QUANTITY, q + 1))}
            disabled={isPending || isBuyNowPending || quantity >= MAX_CART_QUANTITY}
            className={cn(STEP_BUTTON)}
          >
            +
          </button>
        </div>
      )}
      <div className="flex gap-3">
        <Button
          variant="primary"
          onClick={handleClick}
          loading={isPending}
          disabled={!available}
          className="flex-1 rounded-xl py-4 text-body-l"
        >
          {available ? t("addToCart") : t("outOfStock")}
        </Button>
        {available && (
          <Button
            variant="secondary"
            onClick={handleBuyNow}
            loading={isBuyNowPending}
            disabled={isPending || isBuyNowPending}
            className="flex-1 rounded-xl py-4 text-body-l"
          >
            {t("buyNow")}
          </Button>
        )}
      </div>
      <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center">
        <Toast
          isVisible={feedback?.type === "success"}
          message={t("addedToCart")}
          variant="success"
        />
        <Toast
          isVisible={feedback?.type === "error"}
          message={feedback?.type === "error" ? feedback.message : ""}
          variant="error"
        />
      </div>

      {buyNowSession && (
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setCheckoutOpen(false)}
          title={checkoutT("heading")}
          closeLabel={t("closeCheckoutModalLabel")}
        >
          <CheckoutForm
            cities={buyNowSession.cities}
            initialCart={buyNowSession.cart}
            paymentMethods={buyNowSession.paymentMethods}
            bankTransferDetails={buyNowSession.bankTransferDetails}
          />
        </CheckoutModal>
      )}
    </div>
  );
}
