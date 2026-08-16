import { describe, expect, it } from "vitest";
import {
  can,
  canClaimMemberThread,
  canMessageAnyMember,
  canMessageMember,
  canViewMemberThread,
  demoAccessProfiles,
  visibleKpiGroups
} from "./authz";

const employee = demoAccessProfiles.find((profile) => profile.role === "employee")!;
const manager = demoAccessProfiles.find((profile) => profile.role === "department-manager")!;
const owner = demoAccessProfiles.find((profile) => profile.role === "owner")!;
const admin = demoAccessProfiles.find((profile) => profile.role === "admin")!;

describe("can()", () => {
  it("does not treat kpi:view:all as a superuser grant", () => {
    expect(can(owner, "kpi:view:all")).toBe(true);
    expect(can(owner, "kpi:view:labor")).toBe(true);
    expect(can(owner, "users:manage")).toBe(true);
    expect(can({ ...owner, permissions: ["kpi:view:all"] }, "kpi:view:labor")).toBe(true);
    expect(can({ ...owner, permissions: ["kpi:view:all"] }, "users:manage")).toBe(false);
    expect(can({ ...owner, permissions: ["kpi:view:all"] }, "member:message")).toBe(false);
  });

  it("still exposes every KPI group when kpi:view:all is present", () => {
    expect(visibleKpiGroups(owner).map((group) => group.id)).toEqual([
      "pro-shop",
      "fnb",
      "membership",
      "finance",
      "labor"
    ]);
  });
});

describe("member thread access", () => {
  it("lets owners and admins open or text any member", () => {
    expect(canMessageAnyMember(admin)).toBe(true);
    expect(canMessageAnyMember(owner)).toBe(true);
    expect(canViewMemberThread(admin, [])).toBe(true);
    expect(canMessageMember(owner, [])).toBe(true);
  });

  it("lets managers view any thread but not text until assigned", () => {
    expect(canClaimMemberThread(manager)).toBe(true);
    expect(canViewMemberThread(manager, [])).toBe(true);
    expect(canMessageMember(manager, [])).toBe(false);
    expect(canMessageMember(manager, ["mgr-1"], "mgr-1")).toBe(true);
  });

  it("keeps employees off unassigned member threads", () => {
    expect(canViewMemberThread(employee, [])).toBe(false);
    expect(canMessageMember(employee, [])).toBe(false);
    expect(canViewMemberThread(employee, ["emp-1"], "emp-1")).toBe(true);
    expect(canMessageMember(employee, ["emp-1"], "emp-1")).toBe(true);
  });
});
