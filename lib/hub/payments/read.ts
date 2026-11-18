import "server-only";
import { listPayments as xendit } from "../xendit/api";
import type { Fetched, GatewayId } from "./model";

// One door to every gateway's reader. Each reader only READS payments, with the brand's own key, and gives back the same shape.
const READERS: Record<GatewayId, (key: string, since: string, until: string, tz: string) => Promise<Fetched>> = { xendit };

/** Successful payments the brand received between `since` and `until`, from the gateway named. */
export const readPayments = (gateway: GatewayId, key: string, since: string, until: string, tz: string): Promise<Fetched> => READERS[gateway](key, since, until, tz);
