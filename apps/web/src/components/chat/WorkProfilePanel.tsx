import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { memo } from "react";
import { type WorkProfileId } from "@t3tools/contracts/settings";
import type { WorkspaceCodexProfileSummary, WorkspaceCodexSummary } from "~/workspaceCodex";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { cn } from "~/lib/utils";
import type { ProjectSpecialization } from "~/projectSpecializations";
import {
  WORK_PROFILES,
  type WorkProfileDefinition,
  type WorkProfilePreflight,
  type WorkProfilePreflightField,
} from "~/workProfiles";

interface WorkProfilePanelProps {
  disabled: boolean;
  expanded: boolean;
  onPreflightChange: (field: WorkProfilePreflightField, value: string) => void;
  onProfileChange: (profileId: WorkProfileId) => void;
  onWorkspaceCodexProfileChange: (profileName: string | null) => void;
  onToggleExpanded: () => void;
  preflight: WorkProfilePreflight;
  profile: WorkProfileDefinition;
  projectSpecialization: ProjectSpecialization | null;
  selectedWorkspaceCodexProfile: WorkspaceCodexProfileSummary | null;
  suggestedWorkspaceCodexProfile: WorkspaceCodexProfileSummary | null;
  workspaceCodexSummary: WorkspaceCodexSummary | null;
}

const PREFLIGHT_FIELDS: ReadonlyArray<{
  field: WorkProfilePreflightField;
  label: string;
  placeholder: string;
}> = [
  {
    field: "system",
    label: "System",
    placeholder: "D365, AX, Maximo, Fabric, local app, VPS...",
  },
  {
    field: "environment",
    label: "Environment",
    placeholder: "Live, snapshot, staging, remote host, lakehouse...",
  },
  {
    field: "outputFormat",
    label: "Output",
    placeholder: "SQL, PySpark, plan, working code, summary...",
  },
  {
    field: "target",
    label: "Target",
    placeholder: "Path, table, server, repo area, branch...",
  },
  {
    field: "evidence",
    label: "Evidence",
    placeholder: "Logs, schema check, screenshots, exact sources...",
  },
] as const;

export const WorkProfilePanel = memo(function WorkProfilePanel({
  disabled,
  expanded,
  onPreflightChange,
  onProfileChange,
  onWorkspaceCodexProfileChange,
  onToggleExpanded,
  preflight,
  profile,
  projectSpecialization,
  selectedWorkspaceCodexProfile,
  suggestedWorkspaceCodexProfile,
  workspaceCodexSummary,
}: WorkProfilePanelProps) {
  const repoCodexBadges = [
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
  const repoCodexMessage =
    repoCodexBadges.length === 0
      ? null
      : profile.id === "planning"
        ? "This repo already defines Codex rules and helpers. Planning mode will layer on top of that workspace setup."
        : profile.id === "research"
          ? "This repo already defines Codex rules and helpers. Research mode should use those repo-local skills before adding generic instructions."
          : "This repo already defines Codex rules and helpers. Your selected workflow will run with that workspace context in play.";
  const workspaceDefaultBadges = [
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

  return (
    <div className="mb-3 rounded-2xl border border-border/70 bg-muted/15 p-2.5 sm:p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" size="sm">
              Workflow
            </Badge>
            <span className="text-sm font-medium text-foreground">{profile.label}</span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{profile.description}</p>
          {projectSpecialization ? (
            <div className="space-y-1 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" size="sm">
                  Project specialization
                </Badge>
                <Badge variant="secondary" size="sm">
                  {projectSpecialization.label}
                </Badge>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {projectSpecialization.description}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {projectSpecialization.focusAreas.map((focusArea) => (
                  <Badge key={focusArea} variant="secondary" size="sm">
                    {focusArea}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {repoCodexBadges.length > 0 ? (
            <div className="space-y-1 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" size="sm">
                  Repo Codex
                </Badge>
                {repoCodexBadges.map((badge) => (
                  <Badge key={badge} variant="secondary" size="sm">
                    {badge}
                  </Badge>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {repoCodexMessage}
              </p>
              {workspaceCodexSummary && workspaceCodexSummary.profiles.length > 0 ? (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] leading-relaxed text-muted-foreground">
                      Named Codex profiles:{" "}
                      {workspaceCodexSummary.profiles.map((profile) => profile.name).join(", ")}
                    </span>
                    {suggestedWorkspaceCodexProfile ? (
                      <Badge variant="outline" size="sm">
                        Best match: {suggestedWorkspaceCodexProfile.name}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedWorkspaceCodexProfile?.name ?? "__workspace_default__"}
                      onValueChange={(value) =>
                        onWorkspaceCodexProfileChange(
                          value === "__workspace_default__" ? null : value,
                        )
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        className="w-full min-w-44 sm:w-52"
                        aria-label="Select repo-local Codex profile"
                      >
                        <SelectValue>
                          {selectedWorkspaceCodexProfile?.name ?? "Repo default"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectPopup align="start" alignItemWithTrigger={false}>
                        <SelectItem hideIndicator value="__workspace_default__">
                          Repo default
                        </SelectItem>
                        {workspaceCodexSummary.profiles.map((workspaceProfile) => (
                          <SelectItem
                            hideIndicator
                            key={workspaceProfile.name}
                            value={workspaceProfile.name}
                          >
                            {workspaceProfile.name}
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {workspaceDefaultBadges.length > 0 ? (
            <div className="space-y-1 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" size="sm">
                  Workspace defaults
                </Badge>
                {workspaceDefaultBadges.map((badge) => (
                  <Badge key={badge} variant="secondary" size="sm">
                    {badge}
                  </Badge>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Untouched new drafts pick up these repo-local Codex defaults automatically.
              </p>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={profile.id}
            onValueChange={(value) => onProfileChange(value as WorkProfileId)}
          >
            <SelectTrigger
              size="sm"
              className="w-full min-w-40 sm:w-44"
              aria-label="Select workflow profile"
            >
              <SelectValue>{profile.shortLabel}</SelectValue>
            </SelectTrigger>
            <SelectPopup align="end" alignItemWithTrigger={false}>
              {WORK_PROFILES.map((option) => (
                <SelectItem hideIndicator key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={onToggleExpanded}
          >
            {expanded ? (
              <ChevronDownIcon className="size-3.5" />
            ) : (
              <ChevronRightIcon className="size-3.5" />
            )}
            Preflight
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PREFLIGHT_FIELDS.map((entry) => (
            <label
              key={entry.field}
              className={cn("space-y-1", entry.field === "evidence" && "sm:col-span-2")}
            >
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {entry.label}
              </span>
              <Input
                nativeInput
                size="sm"
                value={preflight[entry.field] ?? ""}
                disabled={disabled}
                placeholder={entry.placeholder}
                onChange={(event) => onPreflightChange(entry.field, event.currentTarget.value)}
              />
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
});
