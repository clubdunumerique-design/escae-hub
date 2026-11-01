import { describe, expect, it } from "vitest";
import { accessRoleHome, resolveAccessRole } from "@/lib/auth/resolve-access-role";

describe("resolveAccessRole", () => {
  it("uses an accepted mandate even if the profile still says student", () => {
    expect(resolveAccessRole("student", "admin")).toBe("admin");
  });

  it("does not turn a stored admin profile into an authorized admin", () => {
    expect(resolveAccessRole("admin", null)).toBe("inactive_admin");
    expect(resolveAccessRole("admin", "inactive_admin")).toBe("inactive_admin");
    expect(accessRoleHome(resolveAccessRole("admin", null))).toBe("/admin/access-pending");
  });

  it("keeps an ordinary student in the student area", () => {
    expect(resolveAccessRole("student", null)).toBe("student");
    expect(accessRoleHome(resolveAccessRole("student", null))).toBe("/dashboard");
  });
});
