"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { Input } from "@/components/shared/input";
import { cn } from "@/lib/utils";

type CaldavPresetKey = "icloud" | "fastmail" | "yahoo" | "nextcloud" | "custom";

type PresetConfig = {
  labelKey: CaldavPresetKey;
  serverUrl: string | null;
  passwordLabelAppleYahoo: boolean;
  helpUrl: string;
};

const PRESETS: Record<CaldavPresetKey, PresetConfig> = {
  icloud: {
    labelKey: "icloud",
    serverUrl: "https://caldav.icloud.com",
    passwordLabelAppleYahoo: true,
    helpUrl: "https://appleid.apple.com",
  },
  fastmail: {
    labelKey: "fastmail",
    serverUrl: "https://caldav.fastmail.com",
    passwordLabelAppleYahoo: false,
    helpUrl: "https://www.fastmail.com/settings/security/devicekeys",
  },
  yahoo: {
    labelKey: "yahoo",
    serverUrl: "https://caldav.calendar.yahoo.com",
    passwordLabelAppleYahoo: true,
    helpUrl: "https://login.yahoo.com/account/security",
  },
  nextcloud: {
    labelKey: "nextcloud",
    serverUrl: null,
    passwordLabelAppleYahoo: false,
    helpUrl: "https://nextcloud.com/install",
  },
  custom: {
    labelKey: "custom",
    serverUrl: null,
    passwordLabelAppleYahoo: false,
    helpUrl: "",
  },
};

type DiscoveredCalendar = {
  url: string;
  displayName: string;
  color?: string;
};

type ConnectResult = {
  calendars: DiscoveredCalendar[];
};

type SelectResult = {
  ok: boolean;
  synced: {
    fetched: number;
    created: number;
    updated: number;
    deleted: number;
  };
};

type Step = "credentials" | "calendar";

type CaldavConnectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  adminPin: string;
};

