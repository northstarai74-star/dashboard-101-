import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { contactScope } from "@/lib/access";
import { ContactBody, cleanContact } from "@/lib/contacts";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }, me) => {
  const { id } = await params;
  const b = ContactBody.parse(await req.json());
  if (!(await db.contact.findFirst({ where: { id, ...contactScope(me) }, select: { id: true } }))) return json({ error: "Not found" }, 404);
  return json(await db.contact.update({ where: { id }, data: cleanContact(b) }));
});

export const DELETE = route<Ctx>(
  async (_req, { params }) => {
    const { id } = await params;
    await db.contact.delete({ where: { id } });
    return json({ ok: true });
  },
  { admin: true },
);
