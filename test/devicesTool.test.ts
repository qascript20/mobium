import { describe, expect, it } from "vitest";
import type { MobiumConfig } from "../src/config.js";
import { resolveDiscoveryPlatforms } from "../src/server/tools/devices.js";

const baseConfig = {
  capabilities: {
    android: true,
    ios: true
  }
} as MobiumConfig;

describe("resolveDiscoveryPlatforms", () => {
  it("defaults to discovering both platforms", () => {
    expect(resolveDiscoveryPlatforms(baseConfig)).toEqual({
      android: true,
      ios: true
    });
  });

  it("discovers only Android when requested", () => {
    expect(resolveDiscoveryPlatforms(baseConfig, "android")).toEqual({
      android: true,
      ios: false
    });
  });

  it("discovers only iOS when requested", () => {
    expect(resolveDiscoveryPlatforms(baseConfig, "ios")).toEqual({
      android: false,
      ios: true
    });
  });

  it("respects disabled platform capabilities", () => {
    const config = {
      capabilities: {
        android: false,
        ios: true
      }
    } as MobiumConfig;

    expect(resolveDiscoveryPlatforms(config, "both")).toEqual({
      android: false,
      ios: true
    });
    expect(resolveDiscoveryPlatforms(config, "android")).toEqual({
      android: false,
      ios: false
    });
  });
});
