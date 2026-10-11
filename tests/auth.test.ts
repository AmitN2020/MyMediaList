import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { authConfig } from "@/auth.config";

describe("Authentication & Route Protection", () => {
  const authorized = authConfig.callbacks?.authorized;

  it("has Google provider configured", () => {
    expect(authConfig.providers).toBeDefined();
    expect(authConfig.providers.length).toBeGreaterThan(0);
  });

  it("has custom signIn page configured to /login", () => {
    expect(authConfig.pages?.signIn).toBe("/login");
  });

  it("denies unauthenticated requests to /library", () => {
    if (!authorized) throw new Error("authorized callback is missing");

    const req = new NextRequest("http://localhost:3000/library");
    const result = authorized({
      auth: null,
      request: req,
    });

    expect(result).toBe(false);
  });

  it("denies unauthenticated requests to /discover and /search", () => {
    if (!authorized) throw new Error("authorized callback is missing");

    const discoverReq = new NextRequest("http://localhost:3000/discover");
    const discoverResult = authorized({
      auth: null,
      request: discoverReq,
    });
    expect(discoverResult).toBe(false);

    const searchReq = new NextRequest("http://localhost:3000/search");
    const searchResult = authorized({
      auth: null,
      request: searchReq,
    });
    expect(searchResult).toBe(false);
  });

  it("allows authenticated requests to /library", () => {
    if (!authorized) throw new Error("authorized callback is missing");

    const mockSession = {
      user: {
        id: "user-123",
        name: "Test User",
        email: "test@example.com",
      },
      expires: new Date(Date.now() + 3600000).toISOString(),
    };

    const req = new NextRequest("http://localhost:3000/library");
    const result = authorized({
      auth: mockSession,
      request: req,
    });

    expect(result).toBe(true);
  });

  it("allows unauthenticated access to the public home page", () => {
    if (!authorized) throw new Error("authorized callback is missing");

    const req = new NextRequest("http://localhost:3000/");
    const result = authorized({
      auth: null,
      request: req,
    });

    expect(result).toBe(true);
  });
});
