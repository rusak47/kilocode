---
"@kilocode/cli": patch
---

Retry on prompt-only empty streams when providers consume input tokens but produce no output. Tracks `outputTokens` separately from usage so poisoned responses (e.g. `finish_reason: "network_error"` with `completion_tokens: 0`) fall through the bounded retry budget instead of settling silently. Also widens transient provider error phrasing matched for retry and promotes bare prose errors into retryable `APIError` instead of `UnknownError`.
