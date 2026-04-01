import type { ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";
import { isProviderEnabled, resolveSelectableProvider } from "./providerModels";

function makeProvider(overrides: Partial<ServerProvider> = {}): ServerProvider {
  return {
    provider: "codex",
    enabled: true,
    installed: true,
    version: "1.0.0",
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-04-01T00:00:00.000Z",
    message: undefined,
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

describe("providerModels", () => {
  it("treats unauthenticated providers as unavailable for selection", () => {
    const providers: ServerProvider[] = [
      makeProvider({
        provider: "codex",
        auth: { status: "unauthenticated" },
        message: "Codex CLI is not authenticated. Run `codex login` and try again.",
      }),
      makeProvider({
        provider: "claudeAgent",
      }),
    ];

    expect(isProviderEnabled(providers, "codex")).toBe(false);
    expect(resolveSelectableProvider(providers, "codex")).toBe("claudeAgent");
  });

  it("keeps ready providers selectable", () => {
    const providers: ServerProvider[] = [
      makeProvider({
        provider: "codex",
      }),
      makeProvider({
        provider: "claudeAgent",
      }),
    ];

    expect(isProviderEnabled(providers, "codex")).toBe(true);
    expect(resolveSelectableProvider(providers, "codex")).toBe("codex");
  });
});
