import { redirect } from "next/navigation";

// Connections moved into Integrations so every tool is set up in one place.
export default function ConnectionsPage() {
  redirect("/integrations");
}
