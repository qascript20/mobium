import { describe, expect, it } from "vitest";
import { buildCapabilities } from "../src/webdriver/capabilities.js";

describe("buildCapabilities", () => {
  it("builds Android UiAutomator2 capabilities", () => {
    expect(buildCapabilities({
      sessionName: "default",
      platform: "android",
      deviceId: "emulator-5554",
      appPackage: "com.example",
      appActivity: ".MainActivity",
      noReset: true,
      fullReset: false,
      capabilities: {}
    })).toEqual(expect.objectContaining({
      platformName: "Android",
      "appium:automationName": "UiAutomator2",
      "appium:udid": "emulator-5554",
      "appium:appPackage": "com.example",
      "appium:appActivity": ".MainActivity",
      "appium:noReset": true
    }));
  });

  it("builds iOS XCUITest capabilities", () => {
    expect(buildCapabilities({
      sessionName: "default",
      platform: "ios",
      deviceId: "ABC-123",
      bundleId: "com.example.app",
      noReset: false,
      fullReset: false,
      capabilities: { "appium:newCommandTimeout": 60 }
    })).toEqual(expect.objectContaining({
      platformName: "iOS",
      "appium:automationName": "XCUITest",
      "appium:bundleId": "com.example.app",
      "appium:newCommandTimeout": 60
    }));
  });
});
