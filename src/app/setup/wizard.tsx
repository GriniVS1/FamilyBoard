"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ProgressDots } from "@/components/setup/progress-dots";
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
  "welcome",
  "family",
  "members",
  "pin",
  "weather",
  "done",
];

type WizardProps = {
  initialStatus: SetupStatus;
};

function nextMissingStep(status: SetupStatus): StepKey {
  if (!status.familyCreated) return "family";
  if (status.memberCount === 0) return "members";
  if (!status.pinSet) return "pin";
  if (!status.weatherSet) return "weather";
  return "done";
}

export function Wizard({ initialStatus }: WizardProps) {
  // Always start at the welcome screen so the wizard never drops the user into
  // a step they don't have context for. From welcome we route to whatever step
  // the persisted state implies — a fresh install jumps to "family", a partial
  // setup resumes wherever it left off.
  const [step, setStep] = useState<StepKey>("welcome");

  const stepIndex = STEP_ORDER.indexOf(step);
  const showProgress = step !== "welcome" && step !== "done";
  const resumeStep = nextMissingStep(initialStatus);
  const isPartialSetup =
    resumeStep !== "family" && resumeStep !== "done";

  const goTo = (next: StepKey) => setStep(next);

  const content = useMemo(() => {
    switch (step) {
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
  }, [step]);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="glass sticky top-0 z-20 border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <Logo size={22} />
          <div className="flex items-center gap-3">
            {showProgress && (
              <ProgressDots total={STEP_ORDER.length - 1} current={stepIndex} />
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
