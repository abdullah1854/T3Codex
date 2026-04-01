import { describe, expect, it } from "vitest";

import { projectQueryKeys, projectSearchEntriesQueryOptions } from "./projectReactQuery";

describe("projectSearchEntriesQueryOptions", () => {
  it("keeps empty-query workspace browsing enabled when cwd is present", () => {
    const options = projectSearchEntriesQueryOptions({
      cwd: "/repo",
      enabled: true,
      query: "",
    });

    expect(options.queryKey).toEqual(projectQueryKeys.searchEntries("/repo", "", 80));
    expect(options.enabled).toBe(true);
  });

  it("disables workspace browsing when cwd is missing", () => {
    const options = projectSearchEntriesQueryOptions({
      cwd: null,
      enabled: true,
      query: "",
    });

    expect(options.enabled).toBe(false);
  });
});
