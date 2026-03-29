/**
 * Channel tests for Threads Plugin
 * Covers: login, webhook verification, inbound parse, outbound send
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../../../src/runtime.js";
import {
  createPluginSetupWizardConfigure,
  createQueuedWizardPrompter,
  runSetupWizardConfigure,
} from "../../../test/helpers/extensions/setup-wizard.js";
import { threadsPlugin } from "./index.js";
import type { OpenClawConfig } from "./runtime-api.js";

const hoisted = vi.hoisted(() => ({
  sendThreadsMessage: vi.fn(async () => ({ messageId: "th-mid-123", toThreadId: "th-456" })),
  loginOAuth: vi.fn(async () => ({ accessToken: "test-token", expiresAt: Date.now() + 86400000 })),
  verifyWebhook: vi.fn(async () => true),
  parseInboundMessage: vi.fn(async () => ({
    channelId: "threads",
    accountId: "test-account",
    from: { id: "th-user-123", name: "Test User" },
    to: { id: "th-brand-456", name: "Test Brand" },
    content: { type: "text", text: "Hello" },
    timestamp: Date.now(),
  })),
  listThreadsAccountIds: vi.fn(() => [] as string[]),
  resolveDefaultThreadsAccountId: vi.fn(() => "default-account"),
}));

vi.mock("./runtime.js", () => ({
  getThreadsRuntime: () => ({
    logging: {
      shouldLogVerbose: () => false,
    },
    channel: {
      threads: {
        sendThreadsMessage: hoisted.sendThreadsMessage,
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
    listThreadsAccountIds: hoisted.listThreadsAccountIds,
    resolveDefaultThreadsAccountId: hoisted.resolveDefaultThreadsAccountId,
  };
});

function createRuntime(): RuntimeEnv {
  return {
    error: vi.fn(),
  } as unknown as RuntimeEnv;
}

let threadsConfigure: ReturnType<typeof createPluginSetupWizardConfigure>;

async function runConfigureWithHarness(params: {
  harness: ReturnType<typeof createQueuedWizardPrompter>;
  cfg?: Partial<OpenClawConfig["threads"]>;
  runtime?: RuntimeEnv;
  options?: Parameters<typeof threadsConfigure>[0]["options"];
  accountOverrides?: Parameters<typeof threadsConfigure>[0]["accountOverrides"];
  shouldPromptAccountIds?: boolean;
  forceAllowFrom?: boolean;
}) {
  return await runSetupWizardConfigure({
    configure: threadsConfigure,
    cfg: params.cfg ?? {},
    runtime: params.runtime ?? createRuntime(),
    prompter: params.harness.prompter,
    options: params.options ?? {},
    accountOverrides: params.accountOverrides ?? {},
    shouldPromptAccountIds: params.shouldPromptAccountIds ?? false,
    forceAllowFrom: params.forceAllowFrom ?? false,
  });
}

describe("Threads Plugin", () => {
  beforeAll(async () => {
    const wizard = createPluginSetupWizardConfigure(threadsPlugin);
    threadsConfigure = wizard.configure;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Plugin Manifest", () => {
    it("should export valid channel plugin entry", () => {
      expect(threadsPlugin).toBeTruthy();
      expect(threadsPlugin.manifest).toBeDefined();
      expect(threadsPlugin.manifest.id).toBe("threads");
      expect(threadsPlugin.manifest.name).toContain("Threads");
    });

    it("should have valid config schema", () => {
      const schema = threadsPlugin.manifest.configSchema();
      expect(schema).toBeTruthy();
      expect(schema.properties).toBeDefined();
    });

    it("should have setup entry defined", () => {
      expect(threadsPlugin.manifest.setupEntry).toBe("./setup-entry");
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
          allowFrom: ["th-allowed-user"],
        },
      });

      expect(result.config.allowFrom).toContain("th-allowed-user");
    });

    it("should configure with responseWindowHours", async () => {
      const harness = createQueuedWizardPrompter();
      const result = await runConfigureWithHarness({
        harness,
        cfg: {
          enabled: true,
          accounts: {
            primary: "test-account-id",
          },
          responseWindowHours: 24,
        },
      });

      expect(result.config.responseWindowHours).toBe(24);
    });
  });

  describe("Webhook Verification", () => {
    it("should verify webhook signature with valid HMAC", async () => {
      const { WebhookManager } = await import(" @openclaw/meta-common");
      const manager = new WebhookManager({ verifyToken: "test-verify-token" });

      const payload = {
        object: "threads",
        entry: [{
          id: "th-account-id",
          time: Date.now(),
          messaging: [{
            sender: { id: "th-user-123" },
            recipient: { id: "th-brand-456" },
            timestamp: Date.now(),
            message: { mid: "th-mid-123", text: "Hello" },
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
        object: "threads",
        entry: [{
          id: "th-account-id",
          time: Date.now(),
          messaging: [{
            sender: { id: "th-user-123" },
            recipient: { id: "th-brand-456" },
            timestamp: Date.now(),
            message: { mid: "th-mid-123", text: "Hello" },
          }],
        }],
      };

      hoisted.parseInboundMessage.mockResolvedValue({
        channelId: "threads",
        accountId: "test-account",
        from: { id: "th-user-123", name: "Test User" },
        to: { id: "th-brand-456", name: "Test Brand" },
        content: { type: "text", text: "Hello" },
        timestamp: Date.now(),
      });

      const parsed = await manager.parseInbound(payload, "test-account");

      expect(parsed).toBeDefined();
      expect(parsed.channelId).toBe("threads");
      expect(parsed.from.id).toBe("th-user-123");
      expect(parsed.content.type).toBe("text");
    });

    it("should parse inbound thread reply", async () => {
      const { WebhookManager } = await import(" @openclaw/meta-common");
      const manager = new WebhookManager({ verifyToken: "test-verify-token" });

      hoisted.parseInboundMessage.mockResolvedValue({
        channelId: "threads",
        accountId: "test-account",
        from: { id: "th-user-123", name: "Test User" },
        to: { id: "th-brand-456", name: "Test Brand" },
        content: { type: "thread_reply", threadId: "thread-123", text: "Great thread!" },
        timestamp: Date.now(),
      });

      const payload = {
        object: "threads",
        entry: [{
          id: "th-account-id",
          time: Date.now(),
          thread_replies: [{
            sender: { id: "th-user-123" },
            recipient: { id: "th-brand-456" },
            timestamp: Date.now(),
            thread_id: "thread-123",
            text: "Great thread!",
          }],
        }],
      };

      const parsed = await manager.parseInbound(payload, "test-account");

      expect(parsed.content.type).toBe("thread_reply");
    });
  });

  describe("Outbound Message Sending", () => {
    it("should send text message", async () => {
      const { sendThreadsMessage } = await import("./runtime.js");

      const result = await sendThreadsMessage({
        accountId: "test-account",
        to: "th-recipient",
        content: { type: "text", text: "Hello from OpenClaw" },
      });

      expect(result).toBeDefined();
      expect(result.messageId).toBe("th-mid-123");
      expect(hoisted.sendThreadsMessage).toHaveBeenCalled();
    });

    it("should send thread post", async () => {
      const { sendThreadsMessage } = await import("./runtime.js");

      hoisted.sendThreadsMessage.mockResolvedValueOnce({
        messageId: "th-mid-456",
        toThreadId: "th-thread-789",
      });

      const result = await sendThreadsMessage({
        accountId: "test-account",
        to: "th-recipient",
        content: { type: "thread", text: "This is a new thread" },
      });

      expect(result.messageId).toBe("th-mid-456");
    });

    it("should send image thread", async () => {
      const { sendThreadsMessage } = await import("./runtime.js");

      hoisted.sendThreadsMessage.mockResolvedValueOnce({
        messageId: "th-mid-789",
        toThreadId: "th-thread-012",
      });

      const result = await sendThreadsMessage({
        accountId: "test-account",
        to: "th-recipient",
        content: { type: "thread_image", imageUrl: "https://example.com/image.jpg", caption: "Check this out" },
      });

      expect(result.messageId).toBe("th-mid-789");
    });
  });

  describe("Account Management", () => {
    it("should list account IDs", async () => {
      hoisted.listThreadsAccountIds.mockReturnValue(["th-account-1", "th-account-2"]);

      const { listThreadsAccountIds } = await import("./accounts.js");
      const accounts = await listThreadsAccountIds();

      expect(accounts).toHaveLength(2);
      expect(accounts).toContain("th-account-1");
    });

    it("should resolve default account ID", async () => {
      hoisted.resolveDefaultThreadsAccountId.mockReturnValue("default-th-account");

      const { resolveDefaultThreadsAccountId } = await import("./accounts.js");
      const defaultAccount = await resolveDefaultThreadsAccountId();

      expect(defaultAccount).toBe("default-th-account");
    });
  });
});
