import {
  DEFAULT_MODEL_BY_PROVIDER,
  type CodexReasoningEffort,
  type ModelSelection,
  type ProjectEntry,
  type RuntimeMode,
} from "@t3tools/contracts";
import type { WorkProfileDefinition } from "./workProfiles";

export interface WorkspaceCodexDefaults {
  approvalPolicy: "granular" | "never" | "on-request" | "untrusted" | null;
  modelSelection: ModelSelection | null;
  planModeReasoningEffort: CodexReasoningEffort | null;
  reasoningEffort: CodexReasoningEffort | null;
  runtimeMode: RuntimeMode | null;
  sandboxMode: "danger-full-access" | "read-only" | "workspace-write" | null;
  webSearchMode: "cached" | "disabled" | "live" | null;
}

export interface WorkspaceCodexProfileSummary {
  defaults: WorkspaceCodexDefaults;
  name: string;
}

export interface WorkspaceCodexSummary {
  hasAgentsMd: boolean;
  hasConfigToml: boolean;
  skills: string[];
  agents: string[];
  profiles: WorkspaceCodexProfileSummary[];
  configPreview: string | null;
  agentsPreview: string | null;
  workspaceDefaults: WorkspaceCodexDefaults | null;
}

export type WorkspaceCodexScaffoldTarget = "agent" | "agents-doc" | "config" | "skill";

export interface WorkspaceCodexScaffoldFile {
  contents: string;
  label: string;
  relativePath: string;
}

const CODEX_REASONING_EFFORTS = new Set<CodexReasoningEffort>(["low", "medium", "high", "xhigh"]);

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchTomlString(contents: string | null | undefined, key: string): string | null {
  if (!contents) {
    return null;
  }
  const pattern = new RegExp(`^${escapeForRegex(key)}\\s*=\\s*"([^"\\r\\n]+)"`, "m");
  const match = contents.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function normalizeReasoningEffort(value: string | null): CodexReasoningEffort | null {
  if (!value || !CODEX_REASONING_EFFORTS.has(value as CodexReasoningEffort)) {
    return null;
  }
  return value as CodexReasoningEffort;
}

function deriveWorkspaceCodexDefaults(
  configContents: string | null | undefined,
): WorkspaceCodexDefaults | null {
  if (!configContents) {
    return null;
  }

  const model = matchTomlString(configContents, "model");
  const reasoningEffort = normalizeReasoningEffort(
    matchTomlString(configContents, "model_reasoning_effort"),
  );
  const planModeReasoningEffort = normalizeReasoningEffort(
    matchTomlString(configContents, "plan_mode_reasoning_effort"),
  );
  const approvalPolicy =
    (matchTomlString(
      configContents,
      "approval_policy",
    ) as WorkspaceCodexDefaults["approvalPolicy"]) ??
    (/^approval_policy\s*=\s*\{/m.test(configContents) ? "granular" : null);
  const sandboxMode =
    (matchTomlString(configContents, "sandbox_mode") as WorkspaceCodexDefaults["sandboxMode"]) ??
    null;
  const webSearchMode =
    (matchTomlString(configContents, "web_search") as WorkspaceCodexDefaults["webSearchMode"]) ??
    null;

  const modelSelection =
    model || reasoningEffort
      ? ({
          provider: "codex",
          model: model ?? DEFAULT_MODEL_BY_PROVIDER.codex,
          ...(reasoningEffort ? { options: { reasoningEffort } } : {}),
        } satisfies ModelSelection)
      : null;

  const runtimeMode: RuntimeMode | null =
    sandboxMode === "danger-full-access" && approvalPolicy === "never"
      ? "full-access"
      : approvalPolicy || sandboxMode
        ? "approval-required"
        : null;

  if (
    !modelSelection &&
    !approvalPolicy &&
    !sandboxMode &&
    !planModeReasoningEffort &&
    !webSearchMode
  ) {
    return null;
  }

  return {
    approvalPolicy,
    modelSelection,
    planModeReasoningEffort,
    reasoningEffort,
    runtimeMode,
    sandboxMode,
    webSearchMode,
  };
}

function parseWorkspaceCodexProfiles(
  configContents: string | null | undefined,
): WorkspaceCodexProfileSummary[] {
  if (!configContents) {
    return [];
  }

  const lines = configContents.split(/\r?\n/);
  const profiles = new Map<string, string[]>();
  let activeProfileName: string | null = null;

  for (const line of lines) {
    const profileMatch = line.match(/^\[profiles\.([A-Za-z0-9_-]+)\]\s*$/);
    if (profileMatch) {
      activeProfileName = profileMatch[1] ?? null;
      if (activeProfileName && !profiles.has(activeProfileName)) {
        profiles.set(activeProfileName, []);
      }
      continue;
    }

    if (/^\[[^\]]+\]\s*$/.test(line)) {
      activeProfileName = null;
      continue;
    }

    if (activeProfileName) {
      profiles.get(activeProfileName)?.push(line);
    }
  }

  return Array.from(profiles.entries())
    .map(([name, sectionLines]) => {
      const defaults = deriveWorkspaceCodexDefaults(sectionLines.join("\n"));
      return defaults ? { name, defaults } : null;
    })
    .filter((entry): entry is WorkspaceCodexProfileSummary => entry !== null)
    .toSorted((left, right) => left.name.localeCompare(right.name));
}

function firstNonEmptyLine(contents: string | null | undefined): string | null {
  if (!contents) {
    return null;
  }
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed.length > 96 ? `${trimmed.slice(0, 93)}...` : trimmed;
    }
  }
  return null;
}

