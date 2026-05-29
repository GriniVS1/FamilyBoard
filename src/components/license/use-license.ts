"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type LicenseGate = "active" | "grace" | "soft" | "hard";

export type LicenseSnapshot = {
  status: "UNLICENSED" | "TRIAL" | "ACTIVE" | "EXPIRED";
  gate: LicenseGate;
  plan: string | null;
  validUntil: string | null;
  isActive: boolean;
  deviceId: string;
  graceEndsAt: string | null;
  softEndsAt: string | null;
};

type ActivateResponse = {
  ok: true;
  snapshot: LicenseSnapshot;
};

type ApiError = {
  error: { code: string; message: string };
};

export class LicenseActivationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "LicenseActivationError";
  }
}

async function fetchLicense(): Promise<LicenseSnapshot> {
  const res = await fetch("/api/license", { cache: "no-store" });
  if (!res.ok) throw new Error(`License fetch failed (${res.status})`);
  return (await res.json()) as LicenseSnapshot;
}

async function postActivate(key: string): Promise<ActivateResponse> {
  const res = await fetch("/api/license/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });

  if (!res.ok) {
    let code = "UNKNOWN";
    let message = `Activation failed (${res.status})`;
    try {
      const body = (await res.json()) as ApiError;
      if (body?.error?.code) code = body.error.code;
      if (body?.error?.message) message = body.error.message;
    } catch {
      // ignore parse errors
    }
    throw new LicenseActivationError(code, message);
  }

  return (await res.json()) as ActivateResponse;
}

export const LICENSE_QUERY_KEY = ["license"] as const;

export function useLicense() {
  return useQuery({
    queryKey: LICENSE_QUERY_KEY,
    queryFn: fetchLicense,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: 60 * 60 * 1000,
  });
}

export function useActivateLicense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (key: string) => postActivate(key),
    onSuccess: (data) => {
      queryClient.setQueryData(LICENSE_QUERY_KEY, data.snapshot);
      void queryClient.invalidateQueries({ queryKey: LICENSE_QUERY_KEY });
      // Clear any grace-dismiss flags so a future lapse re-shows warnings.
      try {
        const prefix = "license-grace-dismissed:";
        Object.keys(sessionStorage)
          .filter((k) => k.startsWith(prefix))
          .forEach((k) => sessionStorage.removeItem(k));
      } catch {
        // sessionStorage may be unavailable
      }
    },
  });
}
