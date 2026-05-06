import { redirect } from "next/navigation";
import { getSetupStatus } from "@/lib/queries";
import { Wizard } from "./wizard";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const status = await getSetupStatus();
  if (status.setupComplete) {
    redirect("/");
  }
  return <Wizard initialStatus={status} />;
}
