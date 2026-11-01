import { Suspense } from "react";
import { EmbedPanel } from "@/components/embed-panel";

export default function EmbedPage() {
  return (
    <Suspense>
      <EmbedPanel />
    </Suspense>
  );
}
