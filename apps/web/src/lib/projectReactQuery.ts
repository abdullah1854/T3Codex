import type { ProjectReadTextFileResult, ProjectSearchEntriesResult } from "@t3tools/contracts";
import { queryOptions } from "@tanstack/react-query";
import { ensureNativeApi } from "~/nativeApi";

export const projectQueryKeys = {
  all: ["projects"] as const,
  searchEntries: (cwd: string | null, query: string, limit: number) =>
    ["projects", "search-entries", cwd, query, limit] as const,
  readTextFile: (cwd: string | null, relativePath: string) =>
    ["projects", "read-text-file", cwd, relativePath] as const,
};

const DEFAULT_SEARCH_ENTRIES_LIMIT = 80;
const DEFAULT_SEARCH_ENTRIES_STALE_TIME = 15_000;
const EMPTY_SEARCH_ENTRIES_RESULT: ProjectSearchEntriesResult = {
  entries: [],
  truncated: false,
};
const EMPTY_READ_TEXT_FILE_RESULT: ProjectReadTextFileResult = {
  relativePath: "",
  contents: "",
};

export function projectSearchEntriesQueryOptions(input: {
  cwd: string | null;
  query: string;
  enabled?: boolean;
  limit?: number;
  staleTime?: number;
}) {
  const limit = input.limit ?? DEFAULT_SEARCH_ENTRIES_LIMIT;
  return queryOptions({
    queryKey: projectQueryKeys.searchEntries(input.cwd, input.query, limit),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd) {
        throw new Error("Workspace entry search is unavailable.");
      }
      return api.projects.searchEntries({
        cwd: input.cwd,
        query: input.query,
        limit,
      });
    },
    enabled: (input.enabled ?? true) && input.cwd !== null,
    staleTime: input.staleTime ?? DEFAULT_SEARCH_ENTRIES_STALE_TIME,
    placeholderData: (previous) => previous ?? EMPTY_SEARCH_ENTRIES_RESULT,
  });
}

export function projectReadTextFileQueryOptions(input: {
  cwd: string | null;
  relativePath: string;
  enabled?: boolean;
  staleTime?: number;
}) {
  return queryOptions({
    queryKey: projectQueryKeys.readTextFile(input.cwd, input.relativePath),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd) {
        throw new Error("Workspace file read is unavailable.");
      }
      return api.projects.readTextFile({
        cwd: input.cwd,
        relativePath: input.relativePath,
      });
    },
    enabled: (input.enabled ?? true) && input.cwd !== null && input.relativePath.trim().length > 0,
    staleTime: input.staleTime ?? DEFAULT_SEARCH_ENTRIES_STALE_TIME,
    placeholderData: (previous) => previous ?? EMPTY_READ_TEXT_FILE_RESULT,
  });
}
