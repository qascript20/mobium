import { describe, expect, it, vi } from "vitest";
import { performInteraction } from "../src/webdriver/interactions.js";

describe("performInteraction", () => {
  it("taps an element resolved from a snapshot ref", async () => {
    const click = vi.fn(async () => undefined);
    const driver = {
      getPageSource: vi.fn(async () => `<hierarchy><button content-desc="Save" clickable="true" /></hierarchy>`),
      $: vi.fn(() => ({
        click,
        setValue: vi.fn(),
        clearValue: vi.fn(),
        waitForExist: vi.fn()
      }))
    };

    await expect(performInteraction(driver, { action: "tap", sessionName: "default", ref: "m2" })).resolves.toEqual({
      action: "tap",
      ref: "m2",
      selector: "~Save"
    });
    expect(driver.$).toHaveBeenCalledWith("~Save");
    expect(click).toHaveBeenCalledOnce();
  });

  it("types into an element resolved from text", async () => {
    const setValue = vi.fn(async () => undefined);
    const driver = {
      getPageSource: vi.fn(async () => `<hierarchy><input text="Email" /></hierarchy>`),
      $: vi.fn(() => ({
        click: vi.fn(),
        setValue,
        clearValue: vi.fn(),
        waitForExist: vi.fn()
      }))
    };

    await performInteraction(driver, { action: "type", sessionName: "default", ref: "m2", text: "a@example.com" });

    expect(driver.$).toHaveBeenCalledWith("android=new UiSelector().text(\"Email\")");
    expect(setValue).toHaveBeenCalledWith("a@example.com");
  });

  it("rejects missing refs for ref-based actions", async () => {
    const driver = {
      getPageSource: vi.fn(async () => `<hierarchy />`),
      $: vi.fn()
    };

    await expect(performInteraction(driver, { action: "clear", sessionName: "default" })).rejects.toThrow("clear requires ref");
  });

  it("waits by accessibility id without taking a snapshot", async () => {
    const waitForExist = vi.fn(async () => undefined);
    const driver = {
      getPageSource: vi.fn(),
      $: vi.fn(() => ({
        click: vi.fn(),
        setValue: vi.fn(),
        clearValue: vi.fn(),
        waitForExist
      }))
    };

    await performInteraction(driver, {
      action: "wait",
      sessionName: "default",
      accessibilityId: "Continue",
      timeoutMs: 2500
    });

    expect(driver.$).toHaveBeenCalledWith("~Continue");
    expect(driver.getPageSource).not.toHaveBeenCalled();
    expect(waitForExist).toHaveBeenCalledWith({ timeout: 2500 });
  });

  it("resolves a graphRef through Nav Graph resolver", async () => {
    const click = vi.fn(async () => undefined);
    const driver = {
      getPageSource: vi.fn(),
      $: vi.fn(() => ({
        click,
        setValue: vi.fn(),
        clearValue: vi.fn(),
        waitForExist: vi.fn()
      }))
    };

    await expect(performInteraction(driver, {
      action: "tap",
      sessionName: "default",
      graphRef: "g3"
    }, {
      resolveGraphRef: vi.fn(async () => ({ selector: "~Continue" }))
    })).resolves.toEqual({
      action: "tap",
      selector: "~Continue",
      graphRef: "g3"
    });

    expect(driver.$).toHaveBeenCalledWith("~Continue");
    expect(click).toHaveBeenCalledOnce();
  });

  it("falls back from stale snapshot ref to Nav Graph resolver", async () => {
    const click = vi.fn(async () => undefined);
    const driver = {
      getPageSource: vi.fn(async () => `<hierarchy><button content-desc="Other" /></hierarchy>`),
      $: vi.fn(() => ({
        click,
        setValue: vi.fn(),
        clearValue: vi.fn(),
        waitForExist: vi.fn()
      }))
    };

    await expect(performInteraction(driver, {
      action: "tap",
      sessionName: "default",
      ref: "m99"
    }, {
      resolveStaleRef: vi.fn(async () => ({ selector: "~Save" }))
    })).resolves.toEqual({
      action: "tap",
      ref: "m99",
      selector: "~Save"
    });

    expect(driver.$).toHaveBeenCalledWith("~Save");
    expect(click).toHaveBeenCalledOnce();
  });

  it("scrolls through Appium gesture execution", async () => {
    const execute = vi.fn(async () => true);

    await expect(performInteraction({
      getPageSource: vi.fn(),
      $: vi.fn(),
      execute
    }, {
      action: "scroll",
      sessionName: "default",
      direction: "down",
      percent: 0.5
    })).resolves.toEqual({
      action: "scroll",
      direction: "down",
      percent: 0.5,
      result: true
    });

    expect(execute).toHaveBeenCalledWith("mobile: scrollGesture", {
      direction: "down",
      percent: 0.5
    });
  });

  it("long presses the center of a ref with bounds", async () => {
    const perform = vi.fn(async () => undefined);
    const action = {
      move: vi.fn(() => action),
      down: vi.fn(() => action),
      pause: vi.fn(() => action),
      up: vi.fn(() => action),
      perform
    };
    const driver = {
      getPageSource: vi.fn(async () => `<hierarchy><button content-desc="Hold" bounds="[10,20][30,60]" /></hierarchy>`),
      $: vi.fn(() => ({
        click: vi.fn(),
        setValue: vi.fn(),
        clearValue: vi.fn(),
        waitForExist: vi.fn()
      })),
      action: vi.fn(() => action)
    };

    await performInteraction(driver, {
      action: "longPress",
      sessionName: "default",
      ref: "m2",
      durationMs: 1000
    });

    expect(action.move).toHaveBeenCalledWith({ x: 20, y: 40 });
    expect(action.pause).toHaveBeenCalledWith(1000);
    expect(perform).toHaveBeenCalledOnce();
  });

  it("drags from one point to another", async () => {
    const perform = vi.fn(async () => undefined);
    const action = {
      move: vi.fn(() => action),
      down: vi.fn(() => action),
      pause: vi.fn(() => action),
      up: vi.fn(() => action),
      perform
    };
    const driver = {
      getPageSource: vi.fn(),
      $: vi.fn(),
      action: vi.fn(() => action)
    };

    await performInteraction(driver, {
      action: "drag",
      sessionName: "default",
      x: 10,
      y: 20,
      toX: 30,
      toY: 40,
      durationMs: 300
    });

    expect(action.move).toHaveBeenNthCalledWith(1, { x: 10, y: 20 });
    expect(action.move).toHaveBeenNthCalledWith(2, { x: 30, y: 40, duration: 300 });
    expect(perform).toHaveBeenCalledOnce();
  });
});
