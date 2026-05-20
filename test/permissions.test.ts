import { describe, expect, it, vi } from "vitest";
import { performPermissionsAction } from "../src/webdriver/permissions.js";

describe("permissions actions", () => {
  it("gets app permissions", async () => {
    const execute = vi.fn(async () => ["android.permission.CAMERA"]);

    await expect(performPermissionsAction({ execute }, {
      action: "get",
      sessionName: "default",
      appPackage: "com.example",
      permissionType: "granted",
      target: "pm"
    })).resolves.toEqual({
      action: "get",
      appId: "com.example",
      permissionType: "granted",
      permissions: ["android.permission.CAMERA"]
    });

    expect(execute).toHaveBeenCalledWith("mobile: getPermissions", {
      appPackage: "com.example",
      type: "granted"
    });
  });

  it("grants permissions through pm target", async () => {
    const execute = vi.fn(async () => true);

    await expect(performPermissionsAction({ execute }, {
      action: "grant",
      sessionName: "default",
      appPackage: "com.example",
      permissions: ["android.permission.CAMERA"],
      permissionType: "granted",
      target: "pm"
    })).resolves.toEqual({
      action: "grant",
      appId: "com.example",
      permissions: ["android.permission.CAMERA"],
      target: "pm",
      result: true
    });

    expect(execute).toHaveBeenCalledWith("mobile: changePermissions", {
      appPackage: "com.example",
      permissions: ["android.permission.CAMERA"],
      action: "grant",
      target: "pm"
    });
  });

  it("sets appops permissions with explicit permission action", async () => {
    const execute = vi.fn(async () => true);

    await performPermissionsAction({ execute }, {
      action: "set",
      sessionName: "default",
      appPackage: "com.example",
      permissions: "ACCESS_NOTIFICATIONS",
      permissionType: "granted",
      permissionAction: "allow",
      target: "appops"
    });

    expect(execute).toHaveBeenCalledWith("mobile: changePermissions", {
      appPackage: "com.example",
      permissions: "ACCESS_NOTIFICATIONS",
      action: "allow",
      target: "appops"
    });
  });

  it("requires permissions when changing permissions", async () => {
    await expect(performPermissionsAction({ execute: vi.fn() }, {
      action: "revoke",
      sessionName: "default",
      appPackage: "com.example",
      permissionType: "granted",
      target: "pm"
    })).rejects.toThrow("requires permissions");
  });
});
