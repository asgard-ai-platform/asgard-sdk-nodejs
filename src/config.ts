export interface BotProviderConfig {
  /** EdgeServer base URL, e.g. https://edge.example.com */
  edgeServerHost: string;
  namespace: string;
  botProviderName: string;
  botProviderApiKey: string;
  /** Additional headers forwarded on every request */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: 300_000) */
  timeoutMs?: number;
}

export interface MessageRequestOptions {
  /** Append ?is_debug=true to the request URL */
  isDebug?: boolean;
  /** Forwarded as X-ASGARD-USER-IDENTITY-HINT header (max 128 chars) */
  userIdentityHint?: string;
  /**
   * When true, treats every tool call in this single request as already consented.
   * The server skips the consent gate (no asgard.tool_call.consent event, no pause)
   * for this run only — the persistent tool_call_allow_list is not modified.
   * Only honored by the SSE endpoint (newStreamer); sendMessage ignores it server-side.
   */
  bypassToolCallConsent?: boolean;
}
