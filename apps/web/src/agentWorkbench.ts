import type {
  GitStatusResult,
  ProviderInteractionMode,
  ProviderKind,
  RuntimeMode,
  TurnId,
} from "@t3tools/contracts";

import type { ProjectSpecialization } from "./projectSpecializations";
import type { ProjectScript, TurnDiffFileChange } from "./types";
import type { WorkProfileDefinition, WorkProfilePreflight } from "./workProfiles";
import type { WorkspaceCodexSummary } from "./workspaceCodex";

export type AgentInstructionLayerTone = "active" | "info" | "muted" | "missing";

export interface AgentInstructionLayer {
  id: string;
  label: string;
  source: string;
  summary: string;
  tone: AgentInstructionLayerTone;
  details: string[];
}

export type VerificationScriptRole = "lint" | "typecheck" | "build" | "test";
export type VerificationRunStatus = "running" | "passed" | "failed";

export interface VerificationScriptDefinition {
  id: string;
  name: string;
  command: string;
  icon: ProjectScript["icon"];
  role: VerificationScriptRole;
}

export interface VerificationRunRecord {
  completedAt: string | null;
  error: string | null;
  exitCode: number | null;
  exitSignal: number | null;
  role: VerificationScriptRole;
  runId: string;
  scriptCommand: string;
  scriptId: string;
  scriptName: string;
  startedAt: string;
  status: VerificationRunStatus;
  terminalId: string;
  threadId: string;
  turnId: string | null;
}

export interface VerificationSummary {
  failedCount: number;
  passedCount: number;
  pendingCount: number;
  runningCount: number;
  status: "idle" | "pending" | "running" | "passed" | "failed";
}

export type ReviewReadinessItemStatus = "good" | "info" | "pending" | "attention";
export type ReviewReadinessStatus = "ready" | "pending" | "attention";

export interface ReviewReadinessItem {
  id: string;
  label: string;
  status: ReviewReadinessItemStatus;
  detail: string;
}

export interface ReviewReadinessSummary {
  headline: string;
  nextStep: string;
  items: ReviewReadinessItem[];
  status: ReviewReadinessStatus;
}

const ROLE_ORDER: VerificationScriptRole[] = ["lint", "typecheck", "build", "test"];

function detectVerificationRole(script: ProjectScript): {
  role: VerificationScriptRole;
  score: number;
} | null {
  const haystack = `${script.name}\n${script.command}`.toLowerCase();

  const scores: Array<{ role: VerificationScriptRole; score: number }> = [];

  if (
    /\b(typecheck|type-check|check-types?|tsc(\s|$)|ts\.?check)\b/.test(haystack) ||
    (script.icon === "configure" && /\btypes?\b/.test(haystack))
  ) {
    scores.push({ role: "typecheck", score: /\btypecheck\b/.test(haystack) ? 12 : 9 });
  }

  if (
    script.icon === "lint" ||
    /\b(lint|eslint|oxlint|biome\s+check|prettier\s+--check)\b/.test(haystack)
  ) {
    scores.push({ role: "lint", score: script.icon === "lint" ? 11 : 9 });
  }

  if (
    script.icon === "build" ||
    /\b(build|compile|bundle|vite\s+build|next\s+build)\b/.test(haystack)
  ) {
    scores.push({ role: "build", score: script.icon === "build" ? 10 : 8 });
  }

  if (
    script.icon === "test" ||
    /\b(test|vitest|jest|playwright|cypress|bun\s+run\s+test|npm\s+run\s+test|pnpm\s+test)\b/.test(
      haystack,
    )
  ) {
    scores.push({ role: "test", score: script.icon === "test" ? 10 : 8 });
  }

  if (scores.length === 0) {
    return null;
  }

  return scores.toSorted((left, right) => right.score - left.score)[0] ?? null;
}

export function deriveVerificationScripts(
  scripts: readonly ProjectScript[],
): VerificationScriptDefinition[] {
  const bestByRole = new Map<
    VerificationScriptRole,
    {
      definition: VerificationScriptDefinition;
      score: number;
    }
  >();

  for (const script of scripts) {
    const match = detectVerificationRole(script);
    if (!match) {
      continue;
    }

    const current = bestByRole.get(match.role);
    const next = {
      definition: {
        id: script.id,
        name: script.name,
        command: script.command,
        icon: script.icon,
        role: match.role,
      },
      score: match.score,
    };

    if (!current || next.score > current.score) {
      bestByRole.set(match.role, next);
    }
  }

  return ROLE_ORDER.map((role) => bestByRole.get(role)?.definition ?? null).filter(
    (value): value is VerificationScriptDefinition => value !== null,
  );
}

