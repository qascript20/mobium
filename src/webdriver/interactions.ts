import { findSnapshotNode, parseAppiumSource, toWebdriverSelector } from "../snapshot/parseAppiumSource.js";

export type InteractionAction = "tap" | "type" | "clear" | "wait" | "pressKey" | "swipe" | "scroll" | "longPress" | "drag";

export type InteractionRequest = {
  action: InteractionAction;
  sessionName: string;
  ref?: string;
  graphRef?: string;
  fromRef?: string;
  toRef?: string;
  text?: string;
  accessibilityId?: string;
  x?: number;
  y?: number;
  toX?: number;
  toY?: number;
  key?: string;
  keycode?: number;
  timeoutMs?: number;
  durationMs?: number;
  direction?: "up" | "down" | "left" | "right";
  percent?: number;
};

type InteractionElement = {
  click: () => Promise<unknown>;
  setValue: (value: string) => Promise<unknown>;
  clearValue: () => Promise<unknown>;
  waitForExist: (options?: { timeout?: number }) => Promise<unknown>;
};

type InteractionDriver = {
  getPageSource: () => Promise<string>;
  $: (selector: string) => InteractionElement | Promise<InteractionElement>;
  action?: (type: "pointer") => PointerActionBuilder;
  execute?: (script: string, args?: Record<string, unknown>) => Promise<unknown>;
  keys?: (value: string | string[]) => Promise<unknown>;
};

type PointerActionBuilder = {
  move: (options: { x: number; y: number; duration?: number }) => PointerActionBuilder;
  down: () => PointerActionBuilder;
  up: () => PointerActionBuilder;
  pause: (duration: number) => PointerActionBuilder;
  perform: () => Promise<unknown>;
};

export type InteractionOptions = {
  resolveGraphRef?: (graphRef: string) => Promise<{ selector: string; bounds?: { x: number; y: number; width: number; height: number } } | undefined>;
  resolveStaleRef?: (ref: string) => Promise<{ selector: string; bounds?: { x: number; y: number; width: number; height: number } } | undefined>;
};

export async function performInteraction(
  driver: InteractionDriver,
  request: InteractionRequest,
  options: InteractionOptions = {}
): Promise<Record<string, unknown>> {
  switch (request.action) {
    case "tap": {
      if (request.ref || request.graphRef) {
        const { element, selector, graphRef } = await resolveElement(driver, request, options);
        await element.click();
        return withGraphRef({ action: request.action, ref: request.ref, selector }, graphRef);
      }

      const point = requirePoint(request);
      await tapPoint(driver, point.x, point.y);
      return { action: request.action, point };
    }
    case "type": {
      const text = requireText(request);
      const { element, selector, graphRef } = await resolveElement(driver, request, options);
      await element.setValue(text);
      return withGraphRef({ action: request.action, ref: request.ref, selector, textLength: text.length }, graphRef);
    }
    case "clear": {
      const { element, selector, graphRef } = await resolveElement(driver, request, options);
      await element.clearValue();
      return withGraphRef({ action: request.action, ref: request.ref, selector }, graphRef);
    }
    case "wait": {
      const { element, selector, graphRef } = await resolveWaitElement(driver, request, options);
      await element.waitForExist({ timeout: request.timeoutMs ?? 10000 });
      return withGraphRef({ action: request.action, ref: request.ref, selector, timeoutMs: request.timeoutMs ?? 10000 }, graphRef);
    }
    case "pressKey": {
      if (request.keycode !== undefined) {
        if (!driver.execute) {
          throw new Error("pressKey with keycode requires driver.execute.");
        }
        return {
          action: request.action,
          keycode: request.keycode,
          result: await driver.execute("mobile: pressKey", { keycode: request.keycode })
        };
      }

      if (!request.key) {
        throw new Error("pressKey requires key or keycode.");
      }
      if (!driver.keys) {
        throw new Error("pressKey with key requires driver.keys.");
      }
      return { action: request.action, key: request.key, result: await driver.keys(request.key) };
    }
    case "swipe": {
      const direction = request.direction ?? "up";
      if (!driver.execute) {
        throw new Error("swipe requires driver.execute.");
      }
      return {
        action: request.action,
        direction,
        percent: request.percent ?? 0.75,
        result: await driver.execute("mobile: swipeGesture", {
          direction,
          percent: request.percent ?? 0.75
        })
      };
    }
    case "scroll": {
      const direction = request.direction ?? "down";
      if (!driver.execute) {
        throw new Error("scroll requires driver.execute.");
      }
      return {
        action: request.action,
        direction,
        percent: request.percent ?? 0.75,
        result: await driver.execute("mobile: scrollGesture", {
          direction,
          percent: request.percent ?? 0.75
        })
      };
    }
    case "longPress": {
      const point = request.ref || request.graphRef
        ? centerOf(await resolveElement(driver, request, options))
        : requirePoint(request, "longPress");
      await pointerGesture(driver, [
        ["move", { x: point.x, y: point.y }],
        ["down"],
        ["pause", request.durationMs ?? 750],
        ["up"]
      ]);
      return { action: request.action, ref: request.ref, point, durationMs: request.durationMs ?? 750 };
    }
    case "drag": {
      const from = request.fromRef
        ? centerOf(await resolveElement(driver, { ...request, ref: request.fromRef }, options))
        : requirePoint(request, "drag");
      const to = request.toRef
        ? centerOf(await resolveElement(driver, { ...request, ref: request.toRef }, options))
        : requireTargetPoint(request);
      await pointerGesture(driver, [
        ["move", { x: from.x, y: from.y }],
        ["down"],
        ["move", { x: to.x, y: to.y, duration: request.durationMs ?? 500 }],
        ["up"]
      ]);
      return { action: request.action, fromRef: request.fromRef, toRef: request.toRef, from, to, durationMs: request.durationMs ?? 500 };
    }
  }
}

