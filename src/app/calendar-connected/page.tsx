import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/shared/logo";

export const dynamic = "force-dynamic";

type CalendarConnectedPageProps = {
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

export default async function CalendarConnectedPage({ searchParams }: CalendarConnectedPageProps) {
  const params = (await searchParams) ?? {};
  const providerParam = pickString(params, "provider");
  const statusParam = pickString(params, "status");
  const reasonParam = pickString(params, "reason");
  const t = await getTranslations("calendarConnected");

  const providerLabel =
    providerParam === "google" ? t("google") : providerParam === "microsoft" ? t("microsoft") : null;

  const isError = statusParam === "error";

  return (
    <div className="min-h-dvh bg-bg text-ink font-sans flex items-center justify-center px-4 py-10">
      <div className="card-soft w-full max-w-sm flex flex-col items-center gap-6 p-8 text-center">
        <Logo size={22} />

        {isError ? (
          <div className="size-16 rounded-full bg-accent-rose/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="size-9 text-accent-rose" aria-hidden />
          </div>
        ) : (
          <div className="size-16 rounded-full bg-accent-mint/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="size-9 text-accent-mint" aria-hidden />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold leading-tight">{isError ? t("errorTitle") : t("title")}</h1>
          <p className="text-muted leading-relaxed">
            {isError
              ? providerLabel
                ? t("errorBodyWithProvider", { provider: providerLabel })
                : t("errorBodyGeneric")
              : providerLabel
                ? t("bodyWithProvider", { provider: providerLabel })
                : t("bodyGeneric")}
          </p>
        </div>

        <p className="text-sm text-muted leading-relaxed">
          {isError ? t("errorInstructions") : t("instructions")}
        </p>

        {isError && reasonParam && (
          <p className="text-xs text-muted/70">{t("reasonLabel", { reason: reasonParam })}</p>
        )}
      </div>
    </div>
  );
}
