import { describe, it, expect } from "vitest";
import { appVersionLabel } from "@/lib/version";

describe("appVersionLabel", () => {
  it("appends the build number in brackets", () => {
    expect(appVersionLabel("1.3.0", "202609061442")).toBe(
      "1.3.0 (202609061442)",
    );
  });

  it("shows the bare version when no build is known", () => {
    expect(appVersionLabel("1.3.0", "0")).toBe("1.3.0");
    expect(appVersionLabel("1.3.0", "")).toBe("1.3.0");
  });
});
