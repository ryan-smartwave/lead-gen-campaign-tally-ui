import { serviceReachable } from "./scraperClient";

/**
 * Can THIS instance drive the scraper?
 *
 * Answered by observation rather than configuration: the scraper service only
 * exists on the machine with a signed-in Chrome and the mcp-chrome bridge, so
 * "is the service reachable" is the same question as "can this device scrape".
 * That removes a flag that could be set wrongly — the hosted copy simply cannot
 * reach it, and says so honestly.
 *
 * Server-only, so the hosted UI never flashes a Run button it cannot honour.
 */
export async function canRunScrapes(): Promise<boolean> {
  return serviceReachable();
}
