import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const globalDb = globalThis as unknown as { nexoDb?: PrismaClient };
export const db = globalDb.nexoDb ?? new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL || 'postgresql://nexo:nexo_local@localhost:5432/nexo', max: 5, connectionTimeoutMillis: 15000 })
});
if (process.env.NODE_ENV !== 'production') globalDb.nexoDb = db;
