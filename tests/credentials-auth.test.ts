import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { loginSchema, registerSchema } from "@/lib/auth-schemas";

describe("Credentials Auth Validation & Password Hashing", () => {
  describe("registerSchema", () => {
    it("validates valid registration inputs", () => {
      const valid = {
        name: "Jane Doe",
        email: "jane@example.com",
        password: "supersecret123",
      };
      const result = registerSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects passwords shorter than 8 characters", () => {
      const invalid = {
        name: "Jane Doe",
        email: "jane@example.com",
        password: "short",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("at least 8 characters");
      }
    });

    it("rejects invalid email formats", () => {
      const invalid = {
        name: "Jane Doe",
        email: "not-an-email",
        password: "supersecret123",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("valid email");
      }
    });

    it("rejects empty names", () => {
      const invalid = {
        name: " ",
        email: "jane@example.com",
        password: "supersecret123",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("validates valid login input", () => {
      const valid = {
        email: "jane@example.com",
        password: "anypassword",
      };
      const result = loginSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects empty password", () => {
      const invalid = {
        email: "jane@example.com",
        password: "",
      };
      const result = loginSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("Password Hashing & Verification", () => {
    it("hashes password and verifies match correctly", async () => {
      const password = "mySecurePassword!123";
      const hash = await bcrypt.hash(password, 10);

      expect(hash).not.toBe(password);
      expect(await bcrypt.compare(password, hash)).toBe(true);
      expect(await bcrypt.compare("wrongpassword", hash)).toBe(false);
    });
  });
});
