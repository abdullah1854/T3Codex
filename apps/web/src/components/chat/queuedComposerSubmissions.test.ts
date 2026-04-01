import { afterEach, describe, expect, it } from "vitest";
import { ThreadId } from "@t3tools/contracts";
import {
  buildComposerSubmissionTitleSeed,
  buildQueuedComposerSubmissionPreview,
  getQueuedComposerSubmissionsForThread,
  type QueuedComposerSubmission,
} from "./queuedComposerSubmissions";
import { useQueuedComposerSubmissionStore } from "~/queuedComposerSubmissionStore";

describe("queuedComposerSubmissions helpers", () => {
  it("prefers prompt text when building a title seed", () => {
    expect(
      buildComposerSubmissionTitleSeed({
        trimmedPrompt: "Investigate the queued send flow",
        images: [],
        terminalContexts: [],
        formatTerminalContextLabel: () => "Terminal 1 lines 1-4",
      }),
    ).toBe("Investigate the queued send flow");
  });

  it("falls back to image and terminal context labels when needed", () => {
    expect(
      buildComposerSubmissionTitleSeed({
        trimmedPrompt: "",
        images: [{ name: "diagram.png" }],
        terminalContexts: [],
        formatTerminalContextLabel: () => "Terminal 1 lines 1-4",
      }),
    ).toBe("Image: diagram.png");

    expect(
      buildComposerSubmissionTitleSeed({
        trimmedPrompt: "",
        images: [],
        terminalContexts: [{ terminalLabel: "Terminal 1", lineStart: 1, lineEnd: 4 }],
        formatTerminalContextLabel: () => "Terminal 1 lines 1-4",
      }),
    ).toBe("Terminal 1 lines 1-4");
  });

  it("builds compact queue previews from prompt text or title seed", () => {
    expect(
      buildQueuedComposerSubmissionPreview({
        prompt: "  Keep   this   preview compact  ",
        titleSeed: "Fallback",
      }),
    ).toBe("Keep this preview compact");

    expect(
      buildQueuedComposerSubmissionPreview({
        prompt: "   ",
        titleSeed: "Image: diagram.png",
      }),
    ).toBe("Image: diagram.png");
  });

  it("filters queued submissions by thread", () => {
    const threadA = ThreadId.makeUnsafe("thread-a");
    const threadB = ThreadId.makeUnsafe("thread-b");
    expect(
      getQueuedComposerSubmissionsForThread(
        [
          { id: "1", threadId: threadA },
          { id: "2", threadId: threadB },
          { id: "3", threadId: threadA },
        ] as QueuedComposerSubmission[],
        threadA,
      ).map((submission) => submission.id),
    ).toEqual(["1", "3"]);
  });
});

describe("queuedComposerSubmissionStore", () => {
  afterEach(() => {
    useQueuedComposerSubmissionStore.setState({ queuedComposerSubmissions: [] });
  });

  it("enqueues, removes, and clears queued submissions", () => {
    const threadA = ThreadId.makeUnsafe("thread-a");
    const threadB = ThreadId.makeUnsafe("thread-b");
    const store = useQueuedComposerSubmissionStore.getState();

    store.enqueueQueuedComposerSubmission({
      id: "submission-1",
      createdAt: "2026-04-01T00:00:00.000Z",
      threadId: threadA,
      interactionMode: "default",
      terminalContexts: [],
      images: [],
      modelSelection: { provider: "codex", model: "gpt-5.4" },
      outgoingMessageText: "one",
      preview: "one",
      prompt: "one",
      runtimeMode: "full-access",
      titleSeed: "one",
    });
    store.enqueueQueuedComposerSubmission({
      id: "submission-2",
      createdAt: "2026-04-01T00:00:01.000Z",
      threadId: threadB,
      interactionMode: "default",
      terminalContexts: [],
      images: [],
      modelSelection: { provider: "codex", model: "gpt-5.4" },
      outgoingMessageText: "two",
      preview: "two",
      prompt: "two",
      runtimeMode: "full-access",
      titleSeed: "two",
    });

    expect(useQueuedComposerSubmissionStore.getState().queuedComposerSubmissions).toHaveLength(2);

    store.removeQueuedComposerSubmission("submission-1");
    expect(
      useQueuedComposerSubmissionStore
        .getState()
        .queuedComposerSubmissions.map((submission) => submission.id),
    ).toEqual(["submission-2"]);

    store.clearQueuedComposerSubmissionsForThread(threadB);
    expect(useQueuedComposerSubmissionStore.getState().queuedComposerSubmissions).toEqual([]);
  });
});
