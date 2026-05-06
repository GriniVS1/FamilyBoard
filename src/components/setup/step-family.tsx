"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { postJson } from "./types";

type StepFamilyProps = {
  initialName?: string;
  onComplete: (name: string) => void;
  onBack: () => void;
};

type FamilyResponse = { id: string; name: string };

export function StepFamily({ initialName = "", onComplete, onBack }: StepFamilyProps) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a family name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const family = await postJson<FamilyResponse>("/api/setup/family", {
        name: trimmed,
      });
      onComplete(family.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      <div className="space-y-3">
        <p className="text-muted text-sm font-medium tracking-wide uppercase">
          Step 1
        </p>
        <h2 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
          Name your family
        </h2>
        <p className="text-muted text-lg">
          Used in greetings around the dashboard.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="family-name" className="sr-only">
          Family name
        </label>
        <Input
          id="family-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="The Smith Family"
          autoFocus
          maxLength={60}
        />
        {error && (
          <p className="text-sm text-accent-rose pl-2" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="flex justify-between gap-3">
        <Button type="button" variant="ghost" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Saving…" : "Continue"}
        </Button>
      </div>
    </form>
  );
}
