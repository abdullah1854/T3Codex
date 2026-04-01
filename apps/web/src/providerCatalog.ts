import {
  PROVIDER_CATALOG,
  PROVIDER_DISPLAY_NAMES,
  type ProviderKind,
  type ServerProvider,
} from "@t3tools/contracts";

export type ProviderPickerKind = ProviderKind | "cursor";

export interface ProviderPickerOption {
  readonly value: ProviderPickerKind;
  readonly label: string;
  readonly description: string;
  readonly available: boolean;
}

export interface ComingSoonProviderOption {
  readonly id: "gemini" | "opencode";
  readonly label: string;
  readonly description: string;
}

export const PROVIDER_PICKER_OPTIONS: ReadonlyArray<ProviderPickerOption> = [
  ...PROVIDER_CATALOG.map((descriptor) => ({
    value: descriptor.provider,
    label: descriptor.label,
    description: descriptor.description,
    available: true,
  })),
  {
    value: "cursor",
    label: "Cursor",
    description: "Reserved for future workspace-aware integration.",
    available: false,
  },
];

export const AVAILABLE_PROVIDER_OPTIONS = PROVIDER_PICKER_OPTIONS.filter(
  (option): option is ProviderPickerOption & { value: ProviderKind; available: true } =>
    option.available,
);

export const UNAVAILABLE_PROVIDER_OPTIONS = PROVIDER_PICKER_OPTIONS.filter(
  (option) => !option.available,
);

export const COMING_SOON_PROVIDER_OPTIONS: ReadonlyArray<ComingSoonProviderOption> = [
  {
    id: "opencode",
    label: "OpenCode",
    description: "Agent runtime placeholder.",
  },
  {
    id: "gemini",
    label: "Gemini",
    description: "Google provider placeholder.",
  },
];

export type ProviderAvailabilityState =
  | "ready"
  | "disabled"
  | "not-installed"
  | "auth-required"
  | "no-models"
  | "warning"
  | "error";

export interface ProviderAvailability {
  readonly state: ProviderAvailabilityState;
  readonly selectable: boolean;
  readonly badgeLabel: string | null;
  readonly message: string | null;
}

export function getProviderAvailability(
  provider: ServerProvider | null | undefined,
): ProviderAvailability {
  if (!provider) {
    return {
      state: "ready",
      selectable: true,
      badgeLabel: null,
      message: null,
    };
  }

  const providerLabel = PROVIDER_DISPLAY_NAMES[provider.provider] ?? provider.provider;

  if (!provider.enabled || provider.status === "disabled") {
    return {
      state: "disabled",
      selectable: false,
      badgeLabel: "Disabled",
      message: provider.message ?? `${providerLabel} is disabled in this workspace.`,
    };
  }

  if (!provider.installed) {
    return {
      state: "not-installed",
      selectable: false,
      badgeLabel: "Not installed",
      message: provider.message ?? `${providerLabel} is not installed on this machine.`,
    };
  }

  if (provider.auth.status === "unauthenticated") {
    return {
      state: "auth-required",
      selectable: false,
      badgeLabel: "Sign in",
      message: provider.message ?? `${providerLabel} needs authentication before it can run.`,
    };
  }

  if (provider.status === "error") {
    return {
      state: "error",
      selectable: false,
      badgeLabel: "Unavailable",
      message: provider.message ?? `${providerLabel} provider is unavailable.`,
    };
  }

  if (provider.models.length === 0) {
    return {
      state: "no-models",
      selectable: false,
      badgeLabel: "No models",
      message: provider.message ?? `${providerLabel} is available, but no models were discovered.`,
    };
  }

  if (provider.status === "warning") {
    return {
      state: "warning",
      selectable: true,
      badgeLabel: "Limited",
      message: provider.message ?? `${providerLabel} provider has limited availability.`,
    };
  }

  return {
    state: "ready",
    selectable: true,
    badgeLabel: null,
    message: provider.message ?? null,
  };
}
