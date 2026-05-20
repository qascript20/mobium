import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MobiumConfig } from "../../config.js";
import { discoverDevices } from "../../devices/discover.js";
import { getDeviceInfo } from "../../devices/info.js";
import { asTextContent } from "./format.js";

const discoverPlatformSchema = z.enum(["android", "ios", "both"]).default("both");
export type DiscoverPlatform = z.infer<typeof discoverPlatformSchema>;

export function registerDeviceTools(server: McpServer, config: MobiumConfig): void {
  server.tool(
    "mobile_discover_devices",
    "Discover connected mobile devices. Pass platform=android or platform=ios to scan one platform; defaults to both.",
    {
      platform: discoverPlatformSchema
    },
    async ({ platform }) => {
      const result = await discoverDevices(resolveDiscoveryPlatforms(config, platform));
      return asTextContent(result);
    }
  );

  server.tool(
    "mobile_device_info",
    "Return detailed metadata for one discovered Android or iOS device.",
    {
      deviceId: z.string().min(1)
    },
    async ({ deviceId }) => {
      const result = await getDeviceInfo({
        android: config.capabilities.android,
        ios: config.capabilities.ios,
        deviceId
      });
      return asTextContent(result);
    }
  );
}

export function resolveDiscoveryPlatforms(
  config: Pick<MobiumConfig, "capabilities">,
  platform: DiscoverPlatform = "both"
): { android: boolean; ios: boolean } {
  return {
    android: config.capabilities.android && (platform === "android" || platform === "both"),
    ios: config.capabilities.ios && (platform === "ios" || platform === "both")
  };
}
