import type { ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";
import {
  AVAILABLE_PROVIDER_OPTIONS,
  COMING_SOON_PROVIDER_OPTIONS,
  getProviderAvailability,
  PROVIDER_PICKER_OPTIONS,
  UNAVAILABLE_PROVIDER_OPTIONS,
} from "./providerCatalog";

function makeProvider(overrides: Partial<ServerProvider> = {}): ServerProvider {
  return {
    provider: "codex",
    enabled: true,
    installed: true,
    version: "1.0.0",
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-04-01T00:00:00.000Z",
    models: [
      {
        slug: "gpt-5.4",
        name: "GPT-5.4",
        isCustom: false,
        capabilities: null,
      },
    ],
    ...overrides,
  };
}

describe("PROVIDER_PICKER_OPTIONS", () => {
  it("keeps supported providers in the shared catalog and leaves cursor as a placeholder", () => {
    expect(PROVIDER_PICKER_OPTIONS).toEqual([
      {
        value: "codex",
        label: "Codex",
        description: "OpenAI's terminal-first coding agent.",
        available: true,
      },
      {
        value: "claudeAgent",
        label: "Claude",
        description: "Anthropic's coding agent and SDK workflow.",
        available: true,
      },
      {
        value: "droid",
        label: "Droid",
        description: "Factory's coding agent with subscription-backed model access.",
        available: true,
      },
      {
        value: "cursor",
        label: "Cursor",
        description: "Reserved for future workspace-aware integration.",
        available: false,
      },
    ]);
    expect(AVAILABLE_PROVIDER_OPTIONS.map((option) => option.value)).toEqual([
      "codex",
      "claudeAgent",
      "droid",
    ]);
    expect(UNAVAILABLE_PROVIDER_OPTIONS.map((option) => option.value)).toEqual(["cursor"]);
    expect(COMING_SOON_PROVIDER_OPTIONS.map((option) => option.id)).toEqual(["opencode", "gemini"]);
  });
});

describe("getProviderAvailability", () => {
  it("treats ready providers with models as selectable", () => {
    expect(getProviderAvailability(makeProvider())).toEqual({
      state: "ready",
      selectable: true,
      badgeLabel: null,
      message: null,
    });
  });

  it("surfaces an auth-required badge before the generic provider status", () => {
    expect(
      getProviderAvailability(
        makeProvider({
          provider: "claudeAgent",
          auth: { status: "unauthenticated" },
          message: "Claude is not authenticated. Run `claude auth login` and try again.",
        }),
      ),
    ).toEqual({
      state: "auth-required",
      selectable: false,
      badgeLabel: "Sign in",
      message: "Claude is not authenticated. Run `claude auth login` and try again.",
    });
  });

  it("reports missing models as a distinct non-selectable state", () => {
    expect(
      getProviderAvailability(
        makeProvider({
          models: [],
        }),
      ),
    ).toEqual({
      state: "no-models",
      selectable: false,
      badgeLabel: "No models",
      message: "Codex is available, but no models were discovered.",
    });
  });

  it("keeps provider errors distinct from empty model listings", () => {
    expect(
      getProviderAvailability(
        makeProvider({
          status: "error",
          models: [],
        }),
      ),
    ).toEqual({
      state: "error",
      selectable: false,
      badgeLabel: "Unavailable",
      message: "Codex provider is unavailable.",
    });
  });
});
