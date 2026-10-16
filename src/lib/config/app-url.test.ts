import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicAppUrl } from "@/lib/config/app-url";

const originalUrl = process.env.NEXT_PUBLIC_APP_URL;
afterEach(() => {
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalUrl;
  vi.unstubAllEnvs();
});

describe("getPublicAppUrl", () => {
  it("normalizes a configured HTTPS origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://hub.example.org/";
    expect(getPublicAppUrl()).toBe("https://hub.example.org");
  });

  it("rejects missing and malformed origins", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_APP_URL = " ";
    expect(getPublicAppUrl()).toBeNull();
    process.env.NEXT_PUBLIC_APP_URL = "javascript:alert(1)";
    expect(getPublicAppUrl()).toBeNull();
  });

  it("rejects insecure non-local origins", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://hub.example.org";
    expect(getPublicAppUrl()).toBeNull();
  });
});