function formatPreflightDetails(preflight: WorkProfilePreflight): string[] {
  const details: string[] = [];
  if (preflight.system?.trim()) {
    details.push(`System: ${preflight.system.trim()}`);
  }
  if (preflight.environment?.trim()) {
    details.push(`Environment: ${preflight.environment.trim()}`);
  }
  if (preflight.outputFormat?.trim()) {
    details.push(`Output: ${preflight.outputFormat.trim()}`);
  }
  if (preflight.target?.trim()) {
    details.push(`Target: ${preflight.target.trim()}`);
  }
  if (preflight.evidence?.trim()) {
    details.push(`Evidence: ${preflight.evidence.trim()}`);
  }
  return details;
}

export function deriveInstructionLayers(input: {
  interactionMode: ProviderInteractionMode;
  preflight: WorkProfilePreflight;
  projectSpecialization: ProjectSpecialization | null;
  runtimeMode: RuntimeMode;
  selectedProvider: ProviderKind;
  selectedWorkspaceCodexProfileName: string | null;
  suggestedWorkspaceCodexProfileName: string | null;
  workProfile: WorkProfileDefinition;
  workspaceCodexSummary: WorkspaceCodexSummary | null;
  workspaceDefaultsSuppressed: boolean;
}): AgentInstructionLayer[] {
  const layers: AgentInstructionLayer[] = [
    {
      id: "work-profile",
      label: input.workProfile.label,
      source: "Work profile",
      summary: input.workProfile.description,
      tone: "active",
      details: formatPreflightDetails(input.preflight),
    },
  ];

  if (input.projectSpecialization) {
    layers.push({
      id: "project-specialization",
      label: input.projectSpecialization.label,
      source: "Project specialization",
      summary: input.projectSpecialization.description,
      tone: "active",
      details: [...input.projectSpecialization.focusAreas],
    });
  }

  layers.push({
    id: "agents-md",
    label: "AGENTS.md",
    source: "Repo instructions",
    summary: input.workspaceCodexSummary?.hasAgentsMd
      ? (input.workspaceCodexSummary.agentsPreview ?? "Workspace instructions are available.")
      : "This repo does not expose an AGENTS.md file yet.",
    tone: input.workspaceCodexSummary?.hasAgentsMd ? "active" : "missing",
    details: input.workspaceCodexSummary?.hasAgentsMd
      ? ["Agent-facing instructions will be picked up for this workspace."]
      : ["Create AGENTS.md to make repo-specific expectations explicit."],
  });

  layers.push({
    id: "codex-config",
    label: ".codex/config.toml",
    source: "Repo defaults",
    summary: input.workspaceCodexSummary?.hasConfigToml
      ? input.workspaceDefaultsSuppressed
        ? "Repo defaults exist, but they are muted for this draft."
        : (input.workspaceCodexSummary.configPreview ?? "Repo-level Codex defaults are active.")
      : "No repo-local Codex config is present.",
    tone: input.workspaceCodexSummary?.hasConfigToml
      ? input.workspaceDefaultsSuppressed
        ? "muted"
        : "active"
      : "missing",
    details: input.workspaceCodexSummary?.workspaceDefaults
      ? [
          input.workspaceCodexSummary.workspaceDefaults.modelSelection
            ? `Model: ${input.workspaceCodexSummary.workspaceDefaults.modelSelection.model}`
            : null,
          input.workspaceCodexSummary.workspaceDefaults.reasoningEffort
            ? `Reasoning: ${input.workspaceCodexSummary.workspaceDefaults.reasoningEffort}`
            : null,
          input.workspaceCodexSummary.workspaceDefaults.webSearchMode
            ? `Web search: ${input.workspaceCodexSummary.workspaceDefaults.webSearchMode}`
            : null,
        ].filter((value): value is string => value !== null)
      : ["Add repo defaults here to keep agent behavior consistent across sessions."],
  });

  if (input.selectedWorkspaceCodexProfileName || input.suggestedWorkspaceCodexProfileName) {
    layers.push({
      id: "workspace-profile",
      label: input.selectedWorkspaceCodexProfileName ?? input.suggestedWorkspaceCodexProfileName!,
      source: input.selectedWorkspaceCodexProfileName
        ? "Selected repo profile"
        : "Suggested repo profile",
      summary: input.selectedWorkspaceCodexProfileName
        ? "This draft is pinned to a named repo-local Codex profile."
        : "A repo-local Codex profile is available and matches the current workflow.",
      tone: input.selectedWorkspaceCodexProfileName ? "active" : "info",
      details: [
        input.selectedWorkspaceCodexProfileName
          ? `Selected profile: ${input.selectedWorkspaceCodexProfileName}`
          : null,
        input.suggestedWorkspaceCodexProfileName
          ? `Best match: ${input.suggestedWorkspaceCodexProfileName}`
          : null,
      ].filter((value): value is string => value !== null),
    });
  }

  layers.push({
    id: "runtime-envelope",
    label: `${input.selectedProvider} · ${input.runtimeMode}`,
    source: "Execution envelope",
    summary: `Interaction mode is ${input.interactionMode}.`,
    tone: "info",
    details: [
      `Provider: ${input.selectedProvider}`,
      `Runtime mode: ${input.runtimeMode}`,
      `Interaction mode: ${input.interactionMode}`,
    ],
  });

  return layers;
}

