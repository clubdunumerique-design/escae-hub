import { describe, expect, it } from "vitest";
import { studentMatriculeSchema } from "./auth";

describe("studentMatriculeSchema", () => {
  it("accepts a matricule in the official format", () => {
    expect(studentMatriculeSchema.parse("ETU-2026-0210")).toBe("ETU-2026-0210");
  });

  it("normalizes typographic dashes and accidental spaces", () => {
    expect(studentMatriculeSchema.parse(" etu‑2026 – 0210 ")).toBe("ETU-2026-0210");
  });

  it("rejects matricules that do not match the official format", () => {
    expect(studentMatriculeSchema.safeParse("ETU-26-0210").success).toBe(false);
  });
});
