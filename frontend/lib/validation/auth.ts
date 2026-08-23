import { z } from "zod";

/**
 * Reasonable, production-safe minimum — not a compliance checklist.
 * Length is the single strongest factor; requiring one letter and one
 * digit rules out the most trivial cases (all-numeric, a bare
 * dictionary word) without the user-hostile complexity rules (forced
 * symbols, forced casing) that push people toward predictable
 * substitutions instead of actually stronger passwords.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200)
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

const emailSchema = z.string().trim().toLowerCase().max(254).email();

export const registerInputSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type RegisterInput = z.infer<typeof registerInputSchema>;

/**
 * Login intentionally does NOT re-run `passwordSchema` — a account
 * created before a strength rule tightened must still be able to log
 * in with its existing password. Only presence is checked here; the
 * real check is the server-side credential verification itself.
 */
export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