export function CaldavConnectDialog({
  open,
  onOpenChange,
  memberId,
  adminPin,
}: CaldavConnectDialogProps) {
  const t = useTranslations("settings.caldav");
  const tCommon = useTranslations("common");

  const [step, setStep] = useState<Step>("credentials");
  const [preset, setPreset] = useState<CaldavPresetKey>("icloud");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [calendars, setCalendars] = useState<DiscoveredCalendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] =
    useState<DiscoveredCalendar | null>(null);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [importCount, setImportCount] = useState<number | null>(null);

  const presetConfig = PRESETS[preset];
  const resolvedServerUrl = presetConfig.serverUrl ?? serverUrl;

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/members/${memberId}/connect-caldav`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Pin": adminPin },
        body: JSON.stringify({
          serverUrl: resolvedServerUrl,
          username,
          password,
          preset,
        }),
      });
      if (!res.ok) {
        let code = "";
        try {
          const data = (await res.json()) as { error?: { code?: string } };
          code = data?.error?.code ?? "";
        } catch {
          // ignore parse error
        }
        if (res.status === 401 || code === "CALDAV_AUTH_FAILED") {
          throw new Error("CALDAV_AUTH_FAILED");
        }
        if (res.status === 400 && code === "PROVIDER_CONFLICT") {
          throw new Error("PROVIDER_CONFLICT");
        }
        throw new Error("NETWORK_ERROR");
      }
      return (await res.json()) as ConnectResult;
    },
    onSuccess: (data) => {
      setCalendars(data.calendars);
      setSelectedCalendar(data.calendars[0] ?? null);
      setCredentialError(null);
      setStep("calendar");
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "NETWORK_ERROR";
      if (msg === "CALDAV_AUTH_FAILED") {
        setCredentialError(t("authFailed"));
      } else if (msg === "PROVIDER_CONFLICT") {
        setCredentialError(t("providerConflict"));
      } else {
        setCredentialError(t("networkError"));
      }
    },
  });

  const selectMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCalendar) throw new Error("NO_CALENDAR");
      const res = await fetch(
        `/api/members/${memberId}/select-caldav-calendar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Admin-Pin": adminPin },
          body: JSON.stringify({
            calendarUrl: selectedCalendar.url,
            calendarName: selectedCalendar.displayName,
          }),
        },
      );
      if (!res.ok) throw new Error("NETWORK_ERROR");
      return (await res.json()) as SelectResult;
    },
    onSuccess: (data) => {
      setImportCount(data.synced.created + data.synced.updated);
      setTimeout(() => {
        onOpenChange(false);
        resetState();
      }, 1000);
    },
    onError: () => {
      setCredentialError(t("networkError"));
    },
  });

  function resetState() {
    setStep("credentials");
    setPreset("icloud");
    setUsername("");
    setPassword("");
    setServerUrl("");
    setCalendars([]);
    setSelectedCalendar(null);
    setCredentialError(null);
    setImportCount(null);
    connectMutation.reset();
    selectMutation.reset();
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetState();
    onOpenChange(next);
  }

  const presetKeys: CaldavPresetKey[] = [
    "icloud",
    "fastmail",
    "yahoo",
    "nextcloud",
    "custom",
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {step === "credentials" ? (
              <motion.div
                key="credentials"
                initial={{ x: 0, opacity: 1 }}
                exit={{ x: "-100%", opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-5"
              >
                <div className="flex items-start justify-between gap-3 pr-10">
                  <DialogTitle>{t("step1Title")}</DialogTitle>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {t("title")}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {presetKeys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPreset(key)}
                        aria-pressed={preset === key}
                        className={cn(
                          "min-h-12 rounded-2xl border px-3 py-2 text-sm font-medium transition-colors tap-target",
                          preset === key
                            ? "border-ink bg-ink text-bg"
                            : "border-border bg-surface text-ink hover:bg-bg",
                        )}
                      >
                        {t(`presets.${key}`)}
                      </button>
                    ))}
                  </div>
                </div>

                {!presetConfig.serverUrl && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="caldav-server-url"
                      className="text-sm font-medium text-ink"
                    >
                      {t("serverUrl")}
                    </label>
                    <Input
                      id="caldav-server-url"
                      type="url"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      placeholder="https://your-server.example.com"
                      autoComplete="url"
                    />
                  </div>
                )}

                {presetConfig.serverUrl && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                      {t("serverUrl")}
                    </p>
                    <div className="rounded-2xl border border-border bg-bg/50 px-5 py-3 text-sm text-muted tabular-nums">
                      {presetConfig.serverUrl}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="caldav-username"
                    className="text-sm font-medium text-ink"
                  >
                    {t("username")}
                  </label>
                  <Input
                    id="caldav-username"
                    type="email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    inputMode="email"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="caldav-password"
                    className="text-sm font-medium text-ink"
                  >
                    {t("password")}
                  </label>
                  <Input
                    id="caldav-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <p className="text-xs text-muted">
                    {presetConfig.passwordLabelAppleYahoo
                      ? t("passwordHelpAppleYahoo")
                      : t("passwordHelpOther")}
                  </p>
                </div>

                {credentialError && (
                  <p className="text-sm text-accent-rose" role="alert">
                    {credentialError}
                  </p>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => connectMutation.mutate()}
                    disabled={
                      connectMutation.isPending ||
                      !username.trim() ||
                      !password.trim() ||
                      (!presetConfig.serverUrl && !serverUrl.trim())
                    }
                    aria-label={t("connectAria")}
                  >
                    {connectMutation.isPending && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {t("continue")}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="calendar"
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-5"
              >
                <div className="flex items-start justify-between gap-3 pr-10">
                  <DialogTitle>{t("step2Title")}</DialogTitle>
                </div>

                <p className="text-sm text-muted">{t("pickCalendar")}</p>

                <fieldset className="space-y-2">
                  <legend className="sr-only">{t("pickCalendar")}</legend>
                  {calendars.map((cal) => (
                    <label
                      key={cal.url}
                      className={cn(
                        "flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
                        selectedCalendar?.url === cal.url
                          ? "border-ink bg-ink/5"
                          : "border-border bg-surface hover:bg-bg",
                      )}
                    >
                      <input
                        type="radio"
                        name="caldav-calendar"
                        value={cal.url}
                        checked={selectedCalendar?.url === cal.url}
                        onChange={() => setSelectedCalendar(cal)}
                        className="sr-only"
                      />
                      {cal.color ? (
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: cal.color }}
                          aria-hidden
                        />
                      ) : (
                        <Circle className="size-3 shrink-0 text-muted" />
                      )}
                      <span className="text-sm font-medium text-ink">
                        {cal.displayName}
                      </span>
                      {selectedCalendar?.url === cal.url && (
                        <Check className="ml-auto size-4 text-ink" />
                      )}
                    </label>
                  ))}

                  {calendars.length === 0 && (
                    <p className="text-sm text-muted">{t("networkError")}</p>
                  )}
                </fieldset>

                {credentialError && (
                  <p className="text-sm text-accent-rose" role="alert">
                    {credentialError}
                  </p>
                )}

                {importCount !== null && (
                  <p className="text-sm text-accent-mint" role="status">
                    {t("syncedCount", { count: importCount })}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("credentials")}
                    disabled={selectMutation.isPending}
                  >
                    {tCommon("back")}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => selectMutation.mutate()}
                    disabled={!selectedCalendar || selectMutation.isPending}
                  >
                    {selectMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t("syncing")}
                      </>
                    ) : (
                      t("connect")
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
