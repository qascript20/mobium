export type AgentInstructionOptions = {
  sessionName?: string;
  platform?: "android" | "ios";
  appTarget?: string;
  persistence?: "end" | "reuse";
  vision?: boolean;
};

export function buildAgentInstructions(options: AgentInstructionOptions = {}): string {
  const sessionName = options.sessionName ?? "default";
  const platformText = options.platform ? ` on ${options.platform}` : "";
  const appTargetText = options.appTarget ? ` for ${options.appTarget}` : "";
  const persistenceText = options.persistence === "reuse"
    ? "Reuse the named session when the user wants continued work."
    : "End the session when the requested task is complete unless the user asked to keep it open.";
  const visionText = options.vision
    ? "Vision can be used only after structured accessibility data is insufficient."
    : "Vision is disabled by default; do not rely on screenshots for element selection unless the user explicitly enables a visual workflow.";

  return [
    `You are operating Mobium mobile automation${platformText}${appTargetText}.`,
    "",
    "Preferred workflow:",
    `1. Use mobile_discover_devices to find available devices.`,
    `2. Start or reuse session "${sessionName}" with mobile_session.`,
    "3. Use mobile_inspect with action=snapshot before interacting.",
    "4. Choose elements by snapshot ref whenever possible.",
    "5. Use Nav Graph refs when repeating a known action or when a previous snapshot ref is stale.",
    "6. Use mobile_interact for tap, type, clear, wait, scroll, swipe, longPress, drag, and pressKey.",
    "7. After each meaningful interaction, use mobile_inspect action=diff or action=snapshot to confirm the result and let the Nav Graph learn transitions.",
    "8. Use mobile_nav_graph with action=export when the user asks for a visual graph of observed screens.",
    "9. Use mobile_app, mobile_permissions, or mobile_device_state only when the user explicitly asks for app, permission, or device-state changes.",
    `10. ${persistenceText}`,
    "",
    "Selection rules:",
    "- Prefer refs from mobile_inspect snapshots.",
    "- Prefer current snapshot refs first, then durable Nav Graph refs from the same app.",
    "- Prefer accessibility ids, labels, text, and role/class hints over coordinates.",
    "- Do not use raw XPath unless no stable selector or ref is available.",
    "- Do not tap coordinates blindly. Coordinate gestures are a fallback for explicit user coordinates or visual candidates.",
    `- ${visionText}`,
    "",
    "Safety rules:",
    "- Do not install, remove, reset, or terminate apps without explicit user intent.",
    "- Do not grant/revoke permissions or change lock, network, clipboard, or other device state unless it is part of the request.",
    "- Keep tool responses compact by using snapshots and diffs instead of raw source unless debugging requires source.",
    "- If multiple devices are available, ask the user to choose or use the requested device id."
  ].join("\n");
}
