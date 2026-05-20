import { z } from "zod";
import { resolveAppId } from "./appManagement.js";

export const permissionsActionSchema = {
  action: z.enum(["get", "grant", "revoke", "set"]),
  sessionName: z.string().min(1).default("default"),
  appId: z.string().min(1).optional(),
  appPackage: z.string().min(1).optional(),
  bundleId: z.string().min(1).optional(),
  permissions: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
  permissionType: z.enum(["requested", "granted", "denied"]).default("granted"),
  permissionAction: z.enum(["grant", "revoke", "allow", "deny", "ignore", "default"]).optional(),
  target: z.enum(["pm", "appops"]).default("pm")
};

export type PermissionsActionRequest = {
  action: "get" | "grant" | "revoke" | "set";
  sessionName: string;
  appId?: string;
  appPackage?: string;
  bundleId?: string;
  permissions?: string | string[];
  permissionType: "requested" | "granted" | "denied";
  permissionAction?: "grant" | "revoke" | "allow" | "deny" | "ignore" | "default";
  target: "pm" | "appops";
};

type PermissionsDriver = {
  execute: (script: string, args?: Record<string, unknown>) => Promise<unknown>;
};

export async function performPermissionsAction(driver: PermissionsDriver, request: PermissionsActionRequest): Promise<Record<string, unknown>> {
  const appId = resolveAppId(request);

  switch (request.action) {
    case "get":
      return {
        action: request.action,
        appId,
        permissionType: request.permissionType,
        permissions: await driver.execute("mobile: getPermissions", compact({
          appPackage: appId,
          type: request.permissionType
        }))
      };
    case "grant":
    case "revoke": {
      const permissions = requirePermissions(request);
      return {
        action: request.action,
        appId,
        permissions,
        target: request.target,
        result: await driver.execute("mobile: changePermissions", compact({
          appPackage: appId,
          permissions,
          action: request.action,
          target: request.target
        }))
      };
    }
    case "set": {
      const permissions = requirePermissions(request);
      const permissionAction = requirePermissionAction(request);
      return {
        action: request.action,
        appId,
        permissions,
        permissionAction,
        target: request.target,
        result: await driver.execute("mobile: changePermissions", compact({
          appPackage: appId,
          permissions,
          action: permissionAction,
          target: request.target
        }))
      };
    }
  }
}

function requirePermissions(request: PermissionsActionRequest): string | string[] {
  if (request.permissions === undefined || (Array.isArray(request.permissions) && request.permissions.length === 0)) {
    throw new Error(`${request.action} requires permissions.`);
  }
  return request.permissions;
}

function requirePermissionAction(request: PermissionsActionRequest): NonNullable<PermissionsActionRequest["permissionAction"]> {
  if (!request.permissionAction) {
    throw new Error("set requires permissionAction.");
  }
  return request.permissionAction;
}

function compact(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
