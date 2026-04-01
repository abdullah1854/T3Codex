import { describe, expect, it } from "vitest";

import {
  buildCollapsedWorkProfileSummaryBadges,
  buildRepoCodexBadges,
  buildRepoCodexMessage,
  buildWorkspaceDefaultBadges,
} from "./WorkProfilePanel.logic";

describe("buildRepoCodexBadges", () => {
  it("summarizes the detected repo Codex surfaces", () => {
    expect(
      buildRepoCodexBadges({
        hasAgentsMd: true,
        hasConfigToml: true,
        skills: [".codex/skills/research/SKILL.md", ".codex/skills/plan/SKILL.md"],
        agents: [".codex/agents/researcher.toml"],
        profiles: [
          {
            name: "research-heavy",
            defaults: {
              approvalPolicy: null,
              modelSelection: null,
              planModeReasoningEffort: null,
              reasoningEffort: null,
              runtimeMode: null,
              sandboxMode: null,
              webSearchMode: null,
            },
          },
        ],
        configPreview: null,
        agentsPreview: null,
        workspaceDefaults: null,
      }),
    ).toEqual(["AGENTS.md", ".codex/config", "1 profile", "2 skills", "1 agent"]);
  });
});

describe("buildRepoCodexMessage", () => {
  it("adapts the helper copy for research mode", () => {
    expect(
      buildRepoCodexMessage({
        profileId: "research",
        repoCodexBadges: ["AGENTS.md"],
      }),
    ).toContain("Research mode should use those repo-local skills");
  });

  it("returns null when there is no repo Codex context", () => {
    expect(
      buildRepoCodexMessage({
        profileId: "general",
        repoCodexBadges: [],
      }),
    ).toBeNull();
  });
});

describe("buildWorkspaceDefaultBadges", () => {
  it("formats workspace defaults into concise badges", () => {
    expect(
      buildWorkspaceDefaultBadges({
        hasAgentsMd: false,
        hasConfigToml: true,
        skills: [],
        agents: [],
        profiles: [],
        configPreview: null,
        agentsPreview: null,
        workspaceDefaults: {
          approvalPolicy: "never",
          modelSelection: {
            provider: "codex",
            model: "gpt-5.4",
            options: {
              reasoningEffort: "high",
            },
          },
          planModeReasoningEffort: "xhigh",
          reasoningEffort: "high",
          runtimeMode: "full-access",
          sandboxMode: "danger-full-access",
          webSearchMode: "cached",
        },
      }),
    ).toEqual(["gpt-5.4", "high reasoning", "plan xhigh", "full access", "web cached"]);
  });
});

describe("buildCollapsedWorkProfileSummaryBadges", () => {
  it("prefers the selected repo profile over the suggested one", () => {
    expect(
      buildCollapsedWorkProfileSummaryBadges({
        projectSpecialization: {
          id: "crm",
          label: "CRM",
          description: "Customer CRM",
          recommendedWorkProfileId: "general",
          focusAreas: [],
          handoffNotes: [],
          preflight: {},
        },
        selectedWorkspaceCodexProfile: {
          name: "repo-default",
          defaults: {
            approvalPolicy: null,
            modelSelection: null,
            planModeReasoningEffort: null,
            reasoningEffort: null,
            runtimeMode: null,
            sandboxMode: null,
            webSearchMode: null,
          },
        },
        suggestedWorkspaceCodexProfile: {
          name: "research-heavy",
          defaults: {
            approvalPolicy: null,
            modelSelection: null,
            planModeReasoningEffort: null,
            reasoningEffort: null,
            runtimeMode: null,
            sandboxMode: null,
            webSearchMode: null,
          },
        },
        workspaceDefaultBadges: ["gpt-5.4", "high reasoning", "web cached"],
      }),
    ).toEqual(["CRM", "Profile: repo-default", "gpt-5.4", "high reasoning"]);
  });
});
