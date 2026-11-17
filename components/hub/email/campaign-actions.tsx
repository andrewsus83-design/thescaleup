"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Trash2 } from "lucide-react";
import { Alert, Btn } from "@/components/brand/primitives";
import { deleteCampaign, duplicateCampaign } from "@/lib/hub/email-actions";

/** Copy a campaign into a new draft, or delete it. Deleting asks first, in the page, not in a pop-up. */
export function CampaignActions({ brandId, slug, id, canDelete }: { brandId: string; slug: string; id: string; canDelete: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="space-y-3">
      {error && (
        <Alert tone="bad" role="alert">
          {error}
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Btn
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await duplicateCampaign(brandId, id);
              if (r.ok) router.push(`/hub/b/${slug}/mail/campaigns/${r.id}`);
              else setError(r.error);
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-label="Copying" /> : <Copy className="size-4" aria-hidden />}
          Make a copy
        </Btn>
        {canDelete && !asking && (
          <Btn variant="ghost" onClick={() => setAsking(true)}>
            <Trash2 className="size-4" aria-hidden />
            Delete
          </Btn>
        )}
        {canDelete && asking && (
          <span className="flex flex-wrap items-center gap-3 rounded-field bg-paper-100 px-4 py-2 text-small text-ink-800">
            Delete this campaign and its send log?
            <Btn
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteCampaign(brandId, id);
                  if (r.ok) router.push(`/hub/b/${slug}/mail/campaigns`);
                  else {
                    setError(r.error);
                    setAsking(false);
                  }
                })
              }
            >
              Yes, delete
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => setAsking(false)}>
              Keep it
            </Btn>
          </span>
        )}
      </div>
    </div>
  );
}
