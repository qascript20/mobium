export type MobilePlatform = "android" | "ios";
export type DeviceKind = "real" | "simulator" | "emulator";
export type DeviceState = "available" | "booted" | "offline" | "unknown";

export type MobileDevice = {
  id: string;
  platform: MobilePlatform;
  name: string;
  state: DeviceState;
  kind: DeviceKind;
  osVersion?: string;
  apiLevel?: number;
  model?: string;
  manufacturer?: string;
  appiumAutomationName: "UiAutomator2" | "XCUITest";
};

export type DiscoveryResult = {
  devices: MobileDevice[];
  warnings: string[];
};
