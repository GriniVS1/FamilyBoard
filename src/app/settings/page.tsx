import { AppShell } from "@/components/shell/app-shell";
import { SettingsView, type OauthBanner } from "@/components/settings/settings-view";
import { getFamily, listMembers } from "@/lib/queries";
import type { CalendarMember } from "@/components/calendar/types";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function pickString(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  const v = params?.[key];
  if (Array.isArray(v)) return v[0];
  return v ?? undefined;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = (await searchParams) ?? {};
  const [family, members] = await Promise.all([getFamily(), listMembers()]);

  const initialMembers: CalendarMember[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    color: m.color,
    emoji: m.emoji,
    role: m.role,
  }));

  const googleParam = pickString(params, "google");
  const memberId = pickString(params, "member");
  const reason = pickString(params, "reason");

  let banner: OauthBanner | null = null;
  if (googleParam === "connected") {
    const member = initialMembers.find((m) => m.id === memberId);
    banner = {
      kind: "success",
      memberId,
      memberName: member?.name,
    };
  } else if (googleParam === "error") {
    banner = {
      kind: "error",
      reason,
    };
  }

  return (
    <AppShell>
      <SettingsView
        family={
          family
            ? {
                id: family.id,
                name: family.name,
                weatherLat: family.weatherLat,
                weatherLon: family.weatherLon,
                weatherLabel: family.weatherLabel,
              }
            : null
        }
        members={initialMembers}
        oauthBanner={banner}
      />
    </AppShell>
  );
}
