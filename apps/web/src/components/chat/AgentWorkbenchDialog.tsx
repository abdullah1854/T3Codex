import { useQuery } from "@tanstack/react-query";
import {
  type GitStatusResult,
  type OrchestrationSessionStatus,
  type ProjectEntry,
  type ProviderInteractionMode,
  type ProviderKind,
  type RuntimeMode,
  type TurnId,
} from "@t3tools/contracts";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  FileCode2Icon,
  FolderTreeIcon,
  ListChecksIcon,
  LoaderIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  deriveInstructionLayers,
  formatReviewReadinessStatusLabel,
  deriveVerificationSummary,
  formatVerificationRoleLabel,
  selectLatestVerificationRunsByScriptId,
  type ReviewReadinessSummary,
  type VerificationRunRecord,
  type VerificationScriptDefinition,
} from "~/agentWorkbench";
import { openInPreferredEditor } from "~/editorPreferences";
import {
  projectReadTextFileQueryOptions,
  projectSearchEntriesQueryOptions,
} from "~/lib/projectReactQuery";
import { cn } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import type { ProjectSpecialization } from "~/projectSpecializations";
import type { TurnDiffFileChange } from "~/types";
import type { WorkProfileDefinition, WorkProfilePreflight } from "~/workProfiles";
import type { WorkspaceCodexSummary } from "~/workspaceCodex";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ScrollArea } from "../ui/scroll-area";
import { Switch } from "../ui/switch";
import { Toggle, ToggleGroup } from "../ui/toggle-group";

type WorkbenchSection = "instructions" | "verification" | "review" | "workspace";

interface AgentWorkbenchDialogProps {
  activeBranch: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeProjectName: string | undefined;
  activeThreadTitle: string;
  activeWorktreePath: string | null;
  gitStatus: GitStatusResult | null;
  interactionMode: ProviderInteractionMode;
  latestChangedFiles: readonly TurnDiffFileChange[];
  latestChangedTurnId: TurnId | null;
  onOpenHandoff: () => void;
  onTakeOverSession: () => void;
  onOpenTurnDiff: (turnId: TurnId, filePath?: string) => void;
  onRunAllVerificationScripts: () => void;
  onRunVerificationScript: (script: VerificationScriptDefinition) => void;
  onVerificationAutoRunChange: (enabled: boolean) => void;
  preflight: WorkProfilePreflight;
  projectSpecialization: ProjectSpecialization | null;
  reviewReadiness: ReviewReadinessSummary;
  runtimeMode: RuntimeMode;
  sessionStatus: OrchestrationSessionStatus | null;
  sessionTakeoverPending: boolean;
  selectedProvider: ProviderKind;
  selectedWorkspaceCodexProfileName: string | null;
  suggestedWorkspaceCodexProfileName: string | null;
  verificationAutoRunEnabled: boolean;
  verificationRequiredTurnId: TurnId | null;
  verificationRuns: readonly VerificationRunRecord[];
  verificationScripts: readonly VerificationScriptDefinition[];
  workProfile: WorkProfileDefinition;
  workspaceCodexSummary: WorkspaceCodexSummary | null;
  workspaceDefaultsSuppressed: boolean;
  workspaceRoot: string | null;
}

function joinWorkspacePath(workspaceRoot: string, relativePath: string): string {
  return workspaceRoot.endsWith("/")
    ? `${workspaceRoot}${relativePath}`
    : `${workspaceRoot}/${relativePath}`;
}

function toneClassName(tone: ReturnType<typeof deriveInstructionLayers>[number]["tone"]) {
  if (tone === "active") {
    return "border-emerald-200/80 bg-emerald-50/70";
  }
  if (tone === "missing") {
    return "border-rose-200/80 bg-rose-50/80";
  }
  if (tone === "muted") {
    return "border-amber-200/80 bg-amber-50/80";
  }
  return "border-sky-200/80 bg-sky-50/70";
}