async function resolveElement(
  driver: InteractionDriver,
  request: Pick<InteractionRequest, "action" | "ref" | "graphRef">,
  options: InteractionOptions
): Promise<{ element: InteractionElement; selector: string; bounds?: { x: number; y: number; width: number; height: number }; graphRef?: string }> {
  if (request.graphRef) {
    const resolved = await options.resolveGraphRef?.(request.graphRef);
    if (!resolved) {
      throw new Error(`Could not resolve graphRef '${request.graphRef}' in the current Nav Graph.`);
    }
    return { element: await driver.$(resolved.selector), selector: resolved.selector, bounds: resolved.bounds, graphRef: request.graphRef };
  }

  const ref = requireRef(request);
  const source = await driver.getPageSource();
  const tree = parseAppiumSource(source);
  const node = findSnapshotNode(tree, ref);
  if (!node) {
    const resolved = await options.resolveStaleRef?.(ref);
    if (resolved) {
      return { element: await driver.$(resolved.selector), selector: resolved.selector, bounds: resolved.bounds };
    }
    throw new Error(`Could not find ref '${ref}' in the current snapshot.`);
  }
  if (!node.selector) {
    throw new Error(`Ref '${ref}' does not have a structured selector.`);
  }

  const selector = toWebdriverSelector(node.selector);
  return { element: await driver.$(selector), selector, bounds: node.bounds, graphRef: node.graphRef };
}

async function resolveWaitElement(
  driver: InteractionDriver,
  request: InteractionRequest,
  options: InteractionOptions
): Promise<{ element: InteractionElement; selector: string; graphRef?: string }> {
  if (request.ref || request.graphRef) {
    return resolveElement(driver, request, options);
  }

  const selector = resolveDirectSelector(request);
  if (!selector) {
    throw new Error("wait requires ref, accessibilityId, or text.");
  }

  return { element: await driver.$(selector), selector };
}

function resolveDirectSelector(request: InteractionRequest): string | undefined {
  if (request.accessibilityId) {
    return `~${request.accessibilityId}`;
  }
  if (request.text !== undefined) {
    return `android=new UiSelector().text(${quoteJavaString(request.text)})`;
  }
  return undefined;
}

async function tapPoint(driver: InteractionDriver, x: number, y: number): Promise<void> {
  if (!driver.action) {
    throw new Error("Coordinate tap requires driver.action.");
  }
  await driver.action("pointer").move({ x, y }).down().pause(50).up().perform();
}

async function pointerGesture(driver: InteractionDriver, steps: Array<["move", { x: number; y: number; duration?: number }] | ["down"] | ["pause", number] | ["up"]>): Promise<void> {
  if (!driver.action) {
    throw new Error("Pointer gesture requires driver.action.");
  }

  let action = driver.action("pointer");
  for (const step of steps) {
    switch (step[0]) {
      case "move":
        action = action.move(step[1]);
        break;
      case "down":
        action = action.down();
        break;
      case "pause":
        action = action.pause(step[1]);
        break;
      case "up":
        action = action.up();
        break;
    }
  }
  await action.perform();
}

function centerOf(resolved: { bounds?: { x: number; y: number; width: number; height: number } }): { x: number; y: number } {
  if (!resolved.bounds) {
    throw new Error("Ref does not have bounds for pointer gesture.");
  }

  return {
    x: Math.round(resolved.bounds.x + resolved.bounds.width / 2),
    y: Math.round(resolved.bounds.y + resolved.bounds.height / 2)
  };
}

function withGraphRef<T extends Record<string, unknown>>(result: T, graphRef: string | undefined): T {
  return graphRef ? { ...result, graphRef } : result;
}

function requireRef(request: Pick<InteractionRequest, "action" | "ref" | "graphRef">): string {
  if (!request.ref) {
    throw new Error(`${request.action} requires ref or graphRef.`);
  }
  return request.ref;
}

function requireText(request: InteractionRequest): string {
  if (request.text === undefined) {
    throw new Error("type requires text.");
  }
  return request.text;
}

function requirePoint(request: InteractionRequest, action = "tap"): { x: number; y: number } {
  if (request.x === undefined || request.y === undefined) {
    throw new Error(`${action} requires ref or x/y coordinates.`);
  }
  return { x: request.x, y: request.y };
}

function requireTargetPoint(request: InteractionRequest): { x: number; y: number } {
  if (request.toX === undefined || request.toY === undefined) {
    throw new Error("drag requires toRef or toX/toY coordinates.");
  }
  return { x: request.toX, y: request.toY };
}

function quoteJavaString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