export function deriveWorkspaceCodexSummary(input: {
  codexEntries: ReadonlyArray<ProjectEntry>;
  agentsDocEntries: ReadonlyArray<ProjectEntry>;
  configContents?: string | null;
  agentsContents?: string | null;
}): WorkspaceCodexSummary {
  const codexFiles = input.codexEntries.filter((entry) => entry.kind === "file");
  return {
    hasAgentsMd: input.agentsDocEntries.some((entry) => entry.path === "AGENTS.md"),
    hasConfigToml: codexFiles.some((entry) => entry.path === ".codex/config.toml"),
    skills: codexFiles
      .filter(
        (entry) => entry.path.startsWith(".codex/skills/") && entry.path.endsWith("/SKILL.md"),
      )
      .map((entry) => entry.path),
    agents: codexFiles
      .filter((entry) => entry.path.startsWith(".codex/agents/") && entry.path.endsWith(".toml"))
      .map((entry) => entry.path),
    profiles: parseWorkspaceCodexProfiles(input.configContents),
    configPreview: firstNonEmptyLine(input.configContents),
    agentsPreview: firstNonEmptyLine(input.agentsContents),
    workspaceDefaults: deriveWorkspaceCodexDefaults(input.configContents),
  };
}

export function resolveWorkspaceCodexProfile(
  summary: WorkspaceCodexSummary | null | undefined,
  profileName: string | null | undefined,
): WorkspaceCodexProfileSummary | null {
  if (!summary || !profileName) {
    return null;
  }
  return summary.profiles.find((profile) => profile.name === profileName) ?? null;
}

function scoreWorkspaceCodexProfileMatch(
  profile: WorkspaceCodexProfileSummary,
  workProfile: WorkProfileDefinition,
): number {
  let score = 0;
  const normalizedName = profile.name.toLowerCase();
  const nameTokens = new Set(
    [workProfile.id, workProfile.shortLabel, workProfile.label]
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 1),
  );

  for (const token of nameTokens) {
    if (normalizedName.includes(token)) {
      score += 4;
    }
  }

  if (
    workProfile.defaults.runtimeMode &&
    profile.defaults.runtimeMode === workProfile.defaults.runtimeMode
  ) {
    score += 2;
  }

  if (
    workProfile.defaults.interactionMode === "plan" &&
    profile.defaults.planModeReasoningEffort !== null
  ) {
    score += 3;
  }

  if (workProfile.defaults.modelSelection?.provider === profile.defaults.modelSelection?.provider) {
    score += 1;
  }

  if (
    workProfile.defaults.modelSelection?.model &&
    workProfile.defaults.modelSelection.model === profile.defaults.modelSelection?.model
  ) {
    score += 2;
  }

  const workProfileReasoning =
    workProfile.defaults.modelSelection?.provider === "codex"
      ? (workProfile.defaults.modelSelection.options?.reasoningEffort ?? null)
      : null;
  if (
    workProfileReasoning !== null &&
    (profile.defaults.reasoningEffort === workProfileReasoning ||
      profile.defaults.planModeReasoningEffort === workProfileReasoning)
  ) {
    score += 2;
  }

  if (workProfile.id === "research" && profile.defaults.webSearchMode !== null) {
    score += 2;
  }

  return score;
}

export function findBestWorkspaceCodexProfileMatch(
  summary: WorkspaceCodexSummary | null | undefined,
  workProfile: WorkProfileDefinition,
): WorkspaceCodexProfileSummary | null {
  if (!summary || summary.profiles.length === 0) {
    return null;
  }

  const ranked = summary.profiles
    .map((profile) => ({ profile, score: scoreWorkspaceCodexProfileMatch(profile, workProfile) }))
    .toSorted((left, right) => right.score - left.score);
  const best = ranked[0] ?? null;
  return best && best.score > 0 ? best.profile : null;
}

export function scaffoldWorkspaceCodexFile(
  target: WorkspaceCodexScaffoldTarget,
): WorkspaceCodexScaffoldFile {
  switch (target) {
    case "agents-doc":
      return {
        label: "AGENTS.md",
        relativePath: "AGENTS.md",
        contents: `# AGENTS.md

## Operating rules

- Confirm the target system and environment before acting.
- Show evidence before conclusions.
- Make the smallest change that solves the task.
- Verify the outcome before reporting back.
`,
      };
    case "config":
      return {
        label: ".codex/config.toml",
        relativePath: ".codex/config.toml",
        contents: `model = "${DEFAULT_MODEL_BY_PROVIDER.codex}"
model_reasoning_effort = "medium"
plan_mode_reasoning_effort = "high"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
web_search = "cached"
`,
      };
    case "skill":
      return {
        label: "starter skill",
        relativePath: ".codex/skills/workflow-helper/SKILL.md",
        contents: `# Workflow Helper

## When to use

Use this skill when the repo needs a repeatable local workflow.

## Instructions

1. Confirm the target area before changing files.
2. Gather the minimum evidence needed.
3. Make the smallest safe change.
4. Report what changed and how it was verified.
`,
      };
    case "agent":
      return {
        label: "starter agent",
        relativePath: ".codex/agents/reviewer.toml",
        contents: `name = "reviewer"
description = "Read-only reviewer focused on correctness, regressions, and missing tests."
model = "${DEFAULT_MODEL_BY_PROVIDER.codex}"
model_reasoning_effort = "high"
sandbox_mode = "read-only"
developer_instructions = """
Review changes like an owner.
Lead with concrete findings.
Prefer correctness, behavior, and risk over style.
"""
`,
      };
  }
}
