import {
  type GitStatusResult,
  type ProviderInteractionMode,
  type ProviderKind,
  type RuntimeMode,
  type TurnId,
} from "@t3tools/contracts";
import { useMemo } from "react";

import {
  buildAgentHandoffMarkdown,
  type ReviewReadinessSummary,
  type VerificationRunRecord,
  type VerificationScriptDefinition,
  type VerificationSummary,
} from "~/agentWorkbench";
import type { ProjectSpecialization } from "~/projectSpecializations";
import type { TurnDiffFileChange } from "~/types";
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
  activeBranch: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeThreadTitle: string;
  activeProjectName: string | undefined;
  activeProjectPath: string | null;
  activeWorktreePath: string | null;
  gitStatus: GitStatusResult | null;
  projectSpecialization: ProjectSpecialization | null;
  latestChangedFiles: readonly TurnDiffFileChange[];
  workProfileLabel: string;
  selectedProvider: ProviderKind;
  runtimeMode: RuntimeMode;
  interactionMode: ProviderInteractionMode;
  selectedWorkspaceCodexProfileName: string | null;
  suggestedWorkspaceCodexProfileName: string | null;
  reviewReadiness: ReviewReadinessSummary;
  verificationRequiredTurnId: TurnId | null;
  verificationRuns: readonly VerificationRunRecord[];
  verificationScripts: readonly VerificationScriptDefinition[];
  verificationSummary: VerificationSummary;
  workspaceDefaultsSuppressed: boolean;
  preflight: WorkProfilePreflight;
  prompt: string;
  workspaceCodexSummary: WorkspaceCodexSummary | null;
}

export function HandoffDialog({
  activeBranch,
  open,
  onOpenChange,
  activeThreadTitle,
  activeProjectName,
  activeProjectPath,
  activeWorktreePath,
  gitStatus,
  projectSpecialization,
  latestChangedFiles,
  workProfileLabel,
  selectedProvider,
  runtimeMode,
  interactionMode,
  selectedWorkspaceCodexProfileName,
  suggestedWorkspaceCodexProfileName,
  reviewReadiness,
  verificationRequiredTurnId,
  verificationRuns,
  verificationScripts,
  verificationSummary,
  workspaceDefaultsSuppressed,
  preflight,
  prompt,
  workspaceCodexSummary,
}: HandoffDialogProps) {
  const handoffMarkdown = useMemo(
    () =>
      buildAgentHandoffMarkdown({
        activeBranch,
        activeWorktreePath,
        activeThreadTitle,
        activeProjectName,
        activeProjectPath,
        gitStatus,
        latestChangedFiles,
        projectSpecialization,
        workProfileLabel,
        selectedProvider,
        runtimeMode,
        interactionMode,
        selectedWorkspaceCodexProfileName,
        suggestedWorkspaceCodexProfileName,
        reviewReadiness,
        verificationRequiredTurnId,
        verificationRuns,
        verificationScripts,
        verificationSummary,
        workspaceDefaultsSuppressed,
        preflight,
        prompt,
        workspaceCodexSummary,
      }),
    [
      activeBranch,
      activeProjectName,
      activeProjectPath,
      activeThreadTitle,
      activeWorktreePath,
      gitStatus,
      interactionMode,
      latestChangedFiles,
      preflight,
      projectSpecialization,
      prompt,
      reviewReadiness,
      runtimeMode,
      selectedProvider,
      selectedWorkspaceCodexProfileName,
      suggestedWorkspaceCodexProfileName,
      verificationRequiredTurnId,
      verificationRuns,
      verificationScripts,
      verificationSummary,
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
            Copy a ready-to-paste handoff note with the current review package, verification state,
            repo-local Codex context, and draft state.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          <div className="rounded-xl border border-border/70 bg-muted/18 p-3 text-sm text-muted-foreground">
            This note now includes the latest changed files, verification results, and branch or PR
            state so the next operator does not have to reconstruct what is safe to trust.
          </div>
          <div className="rounded-xl border border-border/70 bg-background/80 p-3 text-sm">
            <p className="font-medium text-foreground">{reviewReadiness.headline}</p>
            <p className="mt-1 text-muted-foreground">{reviewReadiness.nextStep}</p>
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