export function deriveVerificationSummary(input: {
  requiredTurnId: TurnId | string | null;
  runs: readonly VerificationRunRecord[];
  scripts: readonly VerificationScriptDefinition[];
}): VerificationSummary {
  if (input.scripts.length === 0) {
    return {
      failedCount: 0,
      passedCount: 0,
      pendingCount: 0,
      runningCount: 0,
      status: "idle",
    };
  }

  const latestRunByScriptId = new Map<string, VerificationRunRecord>();
  for (const run of input.runs) {
    if (input.requiredTurnId && run.turnId !== input.requiredTurnId) {
      continue;
    }
    const current = latestRunByScriptId.get(run.scriptId);
    if (!current || current.startedAt < run.startedAt) {
      latestRunByScriptId.set(run.scriptId, run);
    }
  }

  let passedCount = 0;
  let failedCount = 0;
  let runningCount = 0;

  for (const script of input.scripts) {
    const run = latestRunByScriptId.get(script.id);
    if (!run) {
      continue;
    }
    if (run.status === "passed") {
      passedCount += 1;
      continue;
    }
    if (run.status === "failed") {
      failedCount += 1;
      continue;
    }
    runningCount += 1;
  }

  const pendingCount = Math.max(0, input.scripts.length - passedCount - failedCount - runningCount);

  if (failedCount > 0) {
    return {
      failedCount,
      passedCount,
      pendingCount,
      runningCount,
      status: "failed",
    };
  }
  if (runningCount > 0) {
    return {
      failedCount,
      passedCount,
      pendingCount,
      runningCount,
      status: "running",
    };
  }
  if (passedCount === input.scripts.length && input.scripts.length > 0) {
    return {
      failedCount,
      passedCount,
      pendingCount,
      runningCount,
      status: "passed",
    };
  }
  return {
    failedCount,
    passedCount,
    pendingCount,
    runningCount,
    status: "pending",
  };
}

export function selectLatestVerificationRunsByScriptId(input: {
  requiredTurnId: TurnId | string | null;
  runs: readonly VerificationRunRecord[];
}) {
  const latestRunByScriptId = new Map<string, VerificationRunRecord>();
  for (const run of input.runs) {
    if (input.requiredTurnId && run.turnId !== input.requiredTurnId) {
      continue;
    }
    const current = latestRunByScriptId.get(run.scriptId);
    if (!current || current.startedAt < run.startedAt) {
      latestRunByScriptId.set(run.scriptId, run);
    }
  }
  return latestRunByScriptId;
}

function formatFileCountLabel(count: number) {
  return `${count} changed file${count === 1 ? "" : "s"}`;
}

