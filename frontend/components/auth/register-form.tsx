"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { registerAction } from "@/lib/actions/auth-actions";
import { registerInputSchema } from "@/lib/validation/auth";
import type { AuthErrorCode } from "@/lib/actions/auth-actions";

type FieldErrors = Partial<Record<"firstName" | "lastName" | "email" | "password" | "confirmPassword", string>>;

const FIELD_IDS = {
  firstName: "register-first-name",
  lastName: "register-last-name",
  email: "register-email",
  password: "register-password",
  confirmPassword: "register-confirm-password",
} as const;
const FIELD_ORDER = ["firstName", "lastName", "email", "password", "confirmPassword"] as const;

export function RegisterForm() {
  const t = useTranslations("Auth");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [errorCode, setErrorCode] = React.useState<AuthErrorCode | null>(null);
  const [succeeded, setSucceeded] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  function fieldErrorMessage(key: keyof FieldErrors): string {
    if (key === "confirmPassword") return t("passwordMismatch");
    return t("requiredField");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isPending) return;

    const parsed = registerInputSchema.safeParse({ firstName, lastName, email, password, confirmPassword });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && key in FIELD_IDS) {
          nextErrors[key as keyof FieldErrors] ??= fieldErrorMessage(key as keyof FieldErrors);
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
      const result = await registerAction(parsed.data);
      if (result.ok) {
        setSucceeded(true);
      } else {
        setErrorCode(result.code);
      }
    });
  }

  if (succeeded) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div
          className="flex size-14 items-center justify-center rounded-full bg-success-surface text-heading-s text-success"
          aria-hidden="true"
        >
          ✓
        </div>
        <p className="text-body text-text-primary">{t("accountCreated")}</p>
        <Button href="/login" className="w-full rounded-xl py-3">
          {t("loginLink")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Heading level={1} size="l" className="text-center">
        {t("registerTitle")}
      </Heading>

      {errorCode && (
        <p role="alert" className="text-body-s text-error">
          {t(errorCode === "EMAIL_ALREADY_EXISTS" ? "emailAlreadyExists" : errorCode === "RATE_LIMITED" ? "rateLimited" : "serverError")}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id={FIELD_IDS.firstName}
          label={t("firstNameLabel")}
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          error={fieldErrors.firstName}
          autoComplete="given-name"
          required
        />
        <Input
          id={FIELD_IDS.lastName}
          label={t("lastNameLabel")}
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          error={fieldErrors.lastName}
          autoComplete="family-name"
          required
        />
      </div>
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
        hint={fieldErrors.password ? undefined : t("passwordRequirements")}
        autoComplete="new-password"
        required
      />
      <Input
        id={FIELD_IDS.confirmPassword}
        label={t("confirmPasswordLabel")}
        type="password"
        dir="ltr"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        error={fieldErrors.confirmPassword}
        autoComplete="new-password"
        required
      />

      <Button type="submit" loading={isPending} className="w-full rounded-xl py-3">
        {t("registerButton")}
      </Button>

      <p className="text-center text-body-s text-text-secondary">
        {t("alreadyHaveAccount")}{" "}
        <Link href="/login" className="font-medium text-text-primary underline underline-offset-2">
          {t("loginLink")}
        </Link>
      </p>
    </form>
  );
}
