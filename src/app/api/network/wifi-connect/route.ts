import { z } from "zod";
import { withErrorHandling, ok, AppError } from "@/lib/api";
import { connectWifi, getNetworkStatus, stopHotspot, sleep, NetworkError } from "@/lib/network";
import { requireNetworkAccess } from "../guard";

export const runtime = "nodejs";

// SSID: 1–32 octets per 802.11. We only reject control characters; every other
// printable character is legal in an SSID — including "!", "#", "(", ")", spaces
// and accented letters (e.g. "FRITZ!Box 7590", "Müller-WLAN"). spawn-with-args
// already prevents shell injection, so the previous strict allowlist wrongly
// rejected very common router SSIDs and silently failed the connect.
const SAFE_SSID = /^[^\x00-\x1F\x7F]{1,32}$/;

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
  viaHotspot: z.boolean().optional(),
});

export const POST = withErrorHandling(async (req) => {
  await requireNetworkAccess(req);
  const body = schema.parse(await req.json());

  if (body.viaHotspot === true) {
    // The phone is connected via the hotspot. Tearing down the AP will disconnect
    // the phone mid-flight, so we ACK immediately and do the real work in the
    // background after a grace delay that lets the response reach the phone.
    const { ssid, psk } = body;
    void (async () => {
      await sleep(1500);
      try {
        await stopHotspot();
      } catch (e) {
        console.error("[network] phone-setup: stopHotspot failed", e);
      }
      try {
        await connectWifi(ssid, psk);
      } catch (e) {
        // NetworkError messages are PSK-sanitized; safe to log.
        console.error("[network] phone-setup: background connect failed", e);
      }
    })();
    return ok({ accepted: true });
  }

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
