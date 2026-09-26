import { describe, expect, it } from "vitest";
import { guestUnionId } from "./identity";
import { sanitiseName } from "./identity";

describe("guest identities", () => {
  it("is stable for the same name", () => {
    expect(guestUnionId("Kira")).toBe(guestUnionId("Kira"));
  });

  it("ignores case and surrounding whitespace", () => {
    expect(guestUnionId("  kira  ")).toBe(guestUnionId("Kira"));
    expect(guestUnionId("Kira  Ito")).toBe(guestUnionId("kira ito"));
  });

  it("differs for different names", () => {
    expect(guestUnionId("Kira")).not.toBe(guestUnionId("Kira2"));
  });

  it("is namespaced so it can never collide with a provider unionId", () => {
    expect(guestUnionId("Kira").startsWith("guest:")).toBe(true);
  });
});

describe("sanitiseName", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitiseName("  Kira   Ito ")).toBe("Kira Ito");
  });

  it("strips control characters and angle brackets", () => {
    expect(sanitiseName("Ki\u0000ra<script>")).toBe("Kirascript");
  });

  it("caps length", () => {
    expect(sanitiseName("x".repeat(100)).length).toBe(24);
  });

  it("rejects names that are empty after sanitising", () => {
    expect(sanitiseName("   ")).toBe("");
    expect(sanitiseName("<>")).toBe("");
  });
});