export function deriveReviewReadiness(input: {
  activeBranch: string | null;
  activeWorktreePath: string | null;
  changedFiles: readonly TurnDiffFileChange[];
  gitStatus: GitStatusResult | null;
  isCurrentBranchDefault: boolean;
  verificationSummary: VerificationSummary;
  verificationScripts: readonly VerificationScriptDefinition[];
}): ReviewReadinessSummary {
  const items: ReviewReadinessItem[] = [];

  if (input.changedFiles.length > 0) {
    items.push({
      id: "changes",
      label: "Changed files",
      status: "good",
      detail: `${formatFileCountLabel(input.changedFiles.length)} captured for review.`,
    });
  } else if (input.gitStatus?.hasWorkingTreeChanges) {
    items.push({
      id: "changes",
      label: "Changed files",
      status: "pending",
      detail:
        "The repository is dirty, but the latest turn does not have captured changed files yet.",
    });
  } else {
    items.push({
      id: "changes",
      label: "Changed files",
      status: "pending",
      detail: "No changed files are attached to the latest turn yet.",
    });
  }

  if (input.activeWorktreePath) {
    items.push({
      id: "isolation",
      label: "Isolation",
      status: "good",
      detail: `Work is isolated in ${input.activeWorktreePath}.`,
    });
  } else if (input.activeBranch && input.isCurrentBranchDefault) {
    items.push({
      id: "isolation",
      label: "Isolation",
      status: "attention",
      detail: `Work is happening directly on the default branch (${input.activeBranch}).`,
    });
  } else if (input.activeBranch) {
    items.push({
      id: "isolation",
      label: "Isolation",
      status: "info",
      detail: `Work is in the main repo checkout on branch ${input.activeBranch}.`,
    });
  } else {
    items.push({
      id: "isolation",
      label: "Isolation",
      status: "attention",
      detail: "No active branch is available for safe handoff or PR work.",
    });
  }

  if (input.verificationScripts.length === 0) {
    items.push({
      id: "verification",
      label: "Verification",
      status: "pending",
      detail: "No recommended verification scripts are configured for this project yet.",
    });
  } else if (input.verificationSummary.status === "passed") {
    items.push({
      id: "verification",
      label: "Verification",
      status: "good",
      detail: `${input.verificationSummary.passedCount}/${input.verificationScripts.length} recommended checks passed.`,
    });
  } else if (input.verificationSummary.status === "failed") {
    items.push({
      id: "verification",
      label: "Verification",
      status: "attention",
      detail: `${input.verificationSummary.failedCount} check${input.verificationSummary.failedCount === 1 ? "" : "s"} failed for the current turn.`,
    });
  } else if (input.verificationSummary.status === "running") {
    items.push({
      id: "verification",
      label: "Verification",
      status: "pending",
      detail: `${input.verificationSummary.runningCount} check${input.verificationSummary.runningCount === 1 ? "" : "s"} still running.`,
    });
  } else {
    items.push({
      id: "verification",
      label: "Verification",
      status: "pending",
      detail: `${input.verificationSummary.passedCount}/${input.verificationScripts.length} recommended checks passed so far.`,
    });
  }

  if (!input.gitStatus) {
    items.push({
      id: "publication",
      label: "Publication",
      status: "info",
      detail: "Git publication status is unavailable.",
    });
  } else if (input.gitStatus.pr?.state === "open") {
    items.push({
      id: "publication",
      label: "Publication",
      status: "good",
      detail: `Open PR #${input.gitStatus.pr.number} already exists for this branch.`,
    });
  } else if (input.gitStatus.behindCount > 0) {
    items.push({
      id: "publication",
      label: "Publication",
      status: "attention",
      detail: `Branch is behind upstream by ${input.gitStatus.behindCount} commit${input.gitStatus.behindCount === 1 ? "" : "s"}.`,
    });
  } else if (input.gitStatus.hasWorkingTreeChanges) {
    items.push({
      id: "publication",
      label: "Publication",
      status: "pending",
      detail: "Working tree still has uncommitted changes.",
    });
  } else if (input.gitStatus.aheadCount > 0) {
    items.push({
      id: "publication",
      label: "Publication",
      status: "good",
      detail: `Branch is ahead by ${input.gitStatus.aheadCount} commit${input.gitStatus.aheadCount === 1 ? "" : "s"} and is ready for push or PR.`,
    });
  } else if (input.gitStatus.branch) {
    items.push({
      id: "publication",
      label: "Publication",
      status: "info",
      detail: `Branch ${input.gitStatus.branch} has no unpublished commits yet.`,
    });
  } else {
    items.push({
      id: "publication",
      label: "Publication",
      status: "attention",
      detail: "Detached HEAD: checkout or create a branch before shipping this work.",
    });
  }

  const hasAttention = items.some((item) => item.status === "attention");
  const hasPending = items.some((item) => item.status === "pending");

  const status: ReviewReadinessStatus = hasAttention
    ? "attention"
    : hasPending
      ? "pending"
      : "ready";

  const headline =
    status === "ready"
      ? "This thread is packaged cleanly for review or handoff."
      : status === "attention"
        ? "This thread needs attention before it is safe to hand off."
        : "This thread is partly packaged, but it still needs review work.";

  let nextStep = "Review the package and share it.";
  if (input.verificationSummary.status === "failed") {
    nextStep = "Fix the failing verification checks before handing this off.";
  } else if (
    input.verificationScripts.length > 0 &&
    input.verificationSummary.status !== "passed"
  ) {
    nextStep = "Run the recommended verification checks for the latest turn.";
  } else if (!input.gitStatus?.branch) {
    nextStep = "Create or checkout a branch before turning this into reviewable work.";
  } else if (input.isCurrentBranchDefault) {
    nextStep = "Move this work onto a feature branch before sharing it.";
  } else if (input.gitStatus?.behindCount && input.gitStatus.behindCount > 0) {
    nextStep = "Pull or rebase the branch before pushing or opening a PR.";
  } else if (input.gitStatus?.hasWorkingTreeChanges) {
    nextStep = "Commit the reviewed changes so they can be pushed or turned into a PR.";
  } else if (input.gitStatus?.pr?.state === "open") {
    nextStep = "Share the open PR together with the handoff package.";
  } else if (input.gitStatus?.aheadCount && input.gitStatus.aheadCount > 0) {
    nextStep = "Open a pull request or push the branch for review.";
  } else if (input.changedFiles.length === 0) {
    nextStep = "Capture the changed files or make a fresh reviewed edit before handing off.";
  }

  return {
    headline,
    items,
    nextStep,
    status,
  };
}

