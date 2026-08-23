"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { loginAction } from "@/lib/actions/auth-actions";
import { loginInputSchema } from "@/lib/validation/auth";
import type { AuthErrorCode } from "@/lib/actions/auth-actions";
import type { Locale } from "@/i18n/routing";

type FieldErrors = Partial<Record<"email" | "password", string>>;

const FIELD_IDS = { email: "login-email", password: "login-password" } as const;
const FIELD_ORDER = ["email", "password"] as const;

export function LoginForm() {
  const t = useTranslations("Auth");
  const locale = useLocale() as Locale;
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [errorCode, setErrorCode] = React.useState<AuthErrorCode | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isPending) return;

    const parsed = loginInputSchema.safeParse({ email, password });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && key in FIELD_IDS) {
          nextErrors[key as keyof FieldErrors] ??= t("requiredField");
        }
      }
      setFieldErrors(nextErrors);
      const firstInvalid = FIELD_ORDER.find((key) => nextErrors[key]);
      if (firstInvalid) document.getElementById(FIELD_IDS[firstInvalid])?.focus();
      return;
    }

    setFieldErrors({});
    setErrorCode(null);
    startTransition(async () => {
      // On success this call never returns normally — loginAction
      // redirects server-side straight to /account (see its own
      // docblock). Only the failure shape is left to handle here.
      const result = await loginAction({ ...parsed.data, locale });
      setErrorCode(result.code);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Heading level={1} size="l" className="text-center">
        {t("loginTitle")}
      </Heading>

      {errorCode && (
        <p role="alert" className="text-body-s text-error">
          {t(
            errorCode === "INVALID_CREDENTIALS"
              ? "invalidCredentials"
              : errorCode === "RATE_LIMITED"
                ? "rateLimited"
                : "serverError",
          )}
        </p>
      )}

      <Input
        id={FIELD_IDS.email}
        label={t("emailLabel")}
        type="email"
        dir="ltr"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors.email}
        autoComplete="email"
        required
      />
      <Input
        id={FIELD_IDS.password}
        label={t("passwordLabel")}
        type="password"
        dir="ltr"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password}
        autoComplete="current-password"
        required
      />

      <Button type="submit" loading={isPending} className="w-full rounded-xl py-3">
        {t("loginButton")}
      </Button>

      <p className="text-center text-body-s text-text-secondary">
        {t("noAccountYet")}{" "}
        <Link href="/register" className="font-medium text-text-primary underline underline-offset-2">
          {t("createAccountLink")}
        </Link>
      </p>
    </form>
  );
}
