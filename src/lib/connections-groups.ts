// Browser-safe. Kept apart from connections.ts, which imports the database client and must never reach client bundles.

/** Tab groups on the Connections page. */
export const GROUPS = [
  { id: "MESSAGING", label: "Messaging" },
  { id: "SOCIAL", label: "Social" },
  { id: "MARKETING", label: "Marketing & ads" },
  { id: "EMAIL_WEB", label: "Website" },
  { id: "FINANCE", label: "Finance" },
] as const;
export type GroupId = (typeof GROUPS)[number]["id"];
