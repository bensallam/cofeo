import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Applies to any `notFound()` thrown within this route segment,
 * including /account/orders/[id] — a nonexistent order id and an
 * order that exists but belongs to someone else both land here,
 * deliberately indistinguishable (see that page's own docblock).
 */
export default async function AccountOrdersNotFound() {
  const t = await getTranslations("Account");

  return (
    <Section>
      <Container>
        <EmptyState
          title={t("orderNotFoundTitle")}
          description={t("orderNotFoundDescription")}
          action={
            <Button variant="secondary" href="/account/orders">
              {t("backToOrders")}
            </Button>
          }
        />
      </Container>
    </Section>
  );
}
