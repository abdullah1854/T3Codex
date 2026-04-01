import { type WorkProfileId } from "@t3tools/contracts/settings";
import type { WorkspaceCodexProfileSummary, WorkspaceCodexSummary } from "~/workspaceCodex";
import type { ProjectSpecialization } from "~/projectSpecializations";

export function buildRepoCodexBadges(
  workspaceCodexSummary: WorkspaceCodexSummary | null,
): string[] {
  return [
    workspaceCodexSummary?.hasAgentsMd ? "AGENTS.md" : null,
    workspaceCodexSummary?.hasConfigToml ? ".codex/config" : null,
    workspaceCodexSummary && workspaceCodexSummary.profiles.length > 0
      ? `${workspaceCodexSummary.profiles.length} profile${workspaceCodexSummary.profiles.length === 1 ? "" : "s"}`
      : null,
    workspaceCodexSummary && workspaceCodexSummary.skills.length > 0
      ? `${workspaceCodexSummary.skills.length} skill${workspaceCodexSummary.skills.length === 1 ? "" : "s"}`
      : null,
    workspaceCodexSummary && workspaceCodexSummary.agents.length > 0
      ? `${workspaceCodexSummary.agents.length} agent${workspaceCodexSummary.agents.length === 1 ? "" : "s"}`
      : null,
  ].filter((value): value is string => value !== null);
}

export function buildRepoCodexMessage(input: {
  profileId: WorkProfileId;
  repoCodexBadges: readonly string[];
}): string | null {
  if (input.repoCodexBadges.length === 0) {
    return null;
  }
  if (input.profileId === "planning") {
    return "This repo already defines Codex rules and helpers. Planning mode will layer on top of that workspace setup.";
  }
  if (input.profileId === "research") {
    return "This repo already defines Codex rules and helpers. Research mode should use those repo-local skills before adding generic instructions.";
  }
  return "This repo already defines Codex rules and helpers. Your selected workflow will run with that workspace context in play.";
}

export function buildWorkspaceDefaultBadges(
  workspaceCodexSummary: WorkspaceCodexSummary | null,
): string[] {
  return [
    workspaceCodexSummary?.workspaceDefaults?.modelSelection?.model ?? null,
    workspaceCodexSummary?.workspaceDefaults?.reasoningEffort
      ? `${workspaceCodexSummary.workspaceDefaults.reasoningEffort} reasoning`
      : null,
    workspaceCodexSummary?.workspaceDefaults?.planModeReasoningEffort
      ? `plan ${workspaceCodexSummary.workspaceDefaults.planModeReasoningEffort}`
      : null,
    workspaceCodexSummary?.workspaceDefaults?.runtimeMode === "full-access"
      ? "full access"
      : workspaceCodexSummary?.workspaceDefaults?.runtimeMode === "approval-required"
        ? "approval required"
        : null,
    workspaceCodexSummary?.workspaceDefaults?.webSearchMode
      ? `web ${workspaceCodexSummary.workspaceDefaults.webSearchMode}`
      : null,
  ].filter((value): value is string => value !== null);
}

export function buildCollapsedWorkProfileSummaryBadges(input: {
  projectSpecialization: ProjectSpecialization | null;
  selectedWorkspaceCodexProfile: WorkspaceCodexProfileSummary | null;
  suggestedWorkspaceCodexProfile: WorkspaceCodexProfileSummary | null;
  workspaceDefaultBadges: readonly string[];
}): string[] {
  return [
    input.projectSpecialization?.label ?? null,
    input.selectedWorkspaceCodexProfile?.name
      ? `Profile: ${input.selectedWorkspaceCodexProfile.name}`
      : input.suggestedWorkspaceCodexProfile?.name
        ? `Suggested: ${input.suggestedWorkspaceCodexProfile.name}`
        : null,
    ...input.workspaceDefaultBadges.slice(0, 2),
  ].filter((value): value is string => value !== null);
}
