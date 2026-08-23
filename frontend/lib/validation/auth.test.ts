import { describe, expect, it } from "vitest";
import { loginInputSchema, registerInputSchema } from "./auth";

const VALID_REGISTER = {
  firstName: "Test",
  lastName: "Customer",
  email: "test.customer@example.com",
  password: "GoodPass123",
  confirmPassword: "GoodPass123",
};

describe("registerInputSchema", () => {
  it("accepts a valid registration", () => {
    expect(registerInputSchema.safeParse(VALID_REGISTER).success).toBe(true);
  });

  it("normalizes email to lowercase and trims it", () => {
    const result = registerInputSchema.safeParse({ ...VALID_REGISTER, email: "  Test.Customer@Example.com  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("test.customer@example.com");
  });

  it("rejects an invalid email", () => {
    expect(registerInputSchema.safeParse({ ...VALID_REGISTER, email: "not-an-email" }).success).toBe(false);
  });

  it.each(["short1", "alllettersnodigits", "12345678", ""])("rejects a weak password: %s", (password) => {
    expect(
      registerInputSchema.safeParse({ ...VALID_REGISTER, password, confirmPassword: password }).success,
    ).toBe(false);
  });

  it("rejects a password/confirmPassword mismatch", () => {
    const result = registerInputSchema.safeParse({ ...VALID_REGISTER, confirmPassword: "SomethingElse123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("confirmPassword"))).toBe(true);
    }
  });

  it("rejects missing required fields", () => {
    expect(registerInputSchema.safeParse({ ...VALID_REGISTER, firstName: "" }).success).toBe(false);
    expect(registerInputSchema.safeParse({ ...VALID_REGISTER, lastName: "" }).success).toBe(false);
  });
});

describe("loginInputSchema", () => {
  it("accepts a valid login", () => {
    expect(loginInputSchema.safeParse({ email: "test@example.com", password: "anything" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(loginInputSchema.safeParse({ email: "not-an-email", password: "anything" }).success).toBe(false);
  });

  it("rejects missing credentials", () => {
    expect(loginInputSchema.safeParse({ email: "", password: "" }).success).toBe(false);
    expect(loginInputSchema.safeParse({ email: "test@example.com", password: "" }).success).toBe(false);
  });

  it("does not enforce password-strength rules on login (an old, weaker password must still work)", () => {
    expect(loginInputSchema.safeParse({ email: "test@example.com", password: "weak" }).success).toBe(true);
  });
});
