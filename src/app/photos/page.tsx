import { AppShell } from "@/components/shell/app-shell";
import { PhotosView } from "@/components/photos/photos-view";

export const dynamic = "force-dynamic";

export default function PhotosPage() {
  return (
    <AppShell>
      <PhotosView />
    </AppShell>
  );
}
