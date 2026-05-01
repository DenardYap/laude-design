import { ShieldAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ApiKeyWarningBanner() {
  return (
    <Alert variant="warning">
      <ShieldAlert />
      <AlertTitle>Always use a dedicated API key</AlertTitle>
      <AlertDescription>
        Create a separate API key for this app from each provider's dashboard. Never reuse a
        production key, never share it with anyone, and revoke it immediately if you suspect a
        leak. Keys are encrypted at rest with AES-256-GCM and never displayed in full.
      </AlertDescription>
    </Alert>
  );
}
