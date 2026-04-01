import type { WorkProfileId } from "@t3tools/contracts/settings";

import type { WorkProfilePreflight } from "./workProfiles";

export interface ProjectSpecialization {
  id: string;
  label: string;
  description: string;
  recommendedWorkProfileId: WorkProfileId;
  focusAreas: readonly string[];
  handoffNotes: readonly string[];
  preflight: WorkProfilePreflight;
}

const GBCR_WORKSPACE_PATH = "/Users/abdullah/Documents/GBCR React CRM";
const GBCR_CODEBASE_PATH = `${GBCR_WORKSPACE_PATH}/Implementation/CRM Dev`;

export const PROJECT_SPECIALIZATIONS: readonly ProjectSpecialization[] = [
  {
    id: "gbcr-react-crm",
    label: "GBCR React CRM",
    description:
      "Deadline-oriented CRM delivery mode for Goldbell fleet-leasing CRM rebuild. Smallest shippable change, design system compliance, form parity against legacy Dynamics CRM, and structured handoff.",
    recommendedWorkProfileId: "general",
    focusAreas: [
      "React UI fixes following DESIGN_SYSTEM.md tokens (gold #F5A623, three-tier typography, four-value spacing)",
      "Form parity against legacy Dynamics CRM — screenshot is source of truth, not DB schema",
      "Express API and MSSQL (gbcr schema) backend fixes with build verification",
      "Minimal blast radius — smallest correct change, no adjacent refactors",
      "Protected modules: Leads, Freshsales webhook, Dashboard Active Accounts need Orchestrator approval",
      "Mobile-first: 44px touch targets, no Ant Segmented on mobile, responsive columns",
      "Data integrity: real Dev DB data, business identifiers (Q-GBCR-..., O-...), never raw GUIDs",
      "Approval workflows: form lock on Awaiting/Approved, role-gated actions, blocking fields enforced",
    ],
    handoffNotes: [
      "Name the exact route, screen, and component files affected.",
      "Call out any manual QA path the next session should click through.",
      "Note whether the change touches a protected module (Leads, Freshsales webhook, Dashboard Active Accounts).",
      "If a form was modified, state whether it was verified against a legacy CRM screenshot.",
      "If a migration script was added, give its number and what it does.",
      "List any open audit findings in AUDIT.md that relate to the changed area.",
      "Confirm npm run build passed and note the verification method (visual, curl, DB query).",
    ],
    preflight: {
      system: "GBCR React CRM (React 18 + Express 5 + MSSQL, gbcr schema)",
      environment:
        "Confirm active branch, target route/screen, and whether module is DB-backed or mock-backed",
      outputFormat: "Working code — run npm run build to verify",
      target: "CRM screen, route, component, API endpoint, or database migration",
      evidence:
        "Current UI behavior, legacy CRM screenshot (for form work), Dev DB query results, and exact files to touch",
    },
  },
] as const;

function normalizePath(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return value.replace(/\/+$/, "");
}

export function resolveProjectSpecialization(input: {
  cwd: string | null | undefined;
  projectName: string | null | undefined;
}) {
  const normalizedCwd = normalizePath(input.cwd);
  const normalizedProjectName = input.projectName?.trim().toLowerCase() ?? null;

  return (
    PROJECT_SPECIALIZATIONS.find((specialization) => {
      if (specialization.id === "gbcr-react-crm") {
        return (
          normalizedCwd === GBCR_WORKSPACE_PATH ||
          normalizedCwd === GBCR_CODEBASE_PATH ||
          normalizedProjectName === "gbcr react crm" ||
          normalizedProjectName === "gbcr crm" ||
          normalizedProjectName === "crm dev"
        );
      }
      return false;
    }) ?? null
  );
}
