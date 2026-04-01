import { memo } from "react";
import { XIcon } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "~/lib/utils";
import type { QueuedComposerSubmission } from "./queuedComposerSubmissions";

interface QueuedComposerSubmissionsPanelProps {
  blockedReason: string | null;
  items: readonly QueuedComposerSubmission[];
  onRemove: (submissionId: string) => void;
}

export const QueuedComposerSubmissionsPanel = memo(function QueuedComposerSubmissionsPanel({
  blockedReason,
  items,
  onRemove,
}: QueuedComposerSubmissionsPanelProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="queued-composer-submissions-panel"
      className="mb-2 rounded-2xl border border-border/70 bg-muted/15 p-2.5 sm:p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" size="sm">
          Queue
        </Badge>
        <span className="text-sm font-medium text-foreground">
          {items.length} queued message{items.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {blockedReason ?? "Queued messages will send automatically in order."}
      </p>

      <div className="mt-2 space-y-2">
        {items.map((submission, index) => (
          <div
            key={submission.id}
            data-testid={`queued-composer-submission-${submission.id}`}
            className={cn(
              "flex items-start gap-2 rounded-xl border border-border/60 bg-background/60 px-2.5 py-2",
              index === 0 && blockedReason === null && "border-primary/30",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" size="sm">
                  #{index + 1}
                </Badge>
                <span className="text-xs font-medium text-foreground">{submission.titleSeed}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {submission.preview}
              </p>
            </div>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              data-testid={`queued-composer-submission-remove-${submission.id}`}
              aria-label={`Remove queued message ${index + 1}`}
              onClick={() => onRemove(submission.id)}
            >
              <XIcon />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
});
