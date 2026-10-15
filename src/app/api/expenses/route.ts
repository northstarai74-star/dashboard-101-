import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { EXPENSE_CATEGORIES } from "@/lib/analytics";

const ExpenseInput = z.object({
  label: z.string().trim().min(1, "Describe the expense").max(120),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().positive("Amount must be more than 0").max(1e9),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const GET = route(async () => json(await db.expense.findMany({ orderBy: { date: "desc" }, take: 50 })));

export const POST = route(async (req) => {
  const input = ExpenseInput.parse(await req.json());
  const expense = await db.expense.create({
    data: { ...input, date: input.date ? new Date(`${input.date}T00:00:00.000Z`) : new Date() },
  });
  return json(expense, 201);
});
