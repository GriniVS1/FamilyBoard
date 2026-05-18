import { z } from "zod";
import { withErrorHandling, ok, AppError } from "@/lib/api";
import { connectWifi, getNetworkStatus, NetworkError } from "@/lib/network";
import { requireNetworkAccess } from "../guard";

export const runtime = "nodejs";

// SSID: 1–32 octets per 802.11; reject shell-special chars as a defence-in-depth
// measure (spawn-with-args already prevents injection, but we keep the input clean).
const SAFE_SSID = /^[^;&|`$<>\\'"!#%^*(){}[\]]{1,32}$/;

// WPA2-Personal PSK: 8–63 printable ASCII characters.
const SAFE_PSK = /^[\x20-\x7E]{8,63}$/;

const schema = z.object({
  ssid: z
    .string()
    .min(1)
    .max(32)
    .refine((v) => SAFE_SSID.test(v), {
      message: "SSID contains invalid characters",
    }),
  psk: z
    .string()
    .refine((v) => SAFE_PSK.test(v), {
      message: "PSK must be 8–63 printable ASCII characters",
    })
    .optional(),
});

export const POST = withErrorHandling(async (req) => {
  await requireNetworkAccess(req);
  const body = schema.parse(await req.json());

  try {
    await connectWifi(body.ssid, body.psk);
  } catch (err) {
    if (err instanceof NetworkError) {
      if (err.code === "TIMEOUT") {
        throw new AppError("Connection attempt timed out", "WIFI_CONNECT_FAILED", 408);
      }
      throw new AppError(err.message, "WIFI_CONNECT_FAILED", 400);
    }
    throw err;
  }

  const status = await getNetworkStatus();
  return ok({ connected: true, ssid: body.ssid, status });
});
