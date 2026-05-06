"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/shared/button";

export function StepDone() {
  const t = useTranslations("setup.done");
  const router = useRouter();

  return (
    <div className="flex flex-col items-center text-center gap-8 py-8">
      <motion.div
        initial={{ scale: 0.7, rotate: -8, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="size-24 rounded-4xl bg-accent-mint flex items-center justify-center shadow-lift"
      >
        <Sparkles className="size-12 text-ink" strokeWidth={2} />
      </motion.div>

      <div className="space-y-3 max-w-xl">
        <h2 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
          {t("title")}
        </h2>
        <p className="text-muted text-lg">
          {t("description")}
        </p>
      </div>

      <Button
        size="lg"
        onClick={() => {
          router.push("/");
          router.refresh();
        }}
      >
        {t("openDashboard")}
      </Button>
    </div>
  );
}
