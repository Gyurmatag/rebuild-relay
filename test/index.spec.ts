import { describe, it, expect } from "vitest";

import { incidentInputSchema } from "../src/lib/incident-schema";
import { classifyDamage, classifySeverity } from "../src/lib/triage";
import { validateTwilioFormSignature } from "../src/lib/twilio-sign";

describe("incidentInputSchema", () => {
  it("coerces loose enum-ish values and splits string lists", () => {
    const parsed = incidentInputSchema.parse({
      callerName: "  ",
      damageType: "WATER",
      severity: "CRITICAL",
      safetyRisks: "outlet near water; sagging ceiling",
      summary: "burst pipe",
      source: "phone",
    });

    expect(parsed.callerName).toBe("Unknown caller");
    expect(parsed.damageType).toBe("water");
    expect(parsed.severity).toBe("critical");
    expect(parsed.safetyRisks).toEqual(["outlet near water", "sagging ceiling"]);
    expect(parsed.source).toBe("phone");
  });

  it("falls back to safe defaults for unknown enum values", () => {
    const parsed = incidentInputSchema.parse({ damageType: "asteroid", severity: "spicy" });
    expect(parsed.damageType).toBe("unknown");
    expect(parsed.severity).toBe("high");
  });
});

describe("triage", () => {
  it("classifies damage type from free text", () => {
    expect(classifyDamage("there is a burst pipe and water on the floor")).toBe("water");
    expect(classifyDamage("smoke and flames in the kitchen")).toBe("fire");
    expect(classifyDamage("black mold spreading on the wall")).toBe("mold");
  });

  it("escalates severity when multiple danger signals are present", () => {
    expect(classifySeverity("water is near an electrical outlet and gas smell")).toBe("critical");
    expect(classifySeverity("there is some water on the carpet")).toBe("medium");
  });
});

describe("validateTwilioFormSignature", () => {
  it("accepts a correctly signed request and rejects tampering", async () => {
    const token = "test-auth-token";
    const url = "https://relay.example.com/api/twilio/sms";
    const params = { From: "+15558675310", To: "+15017122661", Body: "pipe burst" };

    // Compute the expected signature using the same documented algorithm.
    const sortedKeys = Object.keys(params).sort();
    let data = url;
    for (const key of sortedKeys) data += key + (params as Record<string, string>)[key];
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(token),
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"],
    );
    const sigBuffer = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
    let binary = "";
    const bytes = new Uint8Array(sigBuffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const signature = btoa(binary);

    expect(await validateTwilioFormSignature(token, url, params, signature)).toBe(true);
    expect(await validateTwilioFormSignature(token, url, params, "wrong")).toBe(false);
    expect(await validateTwilioFormSignature(token, url, { ...params, Body: "x" }, signature)).toBe(false);
  });
});
