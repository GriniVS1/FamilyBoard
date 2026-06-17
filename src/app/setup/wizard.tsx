"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ProgressDots } from "@/components/setup/progress-dots";
import { StepLanguage } from "@/components/setup/step-language";
import { StepNetwork } from "@/components/setup/step-network";
import { StepWelcome } from "@/components/setup/step-welcome";
import { StepFamily } from "@/components/setup/step-family";
import { StepMembers } from "@/components/setup/step-members";
import { StepPin } from "@/components/setup/step-pin";
import { StepWeather } from "@/components/setup/step-weather";
import { StepDone } from "@/components/setup/step-done";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import type { SetupStatus, StepKey } from "@/components/setup/types";

const STEP_ORDER: StepKey[] = [
  "language",
  "network",
  "welcome",
  "family",
  "members",
  "pin",
  "weather",
  "done",
];

type WizardProps = {
  initialStatus: SetupStatus;
  initiallyConnected?: boolean;
};

function nextMissingStep(status: SetupStatus): StepKey {
  if (!status.familyCreated) return "family";
  if (status.memberCount === 0) return "members";
  if (!status.pinSet) return "pin";
  if (!status.weatherSet) return "weather";
  return "done";
}

export function Wizard({ initialStatus, initiallyConnected = false }: WizardProps) {
  // Skip the network step when the device is already connected at load time.
  // We also recheck via a client-side fetch so a server-rendered SSR snapshot
  // that was stale doesn't permanently hide the network step.
  const [networkChecked, setNetworkChecked] = useState(initiallyConnected);
  const [networkConnected, setNetworkConnected] = useState(initiallyConnected);

  useEffect(() => {
    if (initiallyConnected) return;
    fetch("/api/network/status")
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as { connected?: boolean };
        setNetworkConnected(d.connected === true);
      })
      .catch(() => {
        setNetworkConnected(false);
      })
      .finally(() => setNetworkChecked(true));
  }, [initiallyConnected]);

  // Language is always the very first step until one has been chosen, so a user
  // who doesn't read the default language isn't lost. Once chosen the page
  // reloads with localeChosen=true and we drop into the normal first step.
  const initialStep: StepKey = !initialStatus.localeChosen
    ? "language"
    : networkConnected
      ? "welcome"
      : "network";
  const [step, setStep] = useState<StepKey>(initialStep);

  // When the async network check resolves and we were already showing the
  // network step but turn out to be connected, jump past it automatically.
  useEffect(() => {
    if (networkChecked && networkConnected && step === "network") {
      setStep("welcome");
    }
  }, [networkChecked, networkConnected, step]);

  const stepIndex = STEP_ORDER.indexOf(step);
  const showProgress =
    step !== "language" &&
    step !== "welcome" &&
    step !== "done" &&
    step !== "network";
  const resumeStep = nextMissingStep(initialStatus);
  const isPartialSetup = resumeStep !== "family" && resumeStep !== "done";

  const goTo = (next: StepKey) => setStep(next);

  const content = useMemo(() => {
    switch (step) {
      case "language":
        return <StepLanguage />;
      case "network":
        return (
          <StepNetwork
            onComplete={() => goTo("welcome")}
            onSkip={() => goTo("welcome")}
          />
        );
      case "welcome":
        return (
          <StepWelcome
            onNext={() => goTo(resumeStep)}
            isResume={isPartialSetup}
            resumeStep={resumeStep}
          />
        );
      case "family":
        return (
          <StepFamily
            onComplete={() => goTo("members")}
            onBack={() => goTo("welcome")}
          />
        );
      case "members":
        return (
          <StepMembers
            onComplete={() => goTo("pin")}
            onBack={() => goTo("family")}
          />
        );
      case "pin":
        return (
          <StepPin
            onComplete={() => goTo("weather")}
            onBack={() => goTo("members")}
          />
        );
      case "weather":
        return (
          <StepWeather
            onComplete={() => goTo("done")}
            onSkip={() => goTo("done")}
            onBack={() => goTo("pin")}
          />
        );
      case "done":
        return <StepDone />;
      default:
        return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="glass sticky top-0 z-20 border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <Logo size={22} />
          <div className="flex items-center gap-3">
            {showProgress && (
              <ProgressDots total={STEP_ORDER.length - 3} current={stepIndex - 2} />
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 container py-10 sm:py-16">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {content}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
