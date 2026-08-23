"use client";

import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";

/**
 * Catches unexpected runtime errors in this route segment (not the
 * AppError cases already handled inline in page.tsx — those render
 * ErrorState directly without ever throwing). This is the fail-closed
 * backstop for anything else.
 */
export default function MachinesError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("Catalogue");

  return (
    <Section>
      <Container>
        <ErrorState
          title={t("errorTitle")}
          description={t("errorDescription")}
          action={
            <Button variant="secondary" onClick={reset}>
              {t("retry")}
            </Button>
          }
        />
      </Container>
    </Section>
  );
}
