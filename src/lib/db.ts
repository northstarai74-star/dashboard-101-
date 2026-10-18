import { PrismaClient } from "@prisma/client";

// One client per server process in every environment. Creating a new client per module (production did this) opens
// a fresh connection pool and query engine each time, which made page loads slow.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

globalForPrisma.prisma = db;
