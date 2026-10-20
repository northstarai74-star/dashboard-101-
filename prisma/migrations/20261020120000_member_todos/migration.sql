-- To-dos belong to a person; existing rows keep a NULL owner and stay visible to admins only.
ALTER TABLE "Todo" ADD COLUMN "userId" TEXT;

CREATE INDEX "Todo_userId_idx" ON "Todo"("userId");

ALTER TABLE "Todo" ADD CONSTRAINT "Todo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
