import "server-only";
import { isResendReady } from "../mail/resend";
import { listAddresses, listDomains, sendable } from "../mail/data";
import { listTags } from "../crm/data";
import { crmStages, listTemplates } from "./data";
import { unsubscribeKey } from "./secret";

/** Everything the campaign editor needs besides the campaign itself. `blocker` says in words what stops sending on this server. */
export async function builderData(brandId: string) {
  const domains = await listDomains(brandId);
  const [all, templates, stages, tags] = await Promise.all([listAddresses(brandId, domains), listTemplates(brandId), crmStages(brandId), listTags(brandId)]);
  const from = sendable(all, domains);
  const blocker = !isResendReady()
    ? "Mail is not connected: RESEND_API_KEY is missing on the server."
    : !unsubscribeKey()
      ? "The workspace key that signs unsubscribe links (SECRETS_KEY_1) is missing on the server."
      : "";
  return {
    addresses: from.map((a) => ({ id: a.id, email: a.email, name: a.display_name ?? "" })),
    allAddresses: all,
    templates: templates.map((t) => ({ id: t.id, name: t.name })),
    stages,
    tags: tags.slice(0, 60),
    blocker,
  };
}
