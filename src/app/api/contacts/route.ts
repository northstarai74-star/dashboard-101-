import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { ContactBody, cleanContact } from "@/lib/contacts";

// Team members add people through "New lead" on the Leads page; a bare contact would be invisible to them.
export const POST = route(async (req) => {
  const b = ContactBody.parse(await req.json());
  return json(await db.contact.create({ data: { ...cleanContact(b), source: "MANUAL" } }), 201);
}, { admin: true });
