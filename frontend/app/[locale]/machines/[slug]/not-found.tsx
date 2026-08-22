import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default async function ProductNotFound() {
  const t = await getTranslations("Product");

  return (
    <Section tone="dark">
      <Container>
        <EmptyState
          title={t("notFoundTitle")}
          description={t("notFoundDescription")}
          action={
            <Button variant="secondary" href="/machines">
              {t("backToCatalogue")}
            </Button>
          }
        />
      </Container>
    </Section>
  );
}
