import { describe, expect, it } from "vitest";

import {
  buildAgentHandoffMarkdown,
  deriveInstructionLayers,
  deriveReviewReadiness,
  deriveVerificationScripts,
  deriveVerificationSummary,
  selectLatestChangedFiles,
} from "./agentWorkbench";

describe("agentWorkbench helpers", () => {
  it("derives verification scripts from project scripts", () => {
    const scripts = [
      {
        id: "setup",
        name: "Setup",
        command: "bun install",
        icon: "configure" as const,
        runOnWorktreeCreate: true,
      },
      {
        id: "lint",
        name: "Lint",
        command: "bun lint",
        icon: "lint" as const,
        runOnWorktreeCreate: false,
      },
      {
        id: "types",
        name: "Typecheck",
        command: "bun typecheck",
        icon: "configure" as const,
        runOnWorktreeCreate: false,
      },
      {
        id: "build",
        name: "Build",
        command: "bun build",
        icon: "build" as const,
        runOnWorktreeCreate: false,
      },
      {
        id: "test",
        name: "Vitest",
        command: "bun run test",
        icon: "test" as const,
        runOnWorktreeCreate: false,
      },
    ];

    expect(
      deriveVerificationScripts(scripts).map((script) => ({
        id: script.id,
        role: script.role,
      })),
    ).toEqual([
      { id: "lint", role: "lint" },
      { id: "types", role: "typecheck" },
      { id: "build", role: "build" },
      { id: "test", role: "test" },
    ]);
  });

  it("summarizes verification state for the required turn", () => {
    const scripts = deriveVerificationScripts([
      {
        id: "lint",
        name: "Lint",
        command: "bun lint",
        icon: "lint" as const,
        runOnWorktreeCreate: false,
      },
      {
        id: "types",
        name: "Typecheck",
        command: "bun typecheck",
        icon: "configure" as const,
        runOnWorktreeCreate: false,
      },
    ]);

    expect(
      deriveVerificationSummary({
        requiredTurnId: "turn-2",
        scripts,
        runs: [
          {
            completedAt: "2026-04-01T10:05:00.000Z",
            error: null,
            exitCode: 0,
            exitSignal: null,
            role: "lint",
            runId: "run-1",
            scriptCommand: "bun lint",
            scriptId: "lint",
            scriptName: "Lint",
            startedAt: "2026-04-01T10:04:00.000Z",
            status: "passed",
            terminalId: "terminal-1",
            threadId: "thread-1",
            turnId: "turn-2",
          },
        ],
      }),
    ).toEqual({
      failedCount: 0,
      passedCount: 1,
      pendingCount: 1,
      runningCount: 0,
      status: "pending",
    });
  });

  it("builds instruction layers including repo and runtime context", () => {
    const layers = deriveInstructionLayers({
      interactionMode: "plan",
      preflight: {
        system: "Local repo",
        evidence: "Diffs and tests",
      },
      projectSpecialization: null,
      runtimeMode: "approval-required",
      selectedProvider: "codex",
      selectedWorkspaceCodexProfileName: "careful-edits",
      suggestedWorkspaceCodexProfileName: "careful-edits",
      workProfile: {
        id: "planning",
        label: "Plan First",
        shortLabel: "Planning",
        description: "Decision-focused planning before implementation.",
        defaults: {},
      },
      workspaceCodexSummary: {
        agents: [],
        agentsPreview: "# Abdullah's AI Maximization Protocol",
        configPreview: 'model = "gpt-5.3-codex"',
        hasAgentsMd: true,
        hasConfigToml: true,
        profiles: [],
        skills: [],
        workspaceDefaults: {
          approvalPolicy: "never",
          modelSelection: {
            provider: "codex",
            model: "gpt-5.3-codex",
          },
          planModeReasoningEffort: "high",
          reasoningEffort: "medium",
          runtimeMode: "full-access",
          sandboxMode: "danger-full-access",
          webSearchMode: "cached",
        },
      },
      workspaceDefaultsSuppressed: false,
    });

    expect(layers.map((layer) => layer.id)).toContain("work-profile");
    expect(layers.map((layer) => layer.id)).toContain("agents-md");
    expect(layers.map((layer) => layer.id)).toContain("codex-config");
    expect(layers.map((layer) => layer.id)).toContain("runtime-envelope");
  });

  it("selects changed files for the latest turn", () => {
    expect(
      selectLatestChangedFiles({
        latestTurnId: "turn-2",
        turnDiffSummaries: [
          {
            turnId: "turn-1",
            files: [{ path: "README.md" }],
          },
          {
            turnId: "turn-2",
            files: [{ path: "src/app.ts" }],
          },
        ],
      }),
    ).toEqual([{ path: "src/app.ts" }]);
  });

  it("marks review readiness as attention when default-branch work has failing checks", () => {
    const verificationScripts = deriveVerificationScripts([
      {
        id: "lint",
        name: "Lint",
        command: "bun lint",
        icon: "lint" as const,
        runOnWorktreeCreate: false,
      },
    ]);

    const review = deriveReviewReadiness({
      activeBranch: "main",
      activeWorktreePath: null,
      changedFiles: [{ path: "src/app.ts" }],
      gitStatus: {
        aheadCount: 0,
        behindCount: 0,
        branch: "main",
        hasUpstream: true,
        hasWorkingTreeChanges: true,
        pr: null,
        workingTree: {
          deletions: 0,
          files: [{ deletions: 0, insertions: 12, path: "src/app.ts" }],
          insertions: 12,
        },
      },
      isCurrentBranchDefault: true,
      verificationSummary: {
        failedCount: 1,
        passedCount: 0,
        pendingCount: 0,
        runningCount: 0,
        status: "failed",
      },
      verificationScripts,
    });

    expect(review.status).toBe("attention");
    expect(review.nextStep).toContain("failing verification checks");
    expect(review.items.find((item) => item.id === "isolation")?.status).toBe("attention");
    expect(review.items.find((item) => item.id === "verification")?.status).toBe("attention");
  });

  it("marks review readiness as ready for verified feature-branch work with a PR", () => {
    const verificationScripts = deriveVerificationScripts([
      {
        id: "lint",
        name: "Lint",
        command: "bun lint",
        icon: "lint" as const,
        runOnWorktreeCreate: false,
      },
      {
        id: "build",
        name: "Build",
        command: "bun build",
        icon: "build" as const,
        runOnWorktreeCreate: false,
      },
    ]);

    const review = deriveReviewReadiness({
      activeBranch: "feature/workbench",
      activeWorktreePath: "/repo/.t3/worktrees/feature-workbench",
      changedFiles: [{ path: "src/app.ts" }, { path: "src/chat.ts" }],
      gitStatus: {
        aheadCount: 2,
        behindCount: 0,
        branch: "feature/workbench",
        hasUpstream: true,
        hasWorkingTreeChanges: false,
        pr: {
          baseBranch: "main",
          headBranch: "feature/workbench",
          number: 42,
          state: "open",
          title: "Workbench review flow",
          url: "https://github.com/example/repo/pull/42",
        },
        workingTree: {
          deletions: 0,
          files: [],
          insertions: 0,
        },
      },
      isCurrentBranchDefault: false,
      verificationSummary: {
        failedCount: 0,
        passedCount: 2,
        pendingCount: 0,
        runningCount: 0,
        status: "passed",
      },
      verificationScripts,
    });

    expect(review.status).toBe("ready");
    expect(review.headline).toContain("packaged cleanly");
    expect(review.nextStep).toContain("open PR");
  });

  it("builds a handoff markdown package with review and verification details", () => {
    const verificationScripts = deriveVerificationScripts([
      {
        id: "lint",
        name: "Lint",
        command: "bun lint",
        icon: "lint" as const,
        runOnWorktreeCreate: false,
      },
    ]);
    const verificationSummary = deriveVerificationSummary({
      requiredTurnId: "turn-5",
      scripts: verificationScripts,
      runs: [
        {
          completedAt: "2026-04-01T10:05:00.000Z",
          error: null,
          exitCode: 0,
          exitSignal: null,
          role: "lint",
          runId: "run-1",
          scriptCommand: "bun lint",
          scriptId: "lint",
          scriptName: "Lint",
          startedAt: "2026-04-01T10:04:00.000Z",
          status: "passed",
          terminalId: "terminal-1",
          threadId: "thread-1",
          turnId: "turn-5",
        },
      ],
    });
    const reviewReadiness = deriveReviewReadiness({
      activeBranch: "feature/workbench",
      activeWorktreePath: "/repo/.t3/worktrees/feature-workbench",
      changedFiles: [{ additions: 8, deletions: 2, path: "src/app.ts" }],
      gitStatus: {
        aheadCount: 1,
        behindCount: 0,
        branch: "feature/workbench",
        hasUpstream: true,
        hasWorkingTreeChanges: false,
        pr: null,
        workingTree: {
          deletions: 0,
          files: [],
          insertions: 0,
        },
      },
      isCurrentBranchDefault: false,
      verificationSummary,
      verificationScripts,
    });

    const markdown = buildAgentHandoffMarkdown({
      activeBranch: "feature/workbench",
      activeProjectName: "T3Codex",
      activeProjectPath: "/repo",
      activeThreadTitle: "Workbench polish",
      activeWorktreePath: "/repo/.t3/worktrees/feature-workbench",
      gitStatus: {
        aheadCount: 1,
        behindCount: 0,
        branch: "feature/workbench",
        hasUpstream: true,
        hasWorkingTreeChanges: false,
        pr: null,
        workingTree: {
          deletions: 0,
          files: [],
          insertions: 0,
        },
      },
      interactionMode: "default",
      latestChangedFiles: [{ additions: 8, deletions: 2, path: "src/app.ts" }],
      preflight: {
        evidence: "Diffs and checks",
        system: "Local repo",
      },
      projectSpecialization: null,
      prompt: "Ship the workbench review flow.",
      reviewReadiness,
      runtimeMode: "full-access",
      selectedProvider: "codex",
      selectedWorkspaceCodexProfileName: null,
      suggestedWorkspaceCodexProfileName: "careful-edits",
      verificationRequiredTurnId: "turn-5",
      verificationRuns: [
        {
          completedAt: "2026-04-01T10:05:00.000Z",
          error: null,
          exitCode: 0,
          exitSignal: null,
          role: "lint",
          runId: "run-1",
          scriptCommand: "bun lint",
          scriptId: "lint",
          scriptName: "Lint",
          startedAt: "2026-04-01T10:04:00.000Z",
          status: "passed",
          terminalId: "terminal-1",
          threadId: "thread-1",
          turnId: "turn-5",
        },
      ],
      verificationScripts,
      verificationSummary,
      workProfileLabel: "General Engineering",
      workspaceCodexSummary: {
        agents: [],
        agentsPreview: "# Repo rules",
        configPreview: 'model = "gpt-5.4"',
        hasAgentsMd: true,
        hasConfigToml: true,
        profiles: [],
        skills: [],
        workspaceDefaults: {
          approvalPolicy: "never",
          modelSelection: {
            provider: "codex",
            model: "gpt-5.4",
          },
          planModeReasoningEffort: "high",
          reasoningEffort: "medium",
          runtimeMode: "full-access",
          sandboxMode: "danger-full-access",
          webSearchMode: "cached",
        },
      },
      workspaceDefaultsSuppressed: false,
    });

    expect(markdown).toContain("## Review readiness");
    expect(markdown).toContain("feature/workbench");
    expect(markdown).toContain("Lint (Lint): passed (exit 0)");
    expect(markdown).toContain("src/app.ts (+8 / -2)");
  });
});
