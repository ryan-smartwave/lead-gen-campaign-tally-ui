/**
 * Can THIS instance drive the scraper?
 *
 * Running a scrape needs mcp-chrome on localhost:12306 talking to a real
 * signed-in Chrome, which only exists on the operator's own machine. The
 * hosted instance is therefore read-only by nature, not by configuration.
 *
 * Server-only, on purpose: the answer is baked into server-rendered payloads
 * so the hosted UI never flashes a Run button it cannot honour.
 */
export function isScraperHost(): boolean {
  return process.env.SCRAPER_ENABLED === "1";
}

/** Where the scraper's MCP bridge listens; overridable for an unusual setup. */
export function mcpEndpoint(): string {
  return process.env.MCP_ENDPOINT ?? "http://127.0.0.1:12306/mcp";
}
