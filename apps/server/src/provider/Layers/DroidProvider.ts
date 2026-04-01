import type {
  ModelCapabilities,
  ServerProvider,
  ServerProviderAuth,
  ServerProviderModel,
  ServerProviderState,
} from "@t3tools/contracts";
import { Duration, Effect, Equal, Layer, Option, Result, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type { DroidSettings } from "@t3tools/contracts/settings";

import {
  buildServerProvider,
  DEFAULT_TIMEOUT_MS,
  detailFromResult,
  isCommandMissingCause,
  parseGenericCliVersion,
  providerModelsFromSettings,
  spawnAndCollect,
  type CommandResult,
} from "../providerSnapshot";
import { makeManagedServerProvider } from "../makeManagedServerProvider";
import { DroidProvider } from "../Services/DroidProvider";
import { ServerSettingsError, ServerSettingsService } from "../../serverSettings";

const PROVIDER = "droid" as const;

const BUILT_IN_MODELS: ReadonlyArray<ServerProviderModel> = [
  {
    slug: "claude-opus-4-5-20251101",
    name: "Claude Opus 4.5",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "off", label: "Off", isDefault: true },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "off", label: "Off" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High", isDefault: true },
        { value: "max", label: "Max" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "claude-opus-4-6-fast",
    name: "Claude Opus 4.6 Fast Mode",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "off", label: "Off" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High", isDefault: true },
        { value: "max", label: "Max" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "claude-sonnet-4-5-20250929",
    name: "Claude Sonnet 4.5",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "off", label: "Off", isDefault: true },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "off", label: "Off" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High", isDefault: true },
        { value: "max", label: "Max" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "off", label: "Off", isDefault: true },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "gpt-5.2",
    name: "GPT-5.2",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "off", label: "Off" },
        { value: "low", label: "Low", isDefault: true },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "xhigh", label: "Extra High" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "gpt-5.2-codex",
    name: "GPT-5.2-Codex",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "none", label: "None" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium", isDefault: true },
        { value: "high", label: "High" },
        { value: "xhigh", label: "Extra High" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "gpt-5.4",
    name: "GPT-5.4",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "none", label: "None" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium", isDefault: true },
        { value: "high", label: "High" },
        { value: "xhigh", label: "Extra High" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "gpt-5.4-fast",
    name: "GPT-5.4 Fast Mode",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "none", label: "None" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium", isDefault: true },
        { value: "high", label: "High" },
        { value: "xhigh", label: "Extra High" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "gpt-5.4-mini",
    name: "GPT-5.4 Mini",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "none", label: "None" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High", isDefault: true },
        { value: "xhigh", label: "Extra High" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "gpt-5.3-codex",
    name: "GPT-5.3-Codex",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "none", label: "None" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium", isDefault: true },
        { value: "high", label: "High" },
        { value: "xhigh", label: "Extra High" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High", isDefault: true },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "minimal", label: "Minimal" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High", isDefault: true },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "glm-4.7",
    name: "Droid Core (GLM-4.7)",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [{ value: "none", label: "None", isDefault: true }],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "glm-5",
    name: "Droid Core (GLM-5)",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [{ value: "none", label: "None", isDefault: true }],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "kimi-k2.5",
    name: "Droid Core (Kimi K2.5)",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [{ value: "none", label: "None", isDefault: true }],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "minimax-m2.5",
    name: "Droid Core (MiniMax M2.5)",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High", isDefault: true },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
  {
    slug: "gpt-5.1-codex-max",
    name: "GPT-5.1-Codex-Max [Deprecated]",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium", isDefault: true },
        { value: "high", label: "High" },
        { value: "xhigh", label: "Extra High" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    } satisfies ModelCapabilities,
  },
];

export function getDroidModelCapabilities(model: string | null | undefined): ModelCapabilities {
  const slug = model?.trim();
  return (
    BUILT_IN_MODELS.find((candidate) => candidate.slug === slug)?.capabilities ?? {
      reasoningEffortLevels: [],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    }
  );
}

export function parseDroidAuthStatusFromOutput(result: CommandResult): {
  readonly status: Exclude<ServerProviderState, "disabled">;
  readonly auth: Pick<ServerProviderAuth, "status">;
  readonly message?: string;
} {
  const lowerOutput = `${result.stdout}\n${result.stderr}`.toLowerCase();

  if (
    lowerOutput.includes("factory_api_key") ||
    lowerOutput.includes("api key") ||
    lowerOutput.includes("authentication") ||
    lowerOutput.includes("not authenticated") ||
    lowerOutput.includes("unauthorized")
  ) {
    return {
      status: "error",
      auth: { status: "unauthenticated" },
      message: "Droid is not authenticated. Configure your Factory credentials and try again.",
    };
  }

  if (result.code === 0) {
    return {
      status: "ready",
      auth: { status: "authenticated" },
      message: "Droid CLI is available and your Factory subscription can be used from T3 Code.",
    };
  }

  const detail = detailFromResult(result);
  return {
    status: "warning",
    auth: { status: "unknown" },
    message: detail
      ? `Could not verify Droid authentication status. ${detail}`
      : "Could not verify Droid authentication status.",
  };
}

const runDroidCommand = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const settingsService = yield* ServerSettingsService;
    const droidSettings = yield* settingsService.getSettings.pipe(
      Effect.map((settings) => settings.providers.droid),
    );
    const command = ChildProcess.make(droidSettings.binaryPath, [...args], {
      shell: process.platform === "win32",
    });
    return yield* spawnAndCollect(droidSettings.binaryPath, command);
  });

export const checkDroidProviderStatus = Effect.fn("checkDroidProviderStatus")(
  function* (): Effect.fn.Return<
    ServerProvider,
    ServerSettingsError,
    ChildProcessSpawner.ChildProcessSpawner | ServerSettingsService
  > {
    const droidSettings = yield* Effect.service(ServerSettingsService).pipe(
      Effect.flatMap((service) => service.getSettings),
      Effect.map((settings) => settings.providers.droid),
    );
    const checkedAt = new Date().toISOString();
    const models = providerModelsFromSettings(
      BUILT_IN_MODELS,
      PROVIDER,
      droidSettings.customModels,
    );

    if (!droidSettings.enabled) {
      return buildServerProvider({
        provider: PROVIDER,
        enabled: false,
        checkedAt,
        models,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: "Droid is disabled in T3 Code settings.",
        },
      });
    }

    const versionProbe = yield* runDroidCommand(["--version"]).pipe(
      Effect.timeoutOption(DEFAULT_TIMEOUT_MS),
      Effect.result,
    );

    if (Result.isFailure(versionProbe)) {
      const error = versionProbe.failure;
      return buildServerProvider({
        provider: PROVIDER,
        enabled: droidSettings.enabled,
        checkedAt,
        models,
        probe: {
          installed: !isCommandMissingCause(error),
          version: null,
          status: "error",
          auth: { status: "unknown" },
          message: isCommandMissingCause(error)
            ? "Droid CLI (`droid`) is not installed or not on PATH."
            : `Failed to execute Droid CLI health check: ${error instanceof Error ? error.message : String(error)}.`,
        },
      });
    }

    if (Option.isNone(versionProbe.success)) {
      return buildServerProvider({
        provider: PROVIDER,
        enabled: droidSettings.enabled,
        checkedAt,
        models,
        probe: {
          installed: true,
          version: null,
          status: "error",
          auth: { status: "unknown" },
          message: "Droid CLI is installed but failed to run. Timed out while running command.",
        },
      });
    }

    const version = versionProbe.success.value;
    const parsedVersion = parseGenericCliVersion(`${version.stdout}\n${version.stderr}`);
    if (version.code !== 0) {
      const detail = detailFromResult(version);
      return buildServerProvider({
        provider: PROVIDER,
        enabled: droidSettings.enabled,
        checkedAt,
        models,
        probe: {
          installed: true,
          version: parsedVersion,
          status: "error",
          auth: { status: "unknown" },
          message: detail
            ? `Droid CLI is installed but failed to run. ${detail}`
            : "Droid CLI is installed but failed to run.",
        },
      });
    }

    const authProbe = yield* runDroidCommand([
      "exec",
      "--list-tools",
      "--output-format",
      "json",
    ]).pipe(Effect.timeoutOption(Duration.seconds(8)), Effect.result);

    if (Result.isFailure(authProbe)) {
      const error = authProbe.failure;
      return buildServerProvider({
        provider: PROVIDER,
        enabled: droidSettings.enabled,
        checkedAt,
        models,
        probe: {
          installed: true,
          version: parsedVersion,
          status: "warning",
          auth: { status: "unknown" },
          message:
            error instanceof Error
              ? `Could not verify Droid authentication status: ${error.message}.`
              : "Could not verify Droid authentication status.",
        },
      });
    }

    if (Option.isNone(authProbe.success)) {
      return buildServerProvider({
        provider: PROVIDER,
        enabled: droidSettings.enabled,
        checkedAt,
        models,
        probe: {
          installed: true,
          version: parsedVersion,
          status: "warning",
          auth: { status: "unknown" },
          message: "Could not verify Droid authentication status. Timed out while running command.",
        },
      });
    }

    const parsed = parseDroidAuthStatusFromOutput(authProbe.success.value);
    return buildServerProvider({
      provider: PROVIDER,
      enabled: droidSettings.enabled,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: parsedVersion,
        status: parsed.status,
        auth: {
          ...parsed.auth,
          ...(parsed.auth.status === "authenticated"
            ? { type: "subscription", label: "Factory Subscription" }
            : {}),
        },
        ...(parsed.message ? { message: parsed.message } : {}),
      },
    });
  },
);

export const DroidProviderLive = Layer.effect(
  DroidProvider,
  Effect.gen(function* () {
    const settingsService = yield* ServerSettingsService;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

    const checkProvider = checkDroidProviderStatus().pipe(
      Effect.provideService(ServerSettingsService, settingsService),
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    );

    return yield* makeManagedServerProvider<DroidSettings>({
      getSettings: settingsService.getSettings.pipe(
        Effect.map((settings) => settings.providers.droid),
        Effect.orDie,
      ),
      streamSettings: settingsService.streamChanges.pipe(
        Stream.map((settings) => settings.providers.droid),
      ),
      haveSettingsChanged: (previous, next) => !Equal.equals(previous, next),
      checkProvider,
      refreshInterval: Duration.minutes(1),
    });
  }),
);
