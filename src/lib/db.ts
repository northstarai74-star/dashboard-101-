import { PrismaClient } from "@prisma/client";

// One client per server process in every environment. Creating a new client per module (production did this) opens
// a fresh connection pool and query engine each time, which made page loads slow.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// On Vercel every serverless instance opens its own pool. Prisma's default pool size (CPUs × 2 + 1) multiplied across
// instances exhausts the Supabase session pooler, and requests queue waiting for a connection. One connection per
// instance is Prisma's recommended setting for serverless, but it serializes every query a page runs, so pages got slow
// and queued requests hit the 10s pool timeout. Set DB_CONNECTION_LIMIT (e.g. 5) when the database uses the transaction
// pooler (port 6543 with ?pgbouncer=true), which tolerates many more client connections.
// pool_timeout gives queued queries room to wait instead of failing with "Timed out fetching a new connection".
function withPoolLimit(url?: string) {
  if (!url) return url;
  const limit = Number(process.env.DB_CONNECTION_LIMIT) || 1;
  const params = [
    url.includes("connection_limit=") ? "" : `connection_limit=${limit}`,
    url.includes("pool_timeout=") ? "" : "pool_timeout=30",
  ].filter(Boolean);
  if (params.length === 0) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${params.join("&")}`;
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient(process.env.NODE_ENV === "production" ? { datasourceUrl: withPoolLimit(process.env.DATABASE_URL) } : undefined);

globalForPrisma.prisma = db;
