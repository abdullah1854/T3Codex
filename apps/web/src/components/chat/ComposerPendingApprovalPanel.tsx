import { memo } from "react";
import {
  AlertTriangleIcon,
  EyeIcon,
  FilePenLineIcon,
  GitBranchIcon,
  GlobeIcon,
  ServerIcon,
  TerminalIcon,
} from "lucide-react";
import { type PendingApproval } from "../../session-logic";
import { Badge } from "../ui/badge";
import { classifyApprovalRisk } from "../../approvalRisk";

interface ComposerPendingApprovalPanelProps {
  approval: PendingApproval;
  pendingCount: number;
}

export const ComposerPendingApprovalPanel = memo(function ComposerPendingApprovalPanel({
  approval,
  pendingCount,
}: ComposerPendingApprovalPanelProps) {
  const risk = classifyApprovalRisk(approval);
  const CategoryIcon =
    risk.category === "remote"
      ? ServerIcon
      : risk.category === "network"
        ? GlobeIcon
        : risk.category === "git"
          ? GitBranchIcon
          : risk.category === "file-read" || risk.category === "sensitive-read"
            ? EyeIcon
            : risk.category === "file-write" || risk.category === "sensitive-write"
              ? FilePenLineIcon
              : TerminalIcon;
  const severityVariant =
    risk.severity === "high" ? "destructive" : risk.severity === "medium" ? "warning" : "secondary";

  return (
    <div className="px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="uppercase text-sm tracking-[0.2em]">PENDING APPROVAL</span>
        <Badge variant={severityVariant} size="sm">
          {risk.severity === "high" ? (
            <AlertTriangleIcon className="size-3" />
          ) : (
            <CategoryIcon className="size-3" />
          )}
          {risk.title}
        </Badge>
        {pendingCount > 1 ? (
          <span className="text-xs text-muted-foreground">1/{pendingCount}</span>
        ) : null}
      </div>
      {risk.summary ? (
        <p className="mt-2 text-sm font-medium text-foreground">{risk.summary}</p>
      ) : null}
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {approval.requestKind === "command"
          ? "Review the command scope before allowing it to run."
          : approval.requestKind === "file-read"
            ? "Review the file access scope before allowing the read."
            : "Review the file change target before allowing the write."}
      </p>
    </div>
  );
});
