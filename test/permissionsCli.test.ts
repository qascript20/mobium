import { describe, expect, it } from "vitest";
import { parsePermissionsArgs } from "../src/cli/permissions.js";

describe("parsePermissionsArgs", () => {
  it("parses get permissions", () => {
    expect(parsePermissionsArgs([
      "--action",
      "get",
      "--app-package",
      "com.example",
      "--type",
      "requested"
    ])).toEqual(expect.objectContaining({
      action: "get",
      appPackage: "com.example",
      permissionType: "requested",
      target: "pm"
    }));
  });

  it("parses comma-separated permissions", () => {
    expect(parsePermissionsArgs([
      "--action",
      "grant",
      "--app-package",
      "com.example",
      "--permissions",
      "android.permission.CAMERA,android.permission.POST_NOTIFICATIONS"
    ])).toEqual(expect.objectContaining({
      action: "grant",
      permissions: ["android.permission.CAMERA", "android.permission.POST_NOTIFICATIONS"]
    }));
  });

  it("parses appops set options", () => {
    expect(parsePermissionsArgs([
      "--action",
      "set",
      "--app-package",
      "com.example",
      "--permissions",
      "ACCESS_NOTIFICATIONS",
      "--permission-action",
      "allow",
      "--target",
      "appops"
    ])).toEqual(expect.objectContaining({
      action: "set",
      permissions: ["ACCESS_NOTIFICATIONS"],
      permissionAction: "allow",
      target: "appops"
    }));
  });

  it("rejects invalid actions", () => {
    expect(() => parsePermissionsArgs(["--action", "dance"])).toThrow("permissions requires --action");
  });
});
