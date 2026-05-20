import { z } from "zod";

export const appActionSchema = {
  action: z.enum(["install", "remove", "activate", "terminate", "state", "background", "reset"]),
  sessionName: z.string().min(1).default("default"),
  app: z.string().min(1).optional(),
  appId: z.string().min(1).optional(),
  appPackage: z.string().min(1).optional(),
  bundleId: z.string().min(1).optional(),
  seconds: z.number().int().default(0)
};

export type AppActionRequest = {
  action: "install" | "remove" | "activate" | "terminate" | "state" | "background" | "reset";
  sessionName: string;
  app?: string;
  appId?: string;
  appPackage?: string;
  bundleId?: string;
  seconds: number;
};

type AppDriver = {
  execute: (script: string, args?: Record<string, unknown>) => Promise<unknown>;
  background?: (seconds: number | null) => Promise<unknown>;
};

export async function performAppAction(driver: AppDriver, request: AppActionRequest): Promise<Record<string, unknown>> {
  const appId = resolveAppId(request);

  switch (request.action) {
    case "install":
      if (!request.app) {
        throw new Error("App install requires app.");
      }
      return {
        action: request.action,
        result: await driver.execute("mobile: installApp", { appPath: request.app })
      };
    case "remove":
      requireAppId(request.action, appId);
      return {
        action: request.action,
        appId,
        result: await driver.execute("mobile: removeApp", { appId })
      };
    case "activate":
      requireAppId(request.action, appId);
      return {
        action: request.action,
        appId,
        result: await driver.execute("mobile: activateApp", { appId })
      };
    case "terminate":
      requireAppId(request.action, appId);
      return {
        action: request.action,
        appId,
        result: await driver.execute("mobile: terminateApp", { appId })
      };
    case "state":
      requireAppId(request.action, appId);
      return {
        action: request.action,
        appId,
        state: await driver.execute("mobile: queryAppState", { appId })
      };
    case "background":
      return {
        action: request.action,
        seconds: request.seconds,
        result: driver.background
          ? await driver.background(request.seconds)
          : await driver.execute("mobile: backgroundApp", { seconds: request.seconds })
      };
    case "reset":
      requireAppId(request.action, appId);
      await driver.execute("mobile: terminateApp", { appId });
      await driver.execute("mobile: clearApp", { appId });
      return {
        action: request.action,
        appId,
        result: await driver.execute("mobile: activateApp", { appId })
      };
  }
}

export function resolveAppId(request: Pick<AppActionRequest, "appId" | "appPackage" | "bundleId">): string | undefined {
  return request.appId ?? request.appPackage ?? request.bundleId;
}

function requireAppId(action: string, appId: string | undefined): asserts appId is string {
  if (!appId) {
    throw new Error(`App ${action} requires appId, appPackage, or bundleId.`);
  }
}