export function formatVerificationRoleLabel(role: VerificationScriptRole): string {
  if (role === "typecheck") {
    return "Typecheck";
  }
  return `${role.slice(0, 1).toUpperCase()}${role.slice(1)}`;
}

export function formatReviewReadinessStatusLabel(status: ReviewReadinessStatus): string {
  if (status === "ready") {
    return "Ready";
  }
  if (status === "attention") {
    return "Attention";
  }
  return "Pending";
}

function buildOptionalList(values: readonly string[]) {
  return values.length > 0 ? values.join(", ") : "None";
}

export function buildAgentHandoffMarkdown(input: {
  activeBranch: string | null;
  activeProjectName: string | undefined;
  activeProjectPath: string | null;
  activeThreadTitle: string;
  activeWorktreePath: string | null;
  gitStatus: GitStatusResult | null;
  interactionMode: ProviderInteractionMode;
  latestChangedFiles: readonly TurnDiffFileChange[];
  preflight: WorkProfilePreflight;
  projectSpecialization: ProjectSpecialization | null;
  prompt: string;
  reviewReadiness: ReviewReadinessSummary;
  runtimeMode: RuntimeMode;
  selectedProvider: ProviderKind;
  selectedWorkspaceCodexProfileName: string | null;
  suggestedWorkspaceCodexProfileName: string | null;
  verificationRequiredTurnId: TurnId | string | null;
  verificationRuns: readonly VerificationRunRecord[];
  verificationScripts: readonly VerificationScriptDefinition[];
  verificationSummary: VerificationSummary;
  workProfileLabel: string;
  workspaceCodexSummary: WorkspaceCodexSummary | null;
  workspaceDefaultsSuppressed: boolean;
}) {
  const latestRunByScriptId = selectLatestVerificationRunsByScriptId({
    requiredTurnId: input.verificationRequiredTurnId,
    runs: input.verificationRuns,
  });

  const lines: string[] = [
    "# Resume / Handoff",
    "",
    "## Current thread",
    `- Thread: ${input.activeThreadTitle}`,
    `- Project: ${input.activeProjectName ?? "No project"}`,
    `- Path: ${input.activeProjectPath ?? "No workspace path"}`,
    `- Branch: ${input.activeBranch ?? "No active branch"}`,
    `- Worktree: ${input.activeWorktreePath ?? "Main repo checkout"}`,
    `- Project specialization: ${input.projectSpecialization?.label ?? "None"}`,
    `- Workflow profile: ${input.workProfileLabel}`,
    `- Provider: ${input.selectedProvider}`,
    `- Runtime mode: ${input.runtimeMode}`,
    `- Interaction mode: ${input.interactionMode}`,
    `- Repo defaults: ${input.workspaceDefaultsSuppressed ? "Muted for this draft" : "Active"}`,
    `- Selected repo Codex profile: ${input.selectedWorkspaceCodexProfileName ?? "Workspace defaults"}`,
    `- Best matching repo Codex profile: ${input.suggestedWorkspaceCodexProfileName ?? "No named match"}`,
    "",
    "## Review readiness",
    `- Status: ${formatReviewReadinessStatusLabel(input.reviewReadiness.status)}`,
    `- Headline: ${input.reviewReadiness.headline}`,
    `- Next step: ${input.reviewReadiness.nextStep}`,
  ];

  for (const item of input.reviewReadiness.items) {
    lines.push(`- ${item.label}: ${item.detail}`);
  }

  lines.push(
    "",
    "## Preflight",
    `- System: ${input.preflight.system?.trim() || "Not set"}`,
    `- Environment: ${input.preflight.environment?.trim() || "Not set"}`,
    `- Output format: ${input.preflight.outputFormat?.trim() || "Not set"}`,
    `- Target: ${input.preflight.target?.trim() || "Not set"}`,
    `- Evidence: ${input.preflight.evidence?.trim() || "Not set"}`,
    "",
    "## Verification",
    `- Summary: ${input.verificationScripts.length > 0 ? `${input.verificationSummary.passedCount}/${input.verificationScripts.length} checks passed` : "No recommended checks configured"}`,
    `- Current state: ${input.verificationSummary.status}`,
    `- Verification turn: ${input.verificationRequiredTurnId ?? "None"}`,
  );

  if (input.verificationScripts.length > 0) {
    for (const script of input.verificationScripts) {
      const run = latestRunByScriptId.get(script.id);
      lines.push(
        `- ${script.name} (${formatVerificationRoleLabel(script.role)}): ${run ? run.status : "not run"}${run?.exitCode !== null && run?.exitCode !== undefined ? ` (exit ${run.exitCode})` : ""}`,
      );
    }
  }

  lines.push("", "## Changed files");
  if (input.latestChangedFiles.length > 0) {
    for (const file of input.latestChangedFiles) {
      const delta =
        typeof file.additions === "number" || typeof file.deletions === "number"
          ? ` (+${file.additions ?? 0} / -${file.deletions ?? 0})`
          : "";
      lines.push(`- ${file.path}${delta}`);
    }
  } else {
    lines.push("- No captured changed files for the latest turn.");
  }

  lines.push(
    "",
    "## Git status",
    `- Working tree changes: ${input.gitStatus ? (input.gitStatus.hasWorkingTreeChanges ? "Yes" : "No") : "Unavailable"}`,
    `- Ahead / behind: ${input.gitStatus ? `${input.gitStatus.aheadCount} / ${input.gitStatus.behindCount}` : "Unavailable"}`,
    `- Upstream: ${input.gitStatus ? (input.gitStatus.hasUpstream ? "Configured" : "Missing") : "Unavailable"}`,
    `- Pull request: ${input.gitStatus ? (input.gitStatus.pr ? `#${input.gitStatus.pr.number} (${input.gitStatus.pr.state})` : "None") : "Unavailable"}`,
    "",
    "## Repo-local Codex",
    `- AGENTS.md: ${input.workspaceCodexSummary?.hasAgentsMd ? "Present" : "Missing"}`,
    `- .codex/config.toml: ${input.workspaceCodexSummary?.hasConfigToml ? "Present" : "Missing"}`,
    `- Named profiles: ${input.workspaceCodexSummary?.profiles.map((profile) => profile.name).join(", ") || "None"}`,
    `- Skills: ${buildOptionalList(input.workspaceCodexSummary?.skills ?? [])}`,
    `- Agents: ${buildOptionalList(input.workspaceCodexSummary?.agents ?? [])}`,
  );

  if (input.projectSpecialization) {
    lines.push(
      "",
      "## Project specialization notes",
      `- ${input.projectSpecialization.description}`,
      ...input.projectSpecialization.handoffNotes.map((note) => `- ${note}`),
    );
  }

  if (input.prompt.trim().length > 0) {
    lines.push("", "## Current draft prompt", input.prompt.trim());
  }

  return lines.join("\n");
}

export function selectLatestChangedFiles(input: {
  latestTurnId: TurnId | string | null;
  turnDiffSummaries: ReadonlyArray<{
    files: readonly TurnDiffFileChange[];
    turnId: TurnId | string;
  }>;
}): TurnDiffFileChange[] {
  if (!input.latestTurnId) {
    return [];
  }
  return [
    ...(input.turnDiffSummaries.find((summary) => summary.turnId === input.latestTurnId)?.files ??
      []),
  ];
}
