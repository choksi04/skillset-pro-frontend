import { describe, it, expect } from "vitest";
import { getManagerDomainIds } from "./managerScope";

const domains = [
  { id: "d1", domain_lead_id: "lead" },
  { id: "d2", domain_lead_id: "other" },
];

describe("getManagerDomainIds", () => {
  it("non-lead manager sees their home domain", () => {
    expect([...getManagerDomainIds({ id: "m", domain_id: "d2" }, domains)]).toEqual(["d2"]);
  });
  it("domain lead sees led domain plus home domain", () => {
    expect([...getManagerDomainIds({ id: "lead", domain_id: "d2" }, domains)].sort()).toEqual(["d1", "d2"]);
  });
  it("manager with no domain and no lead has empty scope", () => {
    expect(getManagerDomainIds({ id: "m", domain_id: null }, domains).size).toBe(0);
  });
});
