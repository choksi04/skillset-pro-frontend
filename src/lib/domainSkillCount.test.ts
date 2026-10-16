import { describe, it, expect } from "vitest";
import { eligibleDomainSkillIds } from "./domainSkillCount";

const skills = [
  { id: "a", status: "active" },
  { id: "b", status: "active" },
  { id: "c", status: "disabled" },
];

describe("eligibleDomainSkillIds", () => {
  it("counts only active linked skills of that domain", () => {
    const m = [
      { domain_id: "d", skill_id: "a" }, { domain_id: "d", skill_id: "c" },
      { domain_id: "x", skill_id: "b" },
    ];
    expect([...eligibleDomainSkillIds("d", m, skills)]).toEqual(["a"]);
  });
  it("ignores links to deleted (unloaded) skills and duplicates", () => {
    const m = [{ domain_id: "d", skill_id: "a" }, { domain_id: "d", skill_id: "a" }, { domain_id: "d", skill_id: "gone" }];
    expect(eligibleDomainSkillIds("d", m, skills).size).toBe(1);
  });
  it("unlinked skills are not counted even if active", () => {
    expect(eligibleDomainSkillIds("d", [], skills).size).toBe(0);
  });
});
