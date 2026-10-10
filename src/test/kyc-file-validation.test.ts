import { describe, expect, it } from "vitest";
import { validateKycFile } from "@/components/kyc/kycSteps";

describe("validateKycFile", () => {
  it("aceita JPG de 2 MB", () => expect(validateKycFile({ type: "image/jpeg", size: 2 * 1024 * 1024 })).toBeNull());
  it("recusa arquivo acima de 10 MB", () => expect(validateKycFile({ type: "image/png", size: 11 * 1024 * 1024 })).toMatch(/10 MB/));
  it("recusa PDF", () => expect(validateKycFile({ type: "application/pdf", size: 500_000 })).toMatch(/Formato/));
});
