import { defineChannelPluginEntry } from "openclaw/plugin-sdk/core";
import { describe, it, expect } from "vitest";

describe("Messenger Plugin", () => {
  it("should export valid channel plugin entry", async () => {
    // Dynamic import to avoid circular dependencies
    const module = await import("./index.js");
    const plugin = module.default;

    expect(plugin).toBeTruthy();
    expect(plugin.manifest).toBeDefined();
    expect(plugin.manifest.id).toBe("messenger");
    expect(plugin.manifest.name).toContain("Messenger");
  });

  it("should have valid config schema", async () => {
    const module = await import("./index.js");
    const plugin = module.default;

    expect(plugin.manifest.configSchema).toBeDefined();
    const schema = plugin.manifest.configSchema();
    expect(schema).toBeTruthy();
  });

  it("should have setup entry defined", async () => {
    const module = await import("./index.js");
    const plugin = module.default;

    expect(plugin.manifest.setupEntry).toBe("./setup-entry");
  });
});
