import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";

type Viewer = { id: string; role: string };

export const isAdmin = (u: Viewer) => u.role === "ADMIN";

/** Server pages for owner-only tools: signed-out visitors go to /login, team members back to their dashboard. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/");
  return user;
}

/**
 * Leads a person may see and work on. Admins see everything; a team member sees the leads assigned to them
 * plus the unassigned ones, which they can pick up.
 */
export function leadScope(u: Viewer) {
  return isAdmin(u) ? {} : { OR: [{ assignedUserId: u.id }, { assignedUserId: null }] };
}

/** Same rule for a lead already loaded from the database. */
export function canAccessLead(u: Viewer, lead: { assignedUserId: string | null }) {
  return isAdmin(u) || lead.assignedUserId === null || lead.assignedUserId === u.id;
}

/** Contacts a team member can see: those with at least one lead in their scope. */
export function contactScope(u: Viewer) {
  return isAdmin(u) ? {} : { leads: { some: leadScope(u) } };
}

/** Conversations follow their contact. */
export function conversationScope(u: Viewer) {
  return isAdmin(u) ? {} : { contact: contactScope(u) };
}
