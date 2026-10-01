"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/kids/state-views";
import { Picto } from "@/components/pictos";
import { buttonVariants } from "@/components/shared/button";
import { cn } from "@/lib/utils";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorProps) {
  const t = useTranslations("nav");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-bg p-6">
      <ErrorState onRetry={reset} className="w-full max-w-md" />
      <Link
        href="/"
        className={cn(buttonVariants({ variant: "secondary", size: "kid" }), "gap-3 pl-5")}
      >
        <Picto name="nav-home" size={32} />
        {t("dashboard")}
      </Link>
    </main>
  );
}
