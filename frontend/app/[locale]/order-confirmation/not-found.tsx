import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default async function OrderConfirmationNotFound() {
  const t = await getTranslations("Checkout.orderConfirmation");
  const catalogueT = await getTranslations("Checkout");

  return (
    <Section>
      <Container>
        <EmptyState
          title={t("notFoundTitle")}
          description={t("notFoundDescription")}
          action={
            <Button variant="secondary" href="/machines">
              {catalogueT("backToCatalogue")}
            </Button>
          }
        />
      </Container>
    </Section>
  );
}
