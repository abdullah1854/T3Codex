import {
  type EditorId,
  type ProviderInteractionMode,
  type ProviderKind,
  type RuntimeMode,
  type ServerConfigIssue,
  type ServerProvider,
} from "@t3tools/contracts";

import type { ProjectSpecialization } from "~/projectSpecializations";
import type { WorkspaceCodexSummary } from "~/workspaceCodex";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";

interface DoctorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeProjectName: string | undefined;
  activeProjectPath: string | null;
  activeThreadTitle: string;
  projectSpecialization: ProjectSpecialization | null;
  workProfileLabel: string;
  selectedProvider: ProviderKind;
  runtimeMode: RuntimeMode;
  interactionMode: ProviderInteractionMode;
  selectedWorkspaceCodexProfileName: string | null;
  suggestedWorkspaceCodexProfileName: string | null;
  workspaceDefaultsSuppressed: boolean;
  workspaceCodexSummary: WorkspaceCodexSummary | null;
  serverCwd: string | null;
  keybindingsConfigPath: string | null;
  availableEditors: ReadonlyArray<EditorId>;
  serverIssues: ReadonlyArray<ServerConfigIssue>;
  providers: ReadonlyArray<ServerProvider>;
}

function ProviderStatusBadge({ status }: { status: ServerProvider["status"] }) {
  const className =
    status === "ready"
      ? "border-success/30 bg-success/10 text-success-foreground"
      : status === "warning"
        ? "border-warning/30 bg-warning/10 text-warning-foreground"
        : status === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive-foreground"
          : "border-muted bg-muted/60 text-muted-foreground";

  return (
    <Badge variant="outline" className={className}>
      {status}
    </Badge>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-foreground">{value}</span>
    </div>
  );
}

