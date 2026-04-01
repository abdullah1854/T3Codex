import {
  DEFAULT_MODEL_BY_PROVIDER,
  type ModelSelection,
  type ProviderInteractionMode,
  type ProviderKind,
  type RuntimeMode,
} from "@t3tools/contracts";
import { DEFAULT_WORK_PROFILE_ID, type WorkProfileId } from "@t3tools/contracts/settings";

export interface WorkProfilePreflight {
  system?: string;
  environment?: string;
  outputFormat?: string;
  target?: string;
  evidence?: string;
}

export type WorkProfilePreflightField = keyof WorkProfilePreflight;

interface WorkProfileDefaults {
  envMode?: "local" | "worktree";
  interactionMode?: ProviderInteractionMode;
  modelSelection?: ModelSelection;
  preflight?: WorkProfilePreflight;
  runtimeMode?: RuntimeMode;
}

export interface WorkProfileDefinition {
  id: WorkProfileId;
  label: string;
  shortLabel: string;
  description: string;
  defaults: WorkProfileDefaults;
}

function codexSelection(reasoningEffort: "medium" | "high") {
  return {
    provider: "codex" as const,
    model: DEFAULT_MODEL_BY_PROVIDER.codex,
    options: {
      reasoningEffort,
    },
  } satisfies ModelSelection;
}

export const WORK_PROFILES: readonly WorkProfileDefinition[] = [
  {
    id: "general",
    label: "General Engineering",
    shortLabel: "General",
    description: "Balanced default for everyday coding work.",
    defaults: {},
  },
  {
    id: "research",
    label: "Deep Research",
    shortLabel: "Research",
    description: "Source-heavy investigation with higher reasoning and evidence capture.",
    defaults: {
      interactionMode: "default",
      modelSelection: codexSelection("high"),
      preflight: {
        outputFormat: "Research brief",
        evidence: "Primary sources, links, and dated findings",
      },
      runtimeMode: "approval-required",
    },
  },
  {
    id: "planning",
    label: "Plan First",
    shortLabel: "Planning",
    description: "Decision-focused planning before implementation.",
    defaults: {
      interactionMode: "plan",
      modelSelection: codexSelection("high"),
      preflight: {
        outputFormat: "Implementation plan",
        evidence: "Current repo state and constraints",
      },
      runtimeMode: "approval-required",
    },
  },
  {
    id: "d365",
    label: "D365 F&O",
    shortLabel: "D365",
    description: "Evidence-first ERP investigation with system and format confirmation.",
    defaults: {
      modelSelection: codexSelection("high"),
      preflight: {
        system: "D365 F&O",
        environment: "Confirm live vs snapshot before acting",
        outputFormat: "Investigation summary",
        evidence: "Logs, query results, and schema checks",
      },
      runtimeMode: "approval-required",
    },
  },
  {
    id: "ax",
    label: "AX / Dynamics",
    shortLabel: "AX",
    description: "AX-focused debugging with explicit DATAAREAID and freshness checks.",
    defaults: {
      modelSelection: codexSelection("high"),
      preflight: {
        system: "AX / Dynamics",
        environment: "Confirm snapshot freshness and DATAAREAID scope",
        outputFormat: "SQL or investigation summary",
        evidence: "Validated schemas and filtered query output",
      },
      runtimeMode: "approval-required",
    },
  },
  {
    id: "fabric",
    label: "Microsoft Fabric",
    shortLabel: "Fabric",
    description: "Lakehouse and Synapse-link work with output-format discipline.",
    defaults: {
      modelSelection: codexSelection("high"),
      preflight: {
        system: "Microsoft Fabric",
        environment: "Confirm workspace, lakehouse, and schema first",
        outputFormat: "SQL or PySpark",
        evidence: "Verified tables, columns, and freshness",
      },
      runtimeMode: "approval-required",
    },
  },
  {
    id: "maximo",
    label: "IBM Maximo",
    shortLabel: "Maximo",
    description: "Operational incident work with site-scoped evidence collection.",
    defaults: {
      modelSelection: codexSelection("high"),
      preflight: {
        system: "IBM Maximo",
        environment: "Confirm SITEID and target environment",
        outputFormat: "Investigation summary or SQL",
        evidence: "Site-filtered records and logs",
      },
      runtimeMode: "approval-required",
    },
  },
  {
    id: "vps",
    label: "VPS / Remote Ops",
    shortLabel: "VPS",
    description: "Remote-server work with path, host, and config confirmation upfront.",
    defaults: {
      envMode: "local",
      modelSelection: codexSelection("high"),
      preflight: {
        system: "Remote VPS",
        environment: "Confirm host, user, and remote path before editing",
        outputFormat: "Working code or config change",
        target: "Server, user, and absolute target path",
        evidence: "Current file contents and service status",
      },
      runtimeMode: "approval-required",
    },
  },
] as const;

export function getWorkProfileDefinition(profileId: WorkProfileId | null | undefined) {
  return (
    WORK_PROFILES.find((profile) => profile.id === profileId) ??
    WORK_PROFILES.find((profile) => profile.id === DEFAULT_WORK_PROFILE_ID)!
  );
}

export function resolveWorkProfileId(
  explicitProfileId: WorkProfileId | null | undefined,
  fallbackProfileId: WorkProfileId | null | undefined,
) {
  return explicitProfileId ?? fallbackProfileId ?? DEFAULT_WORK_PROFILE_ID;
}

export function resolveWorkProfilePreflight(
  profile: WorkProfileDefinition,
  draft: WorkProfilePreflight | null | undefined,
): WorkProfilePreflight {
  return {
    ...profile.defaults.preflight,
    ...draft,
  };
}

export function hasWorkProfilePreflightValues(preflight: WorkProfilePreflight): boolean {
  return Object.values(preflight).some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

export function formatWorkProfilePrompt(input: {
  includeProfileHeader: boolean;
  preflight: WorkProfilePreflight;
  profile: WorkProfileDefinition;
  prompt: string;
}) {
  const sections: string[] = [];

  if (input.includeProfileHeader) {
    sections.push(`Work profile: ${input.profile.label}`);
  }

  const preflightLines: string[] = [];
  if (input.preflight.system?.trim()) {
    preflightLines.push(`- System: ${input.preflight.system.trim()}`);
  }
  if (input.preflight.environment?.trim()) {
    preflightLines.push(`- Environment: ${input.preflight.environment.trim()}`);
  }
  if (input.preflight.outputFormat?.trim()) {
    preflightLines.push(`- Output format: ${input.preflight.outputFormat.trim()}`);
  }
  if (input.preflight.target?.trim()) {
    preflightLines.push(`- Target: ${input.preflight.target.trim()}`);
  }
  if (input.preflight.evidence?.trim()) {
    preflightLines.push(`- Evidence to anchor on: ${input.preflight.evidence.trim()}`);
  }

  if (preflightLines.length > 0) {
    sections.push("Preflight:");
    sections.push(...preflightLines);
  }

  if (sections.length === 0) {
    return input.prompt;
  }

  return `${sections.join("\n")}\n\nTask:\n${input.prompt}`;
}

export function getWorkProfileProvider(profile: WorkProfileDefinition): ProviderKind | null {
  return profile.defaults.modelSelection?.provider ?? null;
}
