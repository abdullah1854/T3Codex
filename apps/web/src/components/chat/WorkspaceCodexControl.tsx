import {
  BotIcon,
  FileCode2Icon,
  FileTextIcon,
  FolderSearchIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { memo, useState } from "react";
import type { WorkspaceCodexSummary } from "~/workspaceCodex";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";

interface WorkspaceCodexControlProps {
  summary: WorkspaceCodexSummary | null;
  onCreateAgent: () => void;
  onCreateAgentsMd: () => void;
  onCreateConfigToml: () => void;
  onCreateSkill: () => void;
  onOpenPath: (relativePath: string) => void;
  onOpenWorkspace: () => void;
}

const MAX_VISIBLE_CODEX_ENTRIES = 4;

function labelForCodexPath(path: string): string {
  if (path === "AGENTS.md" || path === ".codex/config.toml") {
    return path;
  }

  if (path.startsWith(".codex/skills/") && path.endsWith("/SKILL.md")) {
    return path.slice(".codex/skills/".length, -"/SKILL.md".length);
  }

  if (path.startsWith(".codex/agents/") && path.endsWith(".toml")) {
    return path.slice(".codex/agents/".length, -".toml".length);
  }

  return path;
}

export const WorkspaceCodexControl = memo(function WorkspaceCodexControl({
  summary,
  onCreateAgent,
  onCreateAgentsMd,
  onCreateConfigToml,
  onCreateSkill,
  onOpenPath,
  onOpenWorkspace,
}: WorkspaceCodexControlProps) {
  const [isOpen, setIsOpen] = useState(false);

  const resolvedSummary = summary ?? {
    hasAgentsMd: false,
    hasConfigToml: false,
    skills: [],
    agents: [],
    profiles: [],
    configPreview: null,
    agentsPreview: null,
    workspaceDefaults: null,
  };

  const surfaceCount =
    (resolvedSummary.hasAgentsMd ? 1 : 0) +
    (resolvedSummary.hasConfigToml ? 1 : 0) +
    resolvedSummary.profiles.length +
    resolvedSummary.skills.length +
    resolvedSummary.agents.length;
  const visibleSkills = resolvedSummary.skills.slice(0, MAX_VISIBLE_CODEX_ENTRIES);
  const visibleAgents = resolvedSummary.agents.slice(0, MAX_VISIBLE_CODEX_ENTRIES);

  return (
    <Menu open={isOpen} onOpenChange={setIsOpen}>
      <MenuTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 rounded-full px-2.5 text-xs"
            aria-label="Workspace Codex configuration"
          />
        }
      >
        <ShieldCheckIcon className="size-3.5" />
        .codex
        <Badge variant="secondary" size="sm" className="min-w-4 px-1 text-[10px]">
          {surfaceCount}
        </Badge>
      </MenuTrigger>
      <MenuPopup align="end" className="w-80">
        <MenuGroup>
          <MenuGroupLabel>Workspace agent config</MenuGroupLabel>
          {resolvedSummary.hasAgentsMd ? (
            <MenuItem onClick={() => onOpenPath("AGENTS.md")}>
              <FileTextIcon className="size-4" />
              AGENTS.md
              <span className="ms-auto max-w-40 truncate text-muted-foreground text-xs">
                {resolvedSummary.agentsPreview ?? "Present"}
              </span>
            </MenuItem>
          ) : null}
          {resolvedSummary.hasConfigToml ? (
            <MenuItem onClick={() => onOpenPath(".codex/config.toml")}>
              <FileCode2Icon className="size-4" />
              .codex/config.toml
              <span className="ms-auto max-w-40 truncate text-muted-foreground text-xs">
                {resolvedSummary.configPreview ?? "Present"}
              </span>
            </MenuItem>
          ) : null}
        </MenuGroup>
        {resolvedSummary.profiles.length > 0 ? (
          <>
            <MenuSeparator />
            <MenuGroup>
              <MenuGroupLabel>Profiles</MenuGroupLabel>
              {resolvedSummary.profiles.map((profile) => (
                <MenuItem key={profile.name} onClick={() => onOpenPath(".codex/config.toml")}>
                  <ShieldCheckIcon className="size-4" />
                  <span className="truncate">{profile.name}</span>
                  <span className="ms-auto max-w-32 truncate text-muted-foreground text-xs">
                    {[
                      profile.defaults.planModeReasoningEffort
                        ? `plan ${profile.defaults.planModeReasoningEffort}`
                        : null,
                      profile.defaults.webSearchMode
                        ? `web ${profile.defaults.webSearchMode}`
                        : null,
                      profile.defaults.reasoningEffort
                        ? `${profile.defaults.reasoningEffort} reasoning`
                        : null,
                    ]
                      .filter((value): value is string => value !== null)
                      .join(" · ") || "Defined"}
                  </span>
                </MenuItem>
              ))}
            </MenuGroup>
          </>
        ) : null}
        {resolvedSummary.skills.length > 0 ? (
          <>
            <MenuSeparator />
            <MenuGroup>
              <MenuGroupLabel>Skills</MenuGroupLabel>
              {visibleSkills.map((path) => (
                <MenuItem key={path} onClick={() => onOpenPath(path)}>
                  <BotIcon className="size-4" />
                  <span className="truncate">{labelForCodexPath(path)}</span>
                </MenuItem>
              ))}
              {resolvedSummary.skills.length > visibleSkills.length ? (
                <MenuItem onClick={() => onOpenPath(".codex/skills")}>
                  <FolderSearchIcon className="size-4" />
                  Open skills folder
                  <span className="ms-auto text-muted-foreground text-xs">
                    +{resolvedSummary.skills.length - visibleSkills.length}
                  </span>
                </MenuItem>
              ) : null}
            </MenuGroup>
          </>
        ) : null}
        {resolvedSummary.agents.length > 0 ? (
          <>
            <MenuSeparator />
            <MenuGroup>
              <MenuGroupLabel>Agents</MenuGroupLabel>
              {visibleAgents.map((path) => (
                <MenuItem key={path} onClick={() => onOpenPath(path)}>
                  <BotIcon className="size-4" />
                  <span className="truncate">{labelForCodexPath(path)}</span>
                </MenuItem>
              ))}
              {resolvedSummary.agents.length > visibleAgents.length ? (
                <MenuItem onClick={() => onOpenPath(".codex/agents")}>
                  <FolderSearchIcon className="size-4" />
                  Open agents folder
                  <span className="ms-auto text-muted-foreground text-xs">
                    +{resolvedSummary.agents.length - visibleAgents.length}
                  </span>
                </MenuItem>
              ) : null}
            </MenuGroup>
          </>
        ) : null}
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel>Bootstrap repo-local Codex</MenuGroupLabel>
          {!resolvedSummary.hasAgentsMd ? (
            <MenuItem onClick={onCreateAgentsMd}>
              <FileTextIcon className="size-4" />
              Create AGENTS.md
            </MenuItem>
          ) : null}
          {!resolvedSummary.hasConfigToml ? (
            <MenuItem onClick={onCreateConfigToml}>
              <FileCode2Icon className="size-4" />
              Create .codex/config.toml
            </MenuItem>
          ) : null}
          {resolvedSummary.skills.length === 0 ? (
            <MenuItem onClick={onCreateSkill}>
              <BotIcon className="size-4" />
              Create starter skill
            </MenuItem>
          ) : null}
          {resolvedSummary.agents.length === 0 ? (
            <MenuItem onClick={onCreateAgent}>
              <BotIcon className="size-4" />
              Create starter agent
            </MenuItem>
          ) : null}
          {!resolvedSummary.hasAgentsMd &&
          !resolvedSummary.hasConfigToml &&
          resolvedSummary.skills.length === 0 &&
          resolvedSummary.agents.length === 0 ? (
            <MenuItem disabled>No repo-local Codex files detected yet</MenuItem>
          ) : null}
        </MenuGroup>
        <MenuSeparator />
        <MenuItem onClick={onOpenWorkspace}>Open workspace in editor</MenuItem>
      </MenuPopup>
    </Menu>
  );
});
