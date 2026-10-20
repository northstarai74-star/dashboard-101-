import { cache } from "react";
import { db } from "./db";

export type AppSettings = {
  demoMode: boolean;
  autoAssign: boolean;
  aiAgent: boolean;
  claudeModel: string;
};

const DEFAULTS: AppSettings = {
  demoMode: true,
  autoAssign: true,
  aiAgent: true,
  claudeModel: "claude-sonnet-5-5",
};

// cache() dedupes the layout's and each page's call within one request, so settings are read once per render.
export const getSettings = cache(async (): Promise<AppSettings> => {
  const rows = await db.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    demoMode: map.demoMode !== undefined ? map.demoMode === "true" : DEFAULTS.demoMode,
    autoAssign: map.autoAssign !== undefined ? map.autoAssign === "true" : DEFAULTS.autoAssign,
    aiAgent: map.aiAgent !== undefined ? map.aiAgent === "true" : DEFAULTS.aiAgent,
    claudeModel: map.claudeModel ?? DEFAULTS.claudeModel,
  };
});

export async function saveSettings(patch: Partial<AppSettings>) {
  await Promise.all(
    Object.entries(patch).map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      }),
    ),
  );
}
