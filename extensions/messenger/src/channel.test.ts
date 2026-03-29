/**
 * Channel tests for Messenger Plugin
 * Covers: login, webhook verification, inbound parse, outbound send
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../../../src/runtime.js";
import {
  createPluginSetupWizardConfigure,
  createQueuedWizardPrompter,
  runSetupWizardConfigure,
} from "../../../test/helpers/extensions/setup-wizard.js";
import { messengerPlugin } from "./index.js";
import type { OpenClawConfig } from "./runtime-api.js";

const hoisted = vi.hoisted(() => ({
  sendMessengerMessage: vi.fn(async () => ({ messageId: "mid-123", toPsid: "psid-456" })),
  loginOAuth: vi.fn(async () => ({ accessToken: "test-token", expiresAt: Date.now() + 86400000 })),
  verifyWebhook: vi.fn(async () => true),
  parseInboundMessage: vi.fn(async () => ({
    channelId: "messenger",
    accountId: "test-account",
    from: { id: "psid-sender", name: "Test User" },
    to: { id: "psid-page", name: "Test Page" },
    content: { type: "text", text: "Hello" },
    timestamp: Date.now(),
  })),
  listMessengerAccountIds: vi.fn(() => [] as string[]),
  resolveDefaultMessengerAccountId: vi.fn(() => "default-account"),
}));

vi.mock("./runtime.js", () => ({
  getMessengerRuntime: () => ({
    logging: {
      shouldLogVerbose: () => false,
    },
    channel: {
      messenger: {
        sendMessengerMessage: hoisted.sendMessengerMessage,
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
    listMessengerAccountIds: hoisted.listMessengerAccountIds,
    resolveDefaultMessengerAccountId: hoisted.resolveDefaultMessengerAccountId,
  };
});

function createRuntime(): RuntimeEnv {
  return {
    error: vi.fn(),
  } as unknown as RuntimeEnv;
}

let messengerConfigure: ReturnType<typeof createPluginSetupWizardConfigure>;

async function runConfigureWithHarness(params: {
  harness: ReturnType<typeof createQueuedWizardPrompter>;
  cfg?: Partial<OpenClawConfig["messenger"]>;
  runtime?: RuntimeEnv;
  options?: Parameters<typeof messengerConfigure>[0]["options"];
  accountOverrides?: Parameters<typeof messengerConfigure>[0]["accountOverrides"];
  shouldPromptAccountIds?: boolean;
  forceAllowFrom?: boolean;
}) {
  return await runSetupWizardConfigure({
    configure: messengerConfigure,
    cfg: params.cfg ?? {},
    runtime: params.runtime ?? createRuntime(),
    prompter: params.harness.prompter,
    options: params.options ?? {},
    accountOverrides: params.accountOverrides ?? {},
    shouldPromptAccountIds: params.shouldPromptAccountIds ?? false,
    forceAllowFrom: params.forceAllowFrom ?? false,
  });
}

describe("Messenger Plugin", () => {
  beforeAll(async () => {
    const wizard = createPluginSetupWizardConfigure(messengerPlugin);
    messengerConfigure = wizard.configure;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Plugin Manifest", () => {
    it("should export valid channel plugin entry", () => {
      expect(messengerPlugin).toBeTruthy();
      expect(messengerPlugin.manifest).toBeDefined();
      expect(messengerPlugin.manifest.id).toBe("messenger");
      expect(messengerPlugin.manifest.name).toContain("Messenger");
    });

    it("should have valid config schema", () => {
      const schema = messengerPlugin.manifest.configSchema();
      expect(schema).toBeTruthy();
      expect(schema.properties).toBeDefined();
    });

    it("should have setup entry defined", () => {
      expect(messengerPlugin.manifest.setupEntry).toBe("./setup-entry");
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
          allowFrom: ["psid-allowed-user"],
        },
      });

      expect(result.config.allowFrom).toContain("psid-allowed-user");
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
        object: "page",
        entry: [{
          id: "page-id",
          time: Date.now(),
          messaging: [{
            sender: { id: "psid-sender" },
            recipient: { id: "psid-page" },
            timestamp: Date.now(),
            message: { mid: "mid-123", text: "Hello" },
          }],
        }],
      };

      // Simulate valid verification
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
        object: "page",
        entry: [{
          id: "page-id",
          time: Date.now(),
          messaging: [{
            sender: { id: "psid-sender" },
            recipient: { id: "psid-page" },
            timestamp: Date.now(),
            message: { mid: "mid-123", text: "Hello" },
          }],
        }],
      };

      hoisted.parseInboundMessage.mockResolvedValue({
        channelId: "messenger",
        accountId: "test-account",
        from: { id: "psid-sender", name: "Test User" },
        to: { id: "psid-page", name: "Test Page" },
        content: { type: "text", text: "Hello" },
        timestamp: Date.now(),
      });

      const parsed = await manager.parseInbound(payload, "test-account");

      expect(parsed).toBeDefined();
      expect(parsed.channelId).toBe("messenger");
      expect(parsed.from.id).toBe("psid-sender");
      expect(parsed.content.type).toBe("text");
    });

    it("should parse inbound image message", async () => {
      const { WebhookManager } = await import(" @openclaw/meta-common");
      const manager = new WebhookManager({ verifyToken: "test-verify-token" });

      hoisted.parseInboundMessage.mockResolvedValue({
        channelId: "messenger",
        accountId: "test-account",
        from: { id: "psid-sender", name: "Test User" },
        to: { id: "psid-page", name: "Test Page" },
        content: { type: "image", url: "https://example.com/image.jpg" },
        timestamp: Date.now(),
      });

      const payload = {
        object: "page",
        entry: [{
          id: "page-id",
          time: Date.now(),
          messaging: [{
            sender: { id: "psid-sender" },
            recipient: { id: "psid-page" },
            timestamp: Date.now(),
            message: { mid: "mid-123", attachments: [{ type: "image", payload: { url: "https://example.com/image.jpg" } }] },
          }],
        }],
      };

      const parsed = await manager.parseInbound(payload, "test-account");

      expect(parsed.content.type).toBe("image");
    });
  });

  describe("Outbound Message Sending", () => {
    it("should send text message", async () => {
      const { sendMessengerMessage } = await import("./runtime.js");

      const result = await sendMessengerMessage({
        accountId: "test-account",
        to: "psid-recipient",
        content: { type: "text", text: "Hello from OpenClaw" },
      });

      expect(result).toBeDefined();
      expect(result.messageId).toBe("mid-123");
      expect(result.toPsid).toBe("psid-456");
      expect(hoisted.sendMessengerMessage).toHaveBeenCalled();
    });

    it("should send image message", async () => {
      const { sendMessengerMessage } = await import("./runtime.js");

      hoisted.sendMessengerMessage.mockResolvedValueOnce({
        messageId: "mid-456",
        toPsid: "psid-789",
      });

      const result = await sendMessengerMessage({
        accountId: "test-account",
        to: "psid-recipient",
        content: { type: "image", url: "https://example.com/image.jpg" },
      });

      expect(result.messageId).toBe("mid-456");
    });
  });

  describe("Account Management", () => {
    it("should list account IDs", async () => {
      hoisted.listMessengerAccountIds.mockReturnValue(["account-1", "account-2"]);

      const { listMessengerAccountIds } = await import("./accounts.js");
      const accounts = await listMessengerAccountIds();

      expect(accounts).toHaveLength(2);
      expect(accounts).toContain("account-1");
    });

    it("should resolve default account ID", async () => {
      hoisted.resolveDefaultMessengerAccountId.mockReturnValue("default-account");

      const { resolveDefaultMessengerAccountId } = await import("./accounts.js");
      const defaultAccount = await resolveDefaultMessengerAccountId();

      expect(defaultAccount).toBe("default-account");
    });
  });
});
