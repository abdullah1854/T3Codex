import { truncate } from "@t3tools/shared/String";
import type { ModelSelection, ThreadId } from "@t3tools/contracts";
import type { RuntimeMode, ProviderInteractionMode } from "@t3tools/contracts";
import type { ComposerImageAttachment } from "~/composerDraftStore";
import type { TerminalContextDraft } from "~/lib/terminalContext";

export interface QueuedComposerSubmission {
  id: string;
  createdAt: string;
  threadId: ThreadId;
  interactionMode: ProviderInteractionMode;
  terminalContexts: TerminalContextDraft[];
  images: ComposerImageAttachment[];
  modelSelection: ModelSelection;
  outgoingMessageText: string;
  preview: string;
  prompt: string;
  runtimeMode: RuntimeMode;
  titleSeed: string;
}

export function buildComposerSubmissionTitleSeed(input: {
  trimmedPrompt: string;
  images: readonly Pick<ComposerImageAttachment, "name">[];
  terminalContexts: readonly Pick<
    TerminalContextDraft,
    "terminalLabel" | "lineStart" | "lineEnd"
  >[];
  formatTerminalContextLabel: (
    context: Pick<TerminalContextDraft, "terminalLabel" | "lineStart" | "lineEnd">,
  ) => string;
}): string {
  if (input.trimmedPrompt) {
    return truncate(input.trimmedPrompt);
  }

  const firstComposerImage = input.images[0];
  if (firstComposerImage) {
    return truncate(`Image: ${firstComposerImage.name}`);
  }

  const firstTerminalContext = input.terminalContexts[0];
  if (firstTerminalContext) {
    return truncate(input.formatTerminalContextLabel(firstTerminalContext));
  }

  return "New thread";
}

export function buildQueuedComposerSubmissionPreview(input: {
  prompt: string;
  titleSeed: string;
}): string {
  const normalizedPrompt = input.prompt.replace(/\s+/g, " ").trim();
  return truncate(normalizedPrompt.length > 0 ? normalizedPrompt : input.titleSeed, 72);
}

export function getQueuedComposerSubmissionsForThread(
  queuedComposerSubmissions: readonly QueuedComposerSubmission[],
  threadId: ThreadId,
): QueuedComposerSubmission[] {
  return queuedComposerSubmissions.filter((submission) => submission.threadId === threadId);
}
