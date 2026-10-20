import { cache } from "react";
import { db } from "./db";
import { parseSettings, type AppSettings } from "./settings";

export type ShellData = { unread: number; comments: number; settings: AppSettings };

const SETTING_KEYS = ["demoMode", "autoAssign", "aiAgent", "claudeModel"];

/**
 * Everything the app shell shows on every page (unread messages, open comments, workspace settings) in ONE
 * round trip. These were three separate queries, and each one is a full network trip to the database.
 *
 * A team member's unread count only covers conversations whose contact has a lead in their scope
 * (assigned to them or unassigned, the same rule as `conversationScope`), and they see no comment count.
 * cache() makes the layout and the page share one call per request.
 */
export const getShellData = cache(async (userId: string, isAdmin: boolean): Promise<ShellData> => {
  const [row] = await db.$queryRaw<{ unread: number; comments: number; settings: { key: string; value: string }[] }[]>`
    SELECT
      COALESCE((
        SELECT SUM(c."unread") FROM "Conversation" c
        WHERE ${isAdmin} OR EXISTS (
          SELECT 1 FROM "Lead" l
          WHERE l."contactId" = c."contactId" AND (l."assignedUserId" = ${userId} OR l."assignedUserId" IS NULL)
        )
      ), 0)::int AS unread,
      (CASE WHEN ${isAdmin} THEN (SELECT COUNT(*) FROM "Comment" WHERE NOT "handled") ELSE 0 END)::int AS comments,
      COALESCE((SELECT json_agg(json_build_object('key', s."key", 'value', s."value")) FROM "Setting" s WHERE s."key" = ANY(${SETTING_KEYS})), '[]'::json) AS settings`;
  return { unread: row.unread, comments: row.comments, settings: parseSettings(row.settings) };
});
