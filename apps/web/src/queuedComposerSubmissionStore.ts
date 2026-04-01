import type { ThreadId } from "@t3tools/contracts";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  getQueuedComposerSubmissionsForThread,
  type QueuedComposerSubmission,
} from "./components/chat/queuedComposerSubmissions";

interface QueuedComposerSubmissionStore {
  queuedComposerSubmissions: QueuedComposerSubmission[];
  enqueueQueuedComposerSubmission: (submission: QueuedComposerSubmission) => void;
  removeQueuedComposerSubmission: (submissionId: string) => void;
  clearQueuedComposerSubmissionsForThread: (threadId: ThreadId) => void;
}

export const useQueuedComposerSubmissionStore = create<QueuedComposerSubmissionStore>((set) => ({
  queuedComposerSubmissions: [],
  enqueueQueuedComposerSubmission: (submission) =>
    set((state) => ({
      queuedComposerSubmissions: [...state.queuedComposerSubmissions, submission],
    })),
  removeQueuedComposerSubmission: (submissionId) =>
    set((state) => ({
      queuedComposerSubmissions: state.queuedComposerSubmissions.filter(
        (submission) => submission.id !== submissionId,
      ),
    })),
  clearQueuedComposerSubmissionsForThread: (threadId) =>
    set((state) => ({
      queuedComposerSubmissions: state.queuedComposerSubmissions.filter(
        (submission) => submission.threadId !== threadId,
      ),
    })),
}));

export function useQueuedComposerSubmissions(threadId: ThreadId): QueuedComposerSubmission[] {
  return useQueuedComposerSubmissionStore(
    useShallow((state) =>
      getQueuedComposerSubmissionsForThread(state.queuedComposerSubmissions, threadId),
    ),
  );
}
