// Payment gateways, without naming any one of them: what a payment to review looks like, which stretch of time a read covers, and
// how a payment is matched to an invoice. Pure: no I/O and no secrets, so the browser can import it and the rules are easy to test.
//
// A gateway is added in three places: a line in GATEWAYS here, its key in providers.ts, and its reader in payments/read.ts (plus
// its name in the database's list of allowed sources). Everything else (the waiting list, matching, recording) is shared.

/** A payment as Finance keeps it. Nothing about the payer: no name, no account number. */
export type Incoming = {
  externalId: string;
  occurredAt: string;
  day: string;
  amount: number;
  fee: number;
  currency: string;
  channel: string;
  reference: string;
};

// ---------------------------------------------------------------------------------------------- the gateways
export type GatewayId = "xendit";
export type Gateway = {
  id: GatewayId;
  label: string;
  /** The key in providers.ts that connects it. */
  keyProvider: string;
  /** A saved key that starts with this is for the gateway's test mode: its payments are not real money. */
  testKeyPrefix: string | null;
};

export const GATEWAYS: readonly Gateway[] = [{ id: "xendit", label: "Xendit", keyProvider: "xendit", testKeyPrefix: "xnd_development_" }];

export const gatewayOf = (id: unknown): Gateway | null => GATEWAYS.find((g) => g.id === id) ?? null;
/** The name to show for a stored payment's source. A source this build does not know still gets a sensible word. */
export const gatewayLabel = (source: string): string => gatewayOf(source)?.label ?? "Payment gateway";
export const isTestKeyOf = (g: Gateway, key: string): boolean => g.testKeyPrefix !== null && key.startsWith(g.testKeyPrefix);

// ---------------------------------------------------------------------------------------------- reading
/** What one read of a gateway gives back. A failure part-way still carries what was read before it. */
export type Fetched =
  | { ok: true; payments: Incoming[]; seen: number; finished: boolean; oldest: string | null }
  | { ok: false; reason: FetchProblem; payments: Incoming[]; oldest: string | null };
export type FetchProblem = "key" | "permission" | "busy" | "unreachable" | "shape";

/** Why a read failed, in words, for the gateway it was. */
export function fetchProblem(reason: FetchProblem, gateway: string): string {
  if (reason === "key") return `${gateway} did not accept the saved key. Copy it again from ${gateway} and save it in Settings, Payment gateways.`;
  if (reason === "permission") return `The saved ${gateway} key is not allowed to read payments. Give the key read access in ${gateway}, or make a new key that has it. The guide in Settings, Payment gateways shows how.`;
  if (reason === "busy") return `${gateway} is limiting requests right now. Try again in a minute.`;
  if (reason === "unreachable") return `Could not reach ${gateway}. Try again in a moment.`;
  return `${gateway} answered in a way this page does not understand. Nothing was changed. Tell the agency.`;
}

/** How far back the first read looks, and how much every later read looks back again (a payment can be confirmed late). */
export const FIRST_WINDOW_DAYS = 31;
export const OVERLAP_HOURS = 72;

export type SyncState = { lastSyncedAt: string | null; pendingUntil: string | null; pendingStarted: string | null };
export type Window = { since: string; until: string; started: string };

/**
 * The stretch of time one press reads. A first read goes back 31 days. A later one starts 72 hours before the last finished read,
 * because a gateway can confirm a payment late (the same payment is never stored twice). A read that stopped at its page limit
 * carries on from where it stopped: gateways list newest first, so "where it stopped" is the oldest payment it reached.
 */
export function syncWindow(state: SyncState, now: Date): Window {
  const since = state.lastSyncedAt ? new Date(new Date(state.lastSyncedAt).getTime() - OVERLAP_HOURS * 3_600_000) : new Date(now.getTime() - FIRST_WINDOW_DAYS * 86_400_000);
  if (state.pendingUntil && state.pendingStarted) return { since: since.toISOString(), until: state.pendingUntil, started: state.pendingStarted };
  return { since: since.toISOString(), until: now.toISOString(), started: now.toISOString() };
}

/** What to remember after a press. Finished: the read is complete up to when it started. Not finished: carry on from the oldest payment reached. */
export function nextState(state: SyncState, w: Window, finished: boolean, oldestReached: string | null): SyncState {
  if (finished) return { lastSyncedAt: w.started, pendingUntil: null, pendingStarted: null };
  // Nothing readable came back, so there is no place to carry on from: leave things as they were and let the next press try again.
  if (!oldestReached) return state;
  return { lastSyncedAt: state.lastSyncedAt, pendingUntil: oldestReached, pendingStarted: w.started };
}

// ---------------------------------------------------------------------------------------------- matching a payment to an invoice
export type OpenInvoice = { id: string; number: string; client: string; amount: number };
export type Match = { invoice: OpenInvoice; sure: boolean };

/**
 * Unpaid invoices this payment could be for: the same amount, to the cent. `sure` is true only when the payment's own reference also
 * names the invoice number. An amount alone is never proof (two clients can owe the same), so a person always confirms.
 */
export function matchesFor(p: Pick<Incoming, "amount" | "reference">, invoices: readonly OpenInvoice[]): Match[] {
  const ref = p.reference.toLowerCase();
  return invoices
    .filter((i) => i.amount === p.amount)
    .map((invoice) => ({ invoice, sure: ref !== "" && invoice.number.trim() !== "" && ref.includes(invoice.number.trim().toLowerCase()) }))
    .sort((a, b) => Number(b.sure) - Number(a.sure) || a.invoice.number.localeCompare(b.invoice.number));
}

export const FEE_CATEGORY = "Payment fees";
export const DEFAULT_CATEGORY = "Sales";
