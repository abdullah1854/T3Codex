import type { PendingApproval } from "./session-logic";

export type ApprovalRiskCategory =
  | "command"
  | "network"
  | "git"
  | "remote"
  | "file-read"
  | "file-write"
  | "sensitive-read"
  | "sensitive-write";

export type ApprovalRiskSeverity = "low" | "medium" | "high";

export interface ApprovalRiskSummary {
  category: ApprovalRiskCategory;
  severity: ApprovalRiskSeverity;
  title: string;
  summary: string | null;
}

const SENSITIVE_PATH_PATTERN =
  /(^|\/)(\.env(\.[^/]+)?|\.ssh|id_rsa|id_ed25519|.*\.pem|auth\.json|secrets?)(\/|$)/i;
const REMOTE_COMMAND_PATTERN = /\b(ssh|scp|sftp|rsync|mosh)\b/i;
const NETWORK_COMMAND_PATTERN = /\b(curl|wget|httpie|nc|ncat)\b|https?:\/\//i;
const GIT_COMMAND_PATTERN = /(^|\s)git(\s|$)/i;
const DESTRUCTIVE_COMMAND_PATTERN =
  /\brm\s+-rf\b|\bgit\s+reset\s+--hard\b|\bmkfs\b|\bdd\b|\bshutdown\b|\breboot\b/i;

function collectStringCandidates(value: unknown, depth = 0): string[] {
  if (depth > 3 || value === null || value === undefined) {
    return [];
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStringCandidates(entry, depth + 1));
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((entry) =>
      collectStringCandidates(entry, depth + 1),
    );
  }
  return [];
}

function findMatchingCandidate(candidates: ReadonlyArray<string>, pattern: RegExp): string | null {
  return candidates.find((candidate) => pattern.test(candidate)) ?? null;
}

function truncateCandidate(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

export function classifyApprovalRisk(approval: PendingApproval): ApprovalRiskSummary {
  const candidates = Array.from(
    new Set([
      ...(approval.detail ? [approval.detail] : []),
      ...collectStringCandidates(approval.args),
    ]),
  );
  const sensitiveCandidate = findMatchingCandidate(candidates, SENSITIVE_PATH_PATTERN);

  if (approval.requestKind === "file-read") {
    return sensitiveCandidate
      ? {
          category: "sensitive-read",
          severity: "high",
          title: "Sensitive file read",
          summary: truncateCandidate(sensitiveCandidate),
        }
      : {
          category: "file-read",
          severity: "low",
          title: "Workspace file read",
          summary: truncateCandidate(candidates[0] ?? null),
        };
  }

  if (approval.requestKind === "file-change") {
    return sensitiveCandidate
      ? {
          category: "sensitive-write",
          severity: "high",
          title: "Sensitive file write",
          summary: truncateCandidate(sensitiveCandidate),
        }
      : {
          category: "file-write",
          severity: "medium",
          title: "Workspace file write",
          summary: truncateCandidate(candidates[0] ?? null),
        };
  }

  const remoteCandidate = findMatchingCandidate(candidates, REMOTE_COMMAND_PATTERN);
  if (remoteCandidate) {
    return {
      category: "remote",
      severity: "high",
      title: "Remote host command",
      summary: truncateCandidate(remoteCandidate),
    };
  }

  const networkCandidate = findMatchingCandidate(candidates, NETWORK_COMMAND_PATTERN);
  if (networkCandidate) {
    return {
      category: "network",
      severity: "high",
      title: "Network command",
      summary: truncateCandidate(networkCandidate),
    };
  }

  const gitCandidate = findMatchingCandidate(candidates, GIT_COMMAND_PATTERN);
  if (gitCandidate) {
    const destructive = DESTRUCTIVE_COMMAND_PATTERN.test(gitCandidate);
    return {
      category: "git",
      severity: destructive ? "high" : "medium",
      title: destructive ? "Destructive git command" : "Git command",
      summary: truncateCandidate(gitCandidate),
    };
  }

  const commandCandidate = truncateCandidate(candidates[0] ?? approval.detail ?? null);
  const destructive = commandCandidate ? DESTRUCTIVE_COMMAND_PATTERN.test(commandCandidate) : false;
  return {
    category: "command",
    severity: destructive ? "high" : "medium",
    title: destructive ? "Destructive command" : "Local command",
    summary: commandCandidate,
  };
}
