import { describe, it, expect } from "vitest";
import { getNotStartedMembers } from "./managerScope";

const members = [
  { id: "a", domain_id: "devops" },
  { id: "b", domain_id: "devops" },
  { id: "c", domain_id: "frontend" },
  { id: "d", domain_id: null },
];

describe("getNotStartedMembers", () => {
  it("manager sees in-scope members without a registry", () => {
    expect(getNotStartedMembers(members, new Set(["devops"]), new Set(["b"])).map((m) => m.id)).toEqual(["a"]);
  });
  it("manager never sees members outside scope", () => {
    expect(getNotStartedMembers(members, new Set(["devops"]), new Set()).map((m) => m.id)).toEqual(["a", "b"]);
  });
  it("admin (null scope) sees all domain members, not unassigned users", () => {
    expect(getNotStartedMembers(members, null, new Set()).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });
  it("empty manager scope yields nobody", () => {
    expect(getNotStartedMembers(members, new Set(), new Set())).toEqual([]);
  });
});
