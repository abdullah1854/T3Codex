import {
  type ProviderInteractionMode,
  type ProviderKind,
  type RuntimeMode,
} from "@t3tools/contracts";
import { useMemo } from "react";

import type { ProjectSpecialization } from "~/projectSpecializations";
import type { WorkProfilePreflight } from "~/workProfiles";
import type { WorkspaceCodexSummary } from "~/workspaceCodex";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Textarea } from "../ui/textarea";

interface HandoffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeThreadTitle: string;
  activeProjectName: string | undefined;
  activeProjectPath: string | null;
  projectSpecialization: ProjectSpecialization | null;
  workProfileLabel: string;
  selectedProvider: ProviderKind;
  runtimeMode: RuntimeMode;
  interactionMode: ProviderInteractionMode;
  selectedWorkspaceCodexProfileName: string | null;
  suggestedWorkspaceCodexProfileName: string | null;
  workspaceDefaultsSuppressed: boolean;
  preflight: WorkProfilePreflight;
  prompt: string;
  workspaceCodexSummary: WorkspaceCodexSummary | null;
}

function buildOptionalList(values: readonly string[]) {
  return values.length > 0 ? values.join(", ") : "None";
}

function buildHandoffMarkdown(input: {
  activeThreadTitle: string;
  activeProjectName: string | undefined;
  activeProjectPath: string | null;
  projectSpecialization: ProjectSpecialization | null;
  workProfileLabel: string;
  selectedProvider: ProviderKind;
  runtimeMode: RuntimeMode;
  interactionMode: ProviderInteractionMode;
  selectedWorkspaceCodexProfileName: string | null;
  suggestedWorkspaceCodexProfileName: string | null;
  workspaceDefaultsSuppressed: boolean;
  preflight: WorkProfilePreflight;
  prompt: string;
  workspaceCodexSummary: WorkspaceCodexSummary | null;
}) {
  const lines: string[] = [
    "# Resume / Handoff",
    "",
    "## Current thread",
    `- Thread: ${input.activeThreadTitle}`,
    `- Project: ${input.activeProjectName ?? "No project"}`,
    `- Path: ${input.activeProjectPath ?? "No workspace path"}`,
    `- Project specialization: ${input.projectSpecialization?.label ?? "None"}`,
    `- Workflow profile: ${input.workProfileLabel}`,
    `- Provider: ${input.selectedProvider}`,
    `- Runtime mode: ${input.runtimeMode}`,
    `- Interaction mode: ${input.interactionMode}`,
    `- Repo defaults: ${input.workspaceDefaultsSuppressed ? "Muted for this draft" : "Active"}`,
    `- Selected repo Codex profile: ${input.selectedWorkspaceCodexProfileName ?? "Workspace defaults"}`,
    `- Best matching repo Codex profile: ${input.suggestedWorkspaceCodexProfileName ?? "No named match"}`,
    "",
    "## Preflight",
    `- System: ${input.preflight.system?.trim() || "Not set"}`,
    `- Environment: ${input.preflight.environment?.trim() || "Not set"}`,
    `- Output format: ${input.preflight.outputFormat?.trim() || "Not set"}`,
    `- Target: ${input.preflight.target?.trim() || "Not set"}`,
    `- Evidence: ${input.preflight.evidence?.trim() || "Not set"}`,
    "",
    "## Repo-local Codex",
    `- AGENTS.md: ${input.workspaceCodexSummary?.hasAgentsMd ? "Present" : "Missing"}`,
    `- .codex/config.toml: ${input.workspaceCodexSummary?.hasConfigToml ? "Present" : "Missing"}`,
    `- Named profiles: ${input.workspaceCodexSummary?.profiles.map((profile) => profile.name).join(", ") || "None"}`,
    `- Skills: ${buildOptionalList(input.workspaceCodexSummary?.skills ?? [])}`,
    `- Agents: ${buildOptionalList(input.workspaceCodexSummary?.agents ?? [])}`,
  ];

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

export function HandoffDialog({
  open,
  onOpenChange,
  activeThreadTitle,
  activeProjectName,
  activeProjectPath,
  projectSpecialization,
  workProfileLabel,
  selectedProvider,
  runtimeMode,
  interactionMode,
  selectedWorkspaceCodexProfileName,
  suggestedWorkspaceCodexProfileName,
  workspaceDefaultsSuppressed,
  preflight,
  prompt,
  workspaceCodexSummary,
}: HandoffDialogProps) {
  const handoffMarkdown = useMemo(
    () =>
      buildHandoffMarkdown({
        activeThreadTitle,
        activeProjectName,
        activeProjectPath,
        projectSpecialization,
        workProfileLabel,
        selectedProvider,
        runtimeMode,
        interactionMode,
        selectedWorkspaceCodexProfileName,
        suggestedWorkspaceCodexProfileName,
        workspaceDefaultsSuppressed,
        preflight,
        prompt,
        workspaceCodexSummary,
      }),
    [
      activeProjectName,
      activeProjectPath,
      activeThreadTitle,
      interactionMode,
      preflight,
      projectSpecialization,
      prompt,
      runtimeMode,
      selectedProvider,
      selectedWorkspaceCodexProfileName,
      suggestedWorkspaceCodexProfileName,
      workProfileLabel,
      workspaceCodexSummary,
      workspaceDefaultsSuppressed,
    ],
  );
  const { copyToClipboard, isCopied } = useCopyToClipboard();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Resume / Handoff</DialogTitle>
          <DialogDescription>
            Copy a ready-to-paste handoff note with the current workflow profile, repo-local Codex
            context, and draft state.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          <div className="rounded-xl border border-border/70 bg-muted/18 p-3 text-sm text-muted-foreground">
            This is tied to the current repo-local Codex setup, so the selected named profile and
            workspace-default state are included in the note.
          </div>
          <Textarea
            readOnly
            value={handoffMarkdown}
            className="font-mono text-xs leading-5"
            size="lg"
          />
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => copyToClipboard(handoffMarkdown, undefined)}>
            {isCopied ? "Copied" : "Copy handoff"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
