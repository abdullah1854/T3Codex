import type { ProviderKind } from "./orchestration";

export interface ProviderDescriptor {
  readonly provider: ProviderKind;
  readonly label: string;
  readonly description: string;
}

export const PROVIDER_CATALOG: ReadonlyArray<ProviderDescriptor> = [
  {
    provider: "codex",
    label: "Codex",
    description: "OpenAI's terminal-first coding agent.",
  },
  {
    provider: "claudeAgent",
    label: "Claude",
    description: "Anthropic's coding agent and SDK workflow.",
  },
  {
    provider: "droid",
    label: "Droid",
    description: "Factory's coding agent with subscription-backed model access.",
  },
];

export const PROVIDER_DESCRIPTORS: Record<ProviderKind, ProviderDescriptor> = Object.fromEntries(
  PROVIDER_CATALOG.map((descriptor) => [descriptor.provider, descriptor]),
) as Record<ProviderKind, ProviderDescriptor>;

export function getProviderDescriptor(provider: ProviderKind): ProviderDescriptor {
  return PROVIDER_DESCRIPTORS[provider];
}
