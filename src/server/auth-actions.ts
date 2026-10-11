"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { registerSchema, RegisterInput } from "@/lib/auth-schemas";

export async function registerUser(rawInput: RegisterInput) {
  const parsed = registerSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message || "Invalid input data",
    };
  }

  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  try {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (existing) {
      return { error: "An account with this email already exists" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email: normalizedEmail,
        password: hashedPassword,
      })
      .returning({ id: users.id });

    return { success: true, userId: newUser.id };
  } catch (error) {
    console.error("Failed to register user:", error);
    return { error: "Failed to create account. Please try again." };
  }
}
