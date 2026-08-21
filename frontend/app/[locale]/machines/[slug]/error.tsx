"use client";

import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";

/**
 * Backstop for unexpected failures — the expected AppError cases
 * (product not found, out of stock) never reach here; not-found.tsx
 * and normal page rendering handle those respectively.
 */
export default function ProductError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("Product");
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