function verificationStatusBadgeClassName(
  status: ReturnType<typeof deriveVerificationSummary>["status"],
) {
  if (status === "passed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "failed") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "running") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-muted bg-muted/60 text-muted-foreground";
}

function verificationStatusLabel(status: ReturnType<typeof deriveVerificationSummary>["status"]) {
  if (status === "idle") return "Idle";
  if (status === "passed") return "Verified";
  if (status === "failed") return "Failed";
  if (status === "running") return "Running";
  return "Pending";
}

function formatSessionStatusLabel(status: OrchestrationSessionStatus | null) {
  if (status === null) {
    return "No session";
  }
  return `${status.slice(0, 1).toUpperCase()}${status.slice(1)}`;
}

function reviewReadinessBadgeClassName(status: ReviewReadinessSummary["status"]) {
  if (status === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "attention") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function reviewItemToneClassName(status: ReviewReadinessSummary["items"][number]["status"]) {
  if (status === "good") {
    return "border-emerald-200/80 bg-emerald-50/70";
  }
  if (status === "attention") {
    return "border-rose-200/80 bg-rose-50/70";
  }
  if (status === "pending") {
    return "border-amber-200/80 bg-amber-50/70";
  }
  return "border-sky-200/80 bg-sky-50/70";
}

function previewForText(contents: string) {
  if (contents.length <= 12_000) {
    return { text: contents, truncated: false };
  }
  return {
    text: `${contents.slice(0, 12_000)}\n\n[Preview truncated]`,
    truncated: true,
  };
}

function depthForEntry(entry: ProjectEntry) {
  return entry.path.split("/").length - 1;
}

function iconForEntry(entry: ProjectEntry) {
  return entry.kind === "directory" ? (
    <FolderTreeIcon className="size-3.5 text-muted-foreground/70" />
  ) : (
    <FileCode2Icon className="size-3.5 text-muted-foreground/70" />
  );
}

export function AgentWorkbenchDialog({
  activeBranch,
  open,
  onOpenChange,
  activeProjectName,
  activeThreadTitle,
  activeWorktreePath,
  gitStatus,
  interactionMode,
  latestChangedFiles,
  latestChangedTurnId,
  onOpenHandoff,
  onTakeOverSession,
  onOpenTurnDiff,
  onRunAllVerificationScripts,
  onRunVerificationScript,
  onVerificationAutoRunChange,
  preflight,
  projectSpecialization,
  reviewReadiness,
  runtimeMode,
  sessionStatus,
  sessionTakeoverPending,
  selectedProvider,
  selectedWorkspaceCodexProfileName,
  suggestedWorkspaceCodexProfileName,
  verificationAutoRunEnabled,
  verificationRequiredTurnId,
  verificationRuns,
  verificationScripts,
  workProfile,
  workspaceCodexSummary,
  workspaceDefaultsSuppressed,
  workspaceRoot,
}: AgentWorkbenchDialogProps) {
  const [section, setSection] = useState<WorkbenchSection>("instructions");
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [selectedWorkspacePath, setSelectedWorkspacePath] = useState<string | null>(null);

  const instructionLayers = useMemo(
    () =>
      deriveInstructionLayers({
        interactionMode,
        preflight,
        projectSpecialization,
        runtimeMode,
        selectedProvider,
        selectedWorkspaceCodexProfileName,
        suggestedWorkspaceCodexProfileName,
        workProfile,
        workspaceCodexSummary,
        workspaceDefaultsSuppressed,
      }),
    [
      interactionMode,
      preflight,
      projectSpecialization,
      runtimeMode,
      selectedProvider,
      selectedWorkspaceCodexProfileName,
      suggestedWorkspaceCodexProfileName,
      workProfile,
      workspaceCodexSummary,
      workspaceDefaultsSuppressed,
    ],
  );

  const trimmedWorkspaceQuery = workspaceQuery.trim();
  const workspaceEntriesQuery = useQuery(
    projectSearchEntriesQueryOptions({
      cwd: workspaceRoot,
      query: trimmedWorkspaceQuery,
      enabled: open && workspaceRoot !== null,
      limit: trimmedWorkspaceQuery.length > 0 ? 120 : 200,
    }),
  );
  const workspaceEntries = useMemo(
    () => workspaceEntriesQuery.data?.entries ?? [],
    [workspaceEntriesQuery.data?.entries],
  );
  const latestChangedFilePathSet = useMemo(
    () => new Set(latestChangedFiles.map((file) => file.path)),
    [latestChangedFiles],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    if (selectedWorkspacePath) {
      return;
    }
    const fallbackPath =
      latestChangedFiles.find((file) => file.path.trim().length > 0)?.path ??
      workspaceEntries.find((entry) => entry.kind === "file")?.path ??
      workspaceEntries[0]?.path ??
      null;
    if (fallbackPath) {
      setSelectedWorkspacePath(fallbackPath);
    }
  }, [latestChangedFiles, open, selectedWorkspacePath, workspaceEntries]);

  useEffect(() => {
    if (!open || !selectedWorkspacePath) {
      return;
    }
    if (workspaceEntries.some((entry) => entry.path === selectedWorkspacePath)) {
      return;
    }
    const nextPath =
      latestChangedFiles.find((file) => file.path.trim().length > 0)?.path ??
      workspaceEntries.find((entry) => entry.kind === "file")?.path ??
      workspaceEntries[0]?.path ??
      null;
    setSelectedWorkspacePath(nextPath);
  }, [latestChangedFiles, open, selectedWorkspacePath, workspaceEntries]);

  const selectedWorkspaceEntry = useMemo(() => {
    if (!selectedWorkspacePath) {
      return null;
    }
    return (
      workspaceEntries.find((entry) => entry.path === selectedWorkspacePath) ?? {
        kind: "file",
        path: selectedWorkspacePath,
      }
    );
  }, [selectedWorkspacePath, workspaceEntries]);
  const selectedWorkspaceChildren = useMemo(
    () =>
      selectedWorkspaceEntry?.kind === "directory"
        ? workspaceEntries.filter((entry) => entry.parentPath === selectedWorkspaceEntry.path)
        : [],
    [selectedWorkspaceEntry, workspaceEntries],
  );
  const workspacePreviewQuery = useQuery(
    projectReadTextFileQueryOptions({
      cwd: workspaceRoot,
      relativePath: selectedWorkspaceEntry?.kind === "file" ? selectedWorkspaceEntry.path : "",
      enabled: open && workspaceRoot !== null && selectedWorkspaceEntry?.kind === "file",
    }),
  );
  const preview = useMemo(
    () => previewForText(workspacePreviewQuery.data?.contents ?? ""),
    [workspacePreviewQuery.data?.contents],
  );

  const verificationSummary = useMemo(
    () =>
      deriveVerificationSummary({
        requiredTurnId: verificationRequiredTurnId,
        runs: verificationRuns,
        scripts: verificationScripts,
      }),
    [verificationRequiredTurnId, verificationRuns, verificationScripts],
  );
  const latestVerificationRunByScriptId = useMemo(() => {
    return selectLatestVerificationRunsByScriptId({
      requiredTurnId: verificationRequiredTurnId,
      runs: verificationRuns,
    });
  }, [verificationRequiredTurnId, verificationRuns]);

  const openWorkspaceEntry = (relativePath: string) => {
    const api = readNativeApi();
    if (!api || !workspaceRoot) {
      return;
    }
    void openInPreferredEditor(api, joinWorkspacePath(workspaceRoot, relativePath));
  };

  const openChangedFileDiff = (filePath: string) => {
    if (!latestChangedTurnId) {
      return;
    }
    onOpenTurnDiff(latestChangedTurnId, filePath);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Workbench</DialogTitle>
          <DialogDescription>
            See which instructions are active, which files changed, and whether the latest turn has
            been verified before you trust it.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-border/70 bg-[linear-gradient(135deg,rgba(240,249,255,0.96),rgba(255,255,255,0.92))] p-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/50 bg-white/70 p-3 backdrop-blur">
              <div className="flex items-center gap-2 text-foreground">
                <ShieldCheckIcon className="size-4" />
                <span className="font-medium text-sm">Instruction stack</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {instructionLayers.filter((layer) => layer.tone === "active").length} active layers
                for {activeThreadTitle}.
              </p>
            </div>
            <div className="rounded-xl border border-white/50 bg-white/70 p-3 backdrop-blur">
              <div className="flex items-center gap-2 text-foreground">
                <ListChecksIcon className="size-4" />
                <span className="font-medium text-sm">Verification</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {verificationScripts.length > 0
                  ? `${verificationStatusLabel(verificationSummary.status)} · ${verificationSummary.passedCount}/${verificationScripts.length} checks green`
                  : "No recommended verification scripts have been configured yet."}
              </p>
            </div>
            <div className="rounded-xl border border-white/50 bg-white/70 p-3 backdrop-blur">
              <div className="flex items-center gap-2 text-foreground">
                <CheckCircle2Icon className="size-4" />
                <span className="font-medium text-sm">Review package</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{reviewReadiness.headline}</p>
            </div>
            <div className="rounded-xl border border-white/50 bg-white/70 p-3 backdrop-blur">
              <div className="flex items-center gap-2 text-foreground">
                <FolderTreeIcon className="size-4" />
                <span className="font-medium text-sm">Workspace review</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {workspaceRoot
                  ? `${workspaceEntries.length} indexed entries ready for review.`
                  : "Attach a project to browse files and preview source here."}
              </p>
            </div>
          </div>

          <ToggleGroup
            className="shrink-0"
            variant="outline"
            size="sm"
            value={[section]}
            onValueChange={(value) => {
              const next = value[0];
              if (
                next === "instructions" ||
                next === "verification" ||
                next === "review" ||
                next === "workspace"
              ) {
                setSection(next);
              }
            }}
          >
            <Toggle value="instructions">
              <ShieldCheckIcon className="size-3.5" />
              Instructions
            </Toggle>
            <Toggle value="verification">
              <ListChecksIcon className="size-3.5" />
              Verification
            </Toggle>
            <Toggle value="review">
              <CheckCircle2Icon className="size-3.5" />
              Review
            </Toggle>
            <Toggle value="workspace">
              <FolderTreeIcon className="size-3.5" />
              Workspace
            </Toggle>
          </ToggleGroup>

          {section === "instructions" ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {instructionLayers.map((layer) => (
                <Card key={layer.id} className={toneClassName(layer.tone)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{layer.label}</CardTitle>
                        <CardDescription>{layer.source}</CardDescription>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-white/70 bg-white/80 text-foreground"
                      >
                        {layer.tone}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm leading-6 text-foreground/88">{layer.summary}</p>
                    {layer.details.length > 0 ? (
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {layer.details.map((detail) => (
                          <li key={detail}>• {detail}</li>
                        ))}
                      </ul>
                    ) : null}
                  </CardContent>
                </Card>
              ))}

              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Latest changed files</CardTitle>
                      <CardDescription>
                        Review the files touched by the newest completed turn before approving the
                        result.
                      </CardDescription>
                    </div>
                    {activeProjectName ? (
                      <Badge variant="outline">{activeProjectName}</Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent>
                  {latestChangedFiles.length > 0 ? (
                    <div className="space-y-2">
                      {latestChangedFiles.map((file) => (
                        <div
                          key={file.path}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/18 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-sm text-foreground">
                              {file.path}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {file.kind ?? "changed"}
                              {typeof file.additions === "number" ||
                              typeof file.deletions === "number"
                                ? ` · +${file.additions ?? 0} / -${file.deletions ?? 0}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {latestChangedTurnId ? (
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => openChangedFileDiff(file.path)}
                              >
                                Diff
                              </Button>
                            ) : null}
                            {workspaceRoot ? (
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => openWorkspaceEntry(file.path)}
                              >
                                Open
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/16 p-4 text-sm text-muted-foreground">
                      No captured file changes for the latest turn yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {section === "verification" ? (
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Verification suite</CardTitle>
                      <CardDescription>
                        Treat completion as provisional until checks pass.
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={verificationStatusBadgeClassName(verificationSummary.status)}
                    >
                      {verificationStatusLabel(verificationSummary.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/18 px-4 py-3">
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        Auto-verify after edit turns
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {verificationAutoRunEnabled
                          ? "Recommended verification scripts will launch automatically for changed turns."
                          : "Manual mode. You decide when to run checks."}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label htmlFor="auto-verify-toggle" className="sr-only">
                        Auto-run verification
                      </Label>
                      <Switch
                        id="auto-verify-toggle"
                        checked={verificationAutoRunEnabled}
                        onCheckedChange={(checked) => onVerificationAutoRunChange(Boolean(checked))}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRunAllVerificationScripts}
                      disabled={verificationScripts.length === 0}
                    >
                      <ListChecksIcon className="size-3.5" />
                      Run all checks
                    </Button>
                    {verificationRequiredTurnId ? (
                      <Badge variant="outline">Turn {verificationRequiredTurnId}</Badge>
                    ) : null}
                    <Badge variant="outline">
                      {verificationSummary.passedCount}/{verificationScripts.length} green
                    </Badge>
                  </div>

                  {verificationScripts.length > 0 ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {verificationScripts.map((script) => {
                        const run = latestVerificationRunByScriptId.get(script.id) ?? null;
                        const runTone =
                          run?.status === "passed"
                            ? "border-emerald-200/80 bg-emerald-50/70"
                            : run?.status === "failed"
                              ? "border-rose-200/80 bg-rose-50/70"
                              : run?.status === "running"
                                ? "border-sky-200/80 bg-sky-50/70"
                                : "border-border/70 bg-card";

                        return (
                          <Card key={script.id} className={runTone}>
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <CardTitle className="text-base">{script.name}</CardTitle>
                                  <CardDescription>
                                    {formatVerificationRoleLabel(script.role)}
                                  </CardDescription>
                                </div>
                                <Badge variant="outline">{script.role}</Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <pre className="overflow-x-auto rounded-xl border border-black/5 bg-black/[0.03] px-3 py-2 text-xs leading-6 text-foreground/80">
                                {script.command}
                              </pre>
                              {run ? (
                                <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2 text-sm">
                                  <p className="font-medium text-foreground">
                                    {run.status === "passed"
                                      ? "Passed"
                                      : run.status === "failed"
                                        ? "Failed"
                                        : "Running"}
                                  </p>
                                  <p className="text-muted-foreground">
                                    Started {new Date(run.startedAt).toLocaleString()}
                                  </p>
                                  {run.error ? (
                                    <p className="mt-1 text-rose-700">{run.error}</p>
                                  ) : run.exitCode !== null ? (
                                    <p className="mt-1 text-muted-foreground">
                                      Exit code {run.exitCode}
                                    </p>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed border-border/70 bg-muted/16 px-3 py-2 text-sm text-muted-foreground">
                                  No run recorded for the current turn yet.
                                </div>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onRunVerificationScript(script)}
                              >
                                {run?.status === "running" ? (
                                  <LoaderIcon className="size-3.5 animate-spin" />
                                ) : (
                                  <ListChecksIcon className="size-3.5" />
                                )}
                                Run {formatVerificationRoleLabel(script.role)}
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/16 p-5 text-sm text-muted-foreground">
                      Add project scripts such as `bun lint`, `bun typecheck`, `bun run test`, and
                      `bun build` to make verification automatic and reviewable here.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Review focus</CardTitle>
                  <CardDescription>
                    Changed files and verification are meant to work together.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {latestChangedFiles.length > 0 ? (
                    latestChangedFiles.map((file) => (
                      <div
                        key={file.path}
                        className="rounded-xl border border-border/70 bg-muted/18 px-3 py-3"
                      >
                        <p className="font-medium text-sm text-foreground">{file.path}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Review the diff, then run checks that prove this file did not break the
                          project.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {latestChangedTurnId ? (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => openChangedFileDiff(file.path)}
                            >
                              Diff
                            </Button>
                          ) : null}
                          {workspaceRoot ? (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => openWorkspaceEntry(file.path)}
                            >
                              Open file
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/16 p-4 text-sm text-muted-foreground">
                      No changed files are attached to the latest turn yet.
                    </div>
                  )}

                  <div className="rounded-xl border border-border/70 bg-muted/18 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {verificationSummary.status === "failed" ? (
                        <AlertTriangleIcon className="size-4 text-rose-600" />
                      ) : verificationSummary.status === "passed" ? (
                        <CheckCircle2Icon className="size-4 text-emerald-600" />
                      ) : (
                        <ListChecksIcon className="size-4 text-sky-600" />
                      )}
                      What “done” means here
                    </div>
                    <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                      <li>• The latest changed files have been reviewed.</li>
                      <li>• The recommended verification scripts passed for the current turn.</li>
                      <li>• Any failure has an attached terminal run and is actionable.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {section === "review" ? (
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.95fr)]">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Review readiness</CardTitle>
                      <CardDescription>
                        Package the latest agent work into something another person can trust.
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={reviewReadinessBadgeClassName(reviewReadiness.status)}
                    >
                      {formatReviewReadinessStatusLabel(reviewReadiness.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-border/70 bg-muted/18 p-4">
                    <p className="font-medium text-sm text-foreground">
                      {reviewReadiness.headline}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{reviewReadiness.nextStep}</p>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {reviewReadiness.items.map((item) => (
                      <Card key={item.id} className={reviewItemToneClassName(item.status)}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between gap-3">
                            <CardTitle className="text-sm">{item.label}</CardTitle>
                            <Badge variant="outline">{item.status}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm leading-6 text-foreground/84">{item.detail}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (latestChangedTurnId) {
                          onOpenTurnDiff(latestChangedTurnId);
                        }
                      }}
                      disabled={!latestChangedTurnId}
                    >
                      Review latest diff
                    </Button>
                    <Button variant="outline" size="sm" onClick={onOpenHandoff}>
                      Open handoff note
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onTakeOverSession}
                      disabled={sessionTakeoverPending || sessionStatus === "starting"}
                    >
                      {sessionTakeoverPending || sessionStatus === "starting"
                        ? "Taking over..."
                        : sessionStatus === "running"
                          ? "Take over running session"
                          : sessionStatus === "stopped" || sessionStatus === null
                            ? "Start session"
                            : "Restart session"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRunAllVerificationScripts}
                      disabled={verificationScripts.length === 0}
                    >
                      Run checks
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Branch and publication state</CardTitle>
                  <CardDescription>
                    This is the operational context around the latest agent work.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border border-border/70 bg-muted/18 px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                      Session
                    </p>
                    <p className="mt-1 font-medium text-sm text-foreground">
                      {formatSessionStatusLabel(sessionStatus)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Use takeover when you want to reattach a fresh provider session before the
                      next turn.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/18 px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                      Branch
                    </p>
                    <p className="mt-1 font-medium text-sm text-foreground">
                      {activeBranch ?? "No active branch"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/18 px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                      Workspace mode
                    </p>
                    <p className="mt-1 font-medium text-sm text-foreground">
                      {activeWorktreePath ? "Dedicated worktree" : "Main repo checkout"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activeWorktreePath ?? "This thread is operating in the project root."}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/18 px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                      Pull request
                    </p>
                    <p className="mt-1 font-medium text-sm text-foreground">
                      {gitStatus?.pr
                        ? `#${gitStatus.pr.number} · ${gitStatus.pr.state}`
                        : "No open PR detected"}
                    </p>
                    {gitStatus?.pr ? (
                      <p className="mt-1 text-sm text-muted-foreground">{gitStatus.pr.title}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-muted/18 px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                        Ahead / behind
                      </p>
                      <p className="mt-1 font-medium text-sm text-foreground">
                        {gitStatus ? `${gitStatus.aheadCount} / ${gitStatus.behindCount}` : "N/A"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/18 px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                        Working tree
                      </p>
                      <p className="mt-1 font-medium text-sm text-foreground">
                        {gitStatus ? (gitStatus.hasWorkingTreeChanges ? "Dirty" : "Clean") : "N/A"}
                      </p>
                    </div>
                  </div>

                  {latestChangedFiles.length > 0 ? (
                    <div className="rounded-xl border border-border/70 bg-muted/18 p-3">
                      <p className="font-medium text-sm text-foreground">Files in the package</p>
                      <div className="mt-3 space-y-2">
                        {latestChangedFiles.map((file) => (
                          <div
                            key={file.path}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm text-foreground">{file.path}</p>
                              <p className="text-xs text-muted-foreground">
                                +{file.additions ?? 0} / -{file.deletions ?? 0}
                              </p>
                            </div>
                            {latestChangedTurnId ? (
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => openChangedFileDiff(file.path)}
                              >
                                Diff
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/16 p-4 text-sm text-muted-foreground">
                      No captured files are attached to the latest turn yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {section === "workspace" ? (
            <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
              <Card className="min-h-[540px]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Workspace browser</CardTitle>
                  <CardDescription>
                    Search precisely or browse the indexed workspace tree.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={workspaceQuery}
                      onChange={(event) => setWorkspaceQuery(event.target.value)}
                      placeholder="Search files or leave blank to browse"
                      className="pl-9"
                    />
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/16 p-2 text-xs text-muted-foreground">
                    {workspaceEntriesQuery.isFetching
                      ? "Refreshing workspace index..."
                      : workspaceEntriesQuery.data?.truncated
                        ? "Results truncated to keep the browser fast."
                        : "Browse the indexed workspace directly from the agent session."}
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border/70 bg-card">
                    <ScrollArea className="h-full">
                      <div className="space-y-1 p-2">
                        {workspaceEntries.map((entry) => {
                          const selected = entry.path === selectedWorkspacePath;
                          const latestChanged = latestChangedFilePathSet.has(entry.path);
                          return (
                            <button
                              key={`${entry.kind}:${entry.path}`}
                              type="button"
                              className={cn(
                                "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                                selected
                                  ? "bg-accent text-accent-foreground"
                                  : "text-foreground/80 hover:bg-muted/70",
                              )}
                              style={{ paddingLeft: `${10 + depthForEntry(entry) * 12}px` }}
                              onClick={() => setSelectedWorkspacePath(entry.path)}
                            >
                              {iconForEntry(entry)}
                              <span className="min-w-0 flex-1 truncate">{entry.path}</span>
                              {latestChanged ? (
                                <Badge variant="outline" className="shrink-0 text-[10px]">
                                  changed
                                </Badge>
                              ) : null}
                            </button>
                          );
                        })}
                        {workspaceEntries.length === 0 ? (
                          <div className="p-3 text-sm text-muted-foreground">
                            {workspaceRoot
                              ? "No indexed entries match this search."
                              : "Attach a project to browse files."}
                          </div>
                        ) : null}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>

              <Card className="min-h-[540px]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {selectedWorkspaceEntry?.path ?? "File preview"}
                      </CardTitle>
                      <CardDescription>
                        Open the real file, or jump straight to the diff for the latest turn.
                      </CardDescription>
                    </div>
                    {selectedWorkspaceEntry?.path && workspaceRoot ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => openWorkspaceEntry(selectedWorkspaceEntry.path)}
                        >
                          <ExternalLinkIcon className="size-3.5" />
                          Open
                        </Button>
                        {selectedWorkspaceEntry.kind === "file" &&
                        latestChangedTurnId &&
                        latestChangedFilePathSet.has(selectedWorkspaceEntry.path) ? (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => openChangedFileDiff(selectedWorkspaceEntry.path)}
                          >
                            Diff
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="min-h-0 flex-1">
                  {selectedWorkspaceEntry?.kind === "directory" ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-border/70 bg-muted/16 p-4 text-sm text-muted-foreground">
                        {selectedWorkspaceChildren.length > 0
                          ? `Directory contains ${selectedWorkspaceChildren.length} indexed child entries.`
                          : "No indexed child entries for this directory."}
                      </div>
                      {selectedWorkspaceChildren.length > 0 ? (
                        <div className="space-y-2">
                          {selectedWorkspaceChildren.map((entry) => (
                            <div
                              key={`${entry.kind}:${entry.path}`}
                              className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/18 px-3 py-2"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                {iconForEntry(entry)}
                                <span className="truncate text-sm text-foreground">
                                  {entry.path}
                                </span>
                              </div>
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => setSelectedWorkspacePath(entry.path)}
                              >
                                Inspect
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : selectedWorkspaceEntry?.kind === "file" ? (
                    <div className="min-h-0 overflow-hidden rounded-xl border border-border/70 bg-[#fafaf6]">
                      <ScrollArea className="h-[420px]">
                        <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-slate-800">
                          {workspacePreviewQuery.isFetching
                            ? "Loading preview..."
                            : preview.text.length > 0
                              ? preview.text
                              : "Empty file or preview unavailable."}
                        </pre>
                      </ScrollArea>
                      {preview.truncated ? (
                        <div className="border-t border-border/70 bg-white/80 px-4 py-2 text-xs text-muted-foreground">
                          Preview is truncated. Open the file in your editor for the full contents.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/16 p-5 text-sm text-muted-foreground">
                      Select a file or directory to inspect it here.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
