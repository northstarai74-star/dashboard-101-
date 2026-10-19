import { PrismaClient } from "@prisma/client";

// One client per server process in every environment. Creating a new client per module (production did this) opens
// a fresh connection pool and query engine each time, which made page loads slow.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// On Vercel every serverless instance opens its own pool. Prisma's default pool size (CPUs × 2 + 1) multiplied across
// instances exhausts the Supabase session pooler, and requests queue waiting for a connection. One connection per
// instance is Prisma's recommended setting for serverless.
function withPoolLimit(url?: string) {
  if (!url || url.includes("connection_limit=")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=1`;
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient(process.env.NODE_ENV === "production" ? { datasourceUrl: withPoolLimit(process.env.DATABASE_URL) } : undefined);

globalForPrisma.prisma = db;
