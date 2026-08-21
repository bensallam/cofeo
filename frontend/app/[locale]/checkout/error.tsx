"use client";

import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";

export default function CheckoutError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("Checkout");
  const catalogueT = useTranslations("Catalogue");

  return (
    <Section>
      <Container>
        <ErrorState
          title={t("errorTitle")}
          description={t("errorDescription")}
          action={
            <Button variant="secondary" onClick={reset}>
              {catalogueT("retry")}
            </Button>
          }
        />
      </Container>
    </Section>
  );
}
