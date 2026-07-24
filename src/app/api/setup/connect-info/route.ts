import { AppError, ok, withErrorHandling } from "@/lib/api";
import { getLanBaseUrl, getMdnsBaseUrl } from "@/lib/network";
import { getOrCreateInstallation, getSetupStatus } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Everything the phone app needs to take over first-run setup: where to reach
// this board on the LAN and which installation it is (the app verifies the id
// via GET /api/mobile/identity before trusting the host). Deliberately
// unauthenticated but ONLY answers while setup is incomplete — afterwards the
// app connects via the normal pairing QR from settings.
export const GET = withErrorHandling(async () => {
  const status = await getSetupStatus();
  if (status.setupComplete) {
    throw new AppError(
      "Setup is already complete",
      "SETUP_ALREADY_COMPLETE",
      403,
    );
  }

  const installation = await getOrCreateInstallation();

  return ok({
    installationId: installation.id,
    serverUrl: getLanBaseUrl(),
    mdnsUrl: getMdnsBaseUrl(),
    appDownload: {
      // Stable vendor redirects — swap the destination (TestFlight → App Store,
      // "coming soon" → Play Store) at the website/Worker, never on devices.
      ios: "https://familyboard.ch/app/ios",
      android: "https://familyboard.ch/app/android",
    },
  });
});
