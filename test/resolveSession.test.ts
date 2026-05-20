import { describe, expect, it } from "vitest";
import { resolveStartSessionInput, selectDeviceForSession } from "../src/webdriver/resolveSession.js";
import type { MobileDevice } from "../src/devices/types.js";
import type { MobiumConfig } from "../src/config.js";

const androidDevice: MobileDevice = {
  id: "android-1",
  platform: "android",
  name: "Pixel",
  state: "available",
  kind: "real",
  appiumAutomationName: "UiAutomator2"
};

const iosDevice: MobileDevice = {
  id: "ios-1",
  platform: "ios",
  name: "iPhone",
  state: "available",
  kind: "simulator",
  appiumAutomationName: "XCUITest"
};

const baseConfig: MobiumConfig = {
  appium: {
    host: "127.0.0.1",
    port: 4723,
    basePath: "/",
    autoStart: true,
    command: "appium",
    args: {}
  },
  sessions: {
    defaultTimeoutMs: 10_000,
    isolated: true,
    maxSessions: 1
  },
  app: {},
  artifacts: {
    outputDir: ".mobium",
    saveScreenshots: true,
    saveSnapshots: true
  },
  capabilities: {
    vision: false,
    android: true,
    ios: true
  }
};

describe("selectDeviceForSession", () => {
  it("selects the only available device matching the platform", () => {
    expect(selectDeviceForSession({ sessionName: "default", platform: "android", noReset: false, fullReset: false, capabilities: {} }, [
      androidDevice,
      iosDevice
    ])).toBe(androidDevice);
  });

  it("selects an explicit device id and infers platform", () => {
    expect(selectDeviceForSession({ sessionName: "default", deviceId: "android-1", noReset: false, fullReset: false, capabilities: {} }, [
      androidDevice,
      iosDevice
    ])).toBe(androidDevice);
  });

  it("fails clearly when device selection is ambiguous", () => {
    expect(() => selectDeviceForSession({ sessionName: "default", noReset: false, fullReset: false, capabilities: {} }, [
      androidDevice,
      {
        ...androidDevice,
        id: "android-2",
        name: "Pixel 2"
      }
    ])).toThrow("Multiple available devices");
  });

  it("defaults to the single real connected device when simulators are also available", () => {
    expect(selectDeviceForSession({ sessionName: "default", noReset: false, fullReset: false, capabilities: {} }, [
      androidDevice,
      iosDevice,
      {
        ...iosDevice,
        id: "ios-2",
        name: "iPad"
      }
    ])).toBe(androidDevice);
  });

  it("defaults to the single booted device when no real device is connected", () => {
    const bootedIosDevice = {
      ...iosDevice,
      state: "booted" as const
    };

    expect(selectDeviceForSession({ sessionName: "default", noReset: false, fullReset: false, capabilities: {} }, [
      bootedIosDevice,
      {
        ...iosDevice,
        id: "ios-2",
        name: "iPad"
      }
    ])).toBe(bootedIosDevice);
  });

  it("applies configured app package defaults before Android Settings fallback", async () => {
    await expect(resolveStartSessionInput({
      ...baseConfig,
      app: {
        appPackage: "com.example.app",
        appActivity: ".MainActivity"
      }
    }, {
      sessionName: "default",
      platform: "android",
      deviceId: "android-1",
      noReset: false,
      fullReset: false,
      capabilities: {}
    })).resolves.toEqual(expect.objectContaining({
      input: expect.objectContaining({
        appPackage: "com.example.app",
        appActivity: ".MainActivity",
        noReset: true
      })
    }));
  });
});