export function DoctorDialog({
  open,
  onOpenChange,
  activeProjectName,
  activeProjectPath,
  activeThreadTitle,
  projectSpecialization,
  workProfileLabel,
  selectedProvider,
  runtimeMode,
  interactionMode,
  selectedWorkspaceCodexProfileName,
  suggestedWorkspaceCodexProfileName,
  workspaceDefaultsSuppressed,
  workspaceCodexSummary,
  serverCwd,
  keybindingsConfigPath,
  availableEditors,
  serverIssues,
  providers,
}: DoctorDialogProps) {
  const warningRows: string[] = [];

  if (!activeProjectPath) {
    warningRows.push("No project is attached to this thread yet.");
  }
  if (!workspaceCodexSummary) {
    warningRows.push("This workspace does not expose repo-local Codex files yet.");
  }
  if (projectSpecialization?.id === "gbcr-react-crm") {
    warningRows.push("GBCR deadline mode is active. Keep changes small and delivery-focused.");
  }
  if (workspaceDefaultsSuppressed) {
    warningRows.push("Repo defaults are muted for this draft.");
  }
  if (providers.some((provider) => provider.status === "error")) {
    warningRows.push("At least one provider is in an error state.");
  }
  if (serverIssues.length > 0) {
    warningRows.push("Server config reported validation issues.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Doctor</DialogTitle>
          <DialogDescription>
            Quick health check for the current thread, workspace, repo-local Codex setup, and
            provider runtime.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          {warningRows.length > 0 ? (
            <div className="rounded-xl border border-warning/30 bg-warning/8 p-3 text-sm text-warning-foreground">
              <p className="font-medium">Warnings</p>
              <ul className="mt-2 space-y-1 text-warning-foreground/90">
                {warningRows.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-success/30 bg-success/8 p-3 text-sm text-success-foreground">
              Thread, workspace, and provider state look healthy.
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-border/70 bg-muted/18 p-4">
              <h3 className="font-medium text-sm text-foreground">Current draft</h3>
              <div className="mt-3 space-y-2">
                <StatusRow label="Thread" value={activeThreadTitle} />
                <StatusRow label="Project" value={activeProjectName ?? "No project"} />
                <StatusRow label="Path" value={activeProjectPath ?? "No workspace path"} />
                <StatusRow label="Specialization" value={projectSpecialization?.label ?? "None"} />
                <StatusRow label="Workflow" value={workProfileLabel} />
                <StatusRow label="Provider" value={selectedProvider} />
                <StatusRow label="Runtime" value={runtimeMode} />
                <StatusRow label="Mode" value={interactionMode} />
                <StatusRow
                  label="Repo defaults"
                  value={workspaceDefaultsSuppressed ? "Muted for this draft" : "Active"}
                />
                <StatusRow
                  label="Repo profile"
                  value={selectedWorkspaceCodexProfileName ?? "Workspace defaults"}
                />
                <StatusRow
                  label="Best match"
                  value={suggestedWorkspaceCodexProfileName ?? "No named match"}
                />
              </div>
            </section>

            <section className="rounded-xl border border-border/70 bg-muted/18 p-4">
              <h3 className="font-medium text-sm text-foreground">Repo-local Codex</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">
                  AGENTS.md {workspaceCodexSummary?.hasAgentsMd ? "present" : "missing"}
                </Badge>
                <Badge variant="outline">
                  config.toml {workspaceCodexSummary?.hasConfigToml ? "present" : "missing"}
                </Badge>
                <Badge variant="outline">
                  profiles {workspaceCodexSummary?.profiles.length ?? 0}
                </Badge>
                <Badge variant="outline">skills {workspaceCodexSummary?.skills.length ?? 0}</Badge>
                <Badge variant="outline">agents {workspaceCodexSummary?.agents.length ?? 0}</Badge>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <StatusRow
                  label="Named profiles"
                  value={
                    workspaceCodexSummary?.profiles.map((profile) => profile.name).join(", ") ||
                    "None"
                  }
                />
                <StatusRow
                  label="Skills"
                  value={workspaceCodexSummary?.skills.join(", ") || "None"}
                />
                <StatusRow
                  label="Agents"
                  value={workspaceCodexSummary?.agents.join(", ") || "None"}
                />
              </div>
            </section>
          </div>

          {projectSpecialization ? (
            <section className="rounded-xl border border-border/70 bg-muted/18 p-4">
              <h3 className="font-medium text-sm text-foreground">Project specialization</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {projectSpecialization.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {projectSpecialization.focusAreas.map((focusArea) => (
                  <Badge key={focusArea} variant="secondary">
                    {focusArea}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-border/70 bg-muted/18 p-4">
            <h3 className="font-medium text-sm text-foreground">Server and tools</h3>
            <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="space-y-2 text-sm">
                <StatusRow label="Server cwd" value={serverCwd ?? "Unavailable"} />
                <StatusRow label="Keybindings" value={keybindingsConfigPath ?? "Unavailable"} />
                <StatusRow
                  label="Editors"
                  value={availableEditors.length > 0 ? availableEditors.join(", ") : "None"}
                />
                <StatusRow label="Config issues" value={String(serverIssues.length)} />
              </div>
              <div className="space-y-2">
                {providers.length > 0 ? (
                  providers.map((provider) => (
                    <div
                      key={provider.provider}
                      className="rounded-lg border border-border/70 bg-background/70 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{provider.provider}</p>
                          <p className="text-muted-foreground text-xs">
                            {provider.auth.status}
                            {provider.version ? ` · ${provider.version}` : ""}
                            {provider.message ? ` · ${provider.message}` : ""}
                          </p>
                        </div>
                        <ProviderStatusBadge status={provider.status} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">No provider status is available.</p>
                )}
              </div>
            </div>
          </section>

          {serverIssues.length > 0 ? (
            <section className="rounded-xl border border-border/70 bg-muted/18 p-4">
              <h3 className="font-medium text-sm text-foreground">Server issues</h3>
              <div className="mt-3 space-y-2 text-sm">
                {serverIssues.map((issue) => (
                  <div key={`${issue.kind}-${issue.message}`} className="rounded-lg border p-3">
                    <p className="font-medium text-foreground">{issue.kind}</p>
                    <p className="mt-1 text-muted-foreground">{issue.message}</p>
                  </div>
                ))}
              </div>
            </section>
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
