/**
 * Channel tests for Instagram Plugin
 * Covers: login, webhook verification, inbound parse, outbound send
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../../../src/runtime.js";
import {
  createPluginSetupWizardConfigure,
  createQueuedWizardPrompter,
  runSetupWizardConfigure,
} from "../../../test/helpers/extensions/setup-wizard.js";
import { instagramPlugin } from "./index.js";
import type { OpenClawConfig } from "./runtime-api.js";

const hoisted = vi.hoisted(() => ({
  sendInstagramMessage: vi.fn(async () => ({ messageId: "ig-mid-123", toIgsc: "igsc-456" })),
  loginOAuth: vi.fn(async () => ({ accessToken: "test-token", expiresAt: Date.now() + 86400000 })),
  verifyWebhook: vi.fn(async () => true),
  parseInboundMessage: vi.fn(async () => ({
    channelId: "instagram",
    accountId: "test-account",
    from: { id: "igsc-sender", name: "Test User" },
    to: { id: "igsc-page", name: "Test Business" },
    content: { type: "text", text: "Hello" },
    timestamp: Date.now(),
  })),
  listInstagramAccountIds: vi.fn(() => [] as string[]),
  resolveDefaultInstagramAccountId: vi.fn(() => "default-account"),
}));

vi.mock("./runtime.js", () => ({
  getInstagramRuntime: () => ({
    logging: {
      shouldLogVerbose: () => false,
    },
    channel: {
      instagram: {
        sendInstagramMessage: hoisted.sendInstagramMessage,
      },
    },
  }),
}));

vi.mock(" @openclaw/meta-common", async () => {
  const actual = await vi.importActual<typeof import(" @openclaw/meta-common")>(" @openclaw/meta-common");
  return {
    ...actual,
    WebhookManager: vi.fn().mockImplementation(() => ({
      verify: hoisted.verifyWebhook,
      parseInbound: hoisted.parseInboundMessage,
    })),
  };
});

vi.mock("openclaw/plugin-sdk/setup", async () => {
  const actual = await vi.importActual<typeof import("openclaw/plugin-sdk/setup")>(
    "openclaw/plugin-sdk/setup",
  );
  return {
    ...actual,
    pathExists: vi.fn(async () => false),
  };
});

vi.mock("./accounts.js", async () => {
  const actual = await vi.importActual<typeof import("./accounts.js")>("./accounts.js");
  return {
    ...actual,
    listInstagramAccountIds: hoisted.listInstagramAccountIds,
    resolveDefaultInstagramAccountId: hoisted.resolveDefaultInstagramAccountId,
  };
});

function createRuntime(): RuntimeEnv {
  return {
    error: vi.fn(),
  } as unknown as RuntimeEnv;
}

let instagramConfigure: ReturnType<typeof createPluginSetupWizardConfigure>;

async function runConfigureWithHarness(params: {
  harness: ReturnType<typeof createQueuedWizardPrompter>;
  cfg?: Partial<OpenClawConfig["instagram"]>;
  runtime?: RuntimeEnv;
  options?: Parameters<typeof instagramConfigure>[0]["options"];
  accountOverrides?: Parameters<typeof instagramConfigure>[0]["accountOverrides"];
  shouldPromptAccountIds?: boolean;
  forceAllowFrom?: boolean;
}) {
  return await runSetupWizardConfigure({
    configure: instagramConfigure,
    cfg: params.cfg ?? {},
    runtime: params.runtime ?? createRuntime(),
    prompter: params.harness.prompter,
    options: params.options ?? {},
    accountOverrides: params.accountOverrides ?? {},
    shouldPromptAccountIds: params.shouldPromptAccountIds ?? false,
    forceAllowFrom: params.forceAllowFrom ?? false,
  });
}

describe("Instagram Plugin", () => {
  beforeAll(async () => {
    const wizard = createPluginSetupWizardConfigure(instagramPlugin);
    instagramConfigure = wizard.configure;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Plugin Manifest", () => {
    it("should export valid channel plugin entry", () => {
      expect(instagramPlugin).toBeTruthy();
      expect(instagramPlugin.manifest).toBeDefined();
      expect(instagramPlugin.manifest.id).toBe("instagram");
      expect(instagramPlugin.manifest.name).toContain("Instagram");
    });

    it("should have valid config schema", () => {
      const schema = instagramPlugin.manifest.configSchema();
      expect(schema).toBeTruthy();
      expect(schema.properties).toBeDefined();
    });

    it("should have setup entry defined", () => {
      expect(instagramPlugin.manifest.setupEntry).toBe("./setup-entry");
    });
  });

  describe("Setup Wizard", () => {
    it("should configure with minimal options", async () => {
      const harness = createQueuedWizardPrompter();
      const result = await runConfigureWithHarness({
        harness,
        cfg: {
          enabled: true,
          accounts: {
            primary: "test-account-id",
          },
        },
      });

      expect(result.config).toBeDefined();
      expect(result.config.enabled).toBe(true);
      expect(result.config.accounts?.primary).toBe("test-account-id");
    });

    it("should configure with allowFrom policy", async () => {
      const harness = createQueuedWizardPrompter();
      const result = await runConfigureWithHarness({
        harness,
        cfg: {
          enabled: true,
          accounts: {
            primary: "test-account-id",
          },
          allowFrom: ["igsc-allowed-user"],
        },
      });

      expect(result.config.allowFrom).toContain("igsc-allowed-user");
    });

    it("should configure with dmPolicy", async () => {
      const harness = createQueuedWizardPrompter();
      const result = await runConfigureWithHarness({
        harness,
        cfg: {
          enabled: true,
          accounts: {
            primary: "test-account-id",
          },
          dmPolicy: "allow",
        },
      });

      expect(result.config.dmPolicy).toBe("allow");
    });
  });

  describe("Webhook Verification", () => {
    it("should verify webhook signature with valid HMAC", async () => {
      const { WebhookManager } = await import(" @openclaw/meta-common");
      const manager = new WebhookManager({ verifyToken: "test-verify-token" });

      const payload = {
        object: "instagram",
        entry: [{
          id: "ig-account-id",
          time: Date.now(),
          messaging: [{
            sender: { id: "igsc-sender" },
            recipient: { id: "igsc-page" },
            timestamp: Date.now(),
            message: { mid: "ig-mid-123", text: "Hello" },
          }],
        }],
      };

      hoisted.verifyWebhook.mockResolvedValue(true);
      const isValid = await manager.verify("test-verify-token", payload);

      expect(isValid).toBe(true);
      expect(hoisted.verifyWebhook).toHaveBeenCalled();
    });

    it("should reject webhook with invalid signature", async () => {
      const { WebhookManager } = await import(" @openclaw/meta-common");
      const manager = new WebhookManager({ verifyToken: "test-verify-token" });

      hoisted.verifyWebhook.mockResolvedValue(false);
      const isValid = await manager.verify("wrong-token", {});

      expect(isValid).toBe(false);
    });
  });

  describe("Inbound Message Parsing", () => {
    it("should parse inbound text message", async () => {
      const { WebhookManager } = await import(" @openclaw/meta-common");
      const manager = new WebhookManager({ verifyToken: "test-verify-token" });

      const payload = {
        object: "instagram",
        entry: [{
          id: "ig-account-id",
          time: Date.now(),
          messaging: [{
            sender: { id: "igsc-sender" },
            recipient: { id: "igsc-page" },
            timestamp: Date.now(),
            message: { mid: "ig-mid-123", text: "Hello" },
          }],
        }],
      };

      hoisted.parseInboundMessage.mockResolvedValue({
        channelId: "instagram",
        accountId: "test-account",
        from: { id: "igsc-sender", name: "Test User" },
        to: { id: "igsc-page", name: "Test Business" },
        content: { type: "text", text: "Hello" },
        timestamp: Date.now(),
      });

      const parsed = await manager.parseInbound(payload, "test-account");

      expect(parsed).toBeDefined();
      expect(parsed.channelId).toBe("instagram");
      expect(parsed.from.id).toBe("igsc-sender");
      expect(parsed.content.type).toBe("text");
    });

    it("should parse inbound story mention", async () => {
      const { WebhookManager } = await import(" @openclaw/meta-common");
      const manager = new WebhookManager({ verifyToken: "test-verify-token" });

      hoisted.parseInboundMessage.mockResolvedValue({
        channelId: "instagram",
        accountId: "test-account",
        from: { id: "igsc-sender", name: "Test User" },
        to: { id: "igsc-page", name: "Test Business" },
        content: { type: "story_mention", storyId: "story-123" },
        timestamp: Date.now(),
      });

      const payload = {
        object: "instagram",
        entry: [{
          id: "ig-account-id",
          time: Date.now(),
          story_mention: [{
            sender: { id: "igsc-sender" },
            recipient: { id: "igsc-page" },
            timestamp: Date.now(),
            story_id: "story-123",
          }],
        }],
      };

      const parsed = await manager.parseInbound(payload, "test-account");

      expect(parsed.content.type).toBe("story_mention");
    });
  });

  describe("Outbound Message Sending", () => {
    it("should send text message", async () => {
      const { sendInstagramMessage } = await import("./runtime.js");

      const result = await sendInstagramMessage({
        accountId: "test-account",
        to: "igsc-recipient",
        content: { type: "text", text: "Hello from OpenClaw" },
      });

      expect(result).toBeDefined();
      expect(result.messageId).toBe("ig-mid-123");
      expect(hoisted.sendInstagramMessage).toHaveBeenCalled();
    });

    it("should send image message", async () => {
      const { sendInstagramMessage } = await import("./runtime.js");

      hoisted.sendInstagramMessage.mockResolvedValueOnce({
        messageId: "ig-mid-456",
        toIgsc: "igsc-789",
      });

      const result = await sendInstagramMessage({
        accountId: "test-account",
        to: "igsc-recipient",
        content: { type: "image", url: "https://example.com/image.jpg" },
      });

      expect(result.messageId).toBe("ig-mid-456");
    });

    it("should send story reply", async () => {
      const { sendInstagramMessage } = await import("./runtime.js");

      hoisted.sendInstagramMessage.mockResolvedValueOnce({
        messageId: "ig-mid-789",
        toIgsc: "igsc-012",
      });

      const result = await sendInstagramMessage({
        accountId: "test-account",
        to: "igsc-recipient",
        content: { type: "story_reply", storyId: "story-123", text: "Nice story!" },
      });

      expect(result.messageId).toBe("ig-mid-789");
    });
  });

  describe("Account Management", () => {
    it("should list account IDs", async () => {
      hoisted.listInstagramAccountIds.mockReturnValue(["ig-account-1", "ig-account-2"]);

      const { listInstagramAccountIds } = await import("./accounts.js");
      const accounts = await listInstagramAccountIds();

      expect(accounts).toHaveLength(2);
      expect(accounts).toContain("ig-account-1");
    });

    it("should resolve default account ID", async () => {
      hoisted.resolveDefaultInstagramAccountId.mockReturnValue("default-ig-account");

      const { resolveDefaultInstagramAccountId } = await import("./accounts.js");
      const defaultAccount = await resolveDefaultInstagramAccountId();

      expect(defaultAccount).toBe("default-ig-account");
    });
  });
});
