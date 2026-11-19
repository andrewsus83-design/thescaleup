"use client";

import { useEffect } from "react";
import { Alert, Btn, Card } from "@/components/brand/primitives";
import { CONNECT_CHANNEL, platformLabel, type ConnectOutcome } from "@/lib/hub/zernio/model";

/**
 * The pop-up's last page. It tells the page that opened it how the connection went (by a channel any same-site page can hear, and by
 * the opener when the platform kept it), then closes itself. Only text we wrote is shown: nothing from the address is printed raw.
 */
export function ConnectDone({ outcome }: { outcome: ConnectOutcome }) {
  useEffect(() => {
    const note = { type: CONNECT_CHANNEL, ...outcome };
    try {
      const channel = new BroadcastChannel(CONNECT_CHANNEL);
      channel.postMessage(note);
      channel.close();
    } catch {
      /* an older browser: the opener message below still works when the platform kept it */
    }
    try {
      window.opener?.postMessage(note, window.location.origin);
    } catch {
      /* the opener may be gone */
    }
    const t = window.setTimeout(() => window.close(), outcome.ok ? 1200 : 6000);
    return () => window.clearTimeout(t);
  }, [outcome]);

  const what = outcome.platform ? platformLabel(outcome.platform) : "The account";
  return (
    <main className="mx-auto flex min-h-full max-w-md items-center px-4 py-10">
      <Card className="w-full space-y-4 text-center">
        {outcome.ok ? (
          <>
            <h1 className="font-title text-h3 text-ink-800">{what} is connected</h1>
            <p className="text-body text-ink-600">{outcome.username ? `${outcome.username} is now linked to this brand.` : "It is now linked to this brand."} This window closes by itself.</p>
          </>
        ) : (
          <>
            <h1 className="font-title text-h3 text-ink-800">{what} was not connected</h1>
            <Alert tone="bad" role="alert">
              {outcome.message}
            </Alert>
          </>
        )}
        <Btn type="button" variant="secondary" size="md" onClick={() => window.close()}>
          Close this window
        </Btn>
      </Card>
    </main>
  );
}
