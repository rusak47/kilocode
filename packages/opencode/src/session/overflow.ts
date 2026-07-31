import type { Config } from "@/config/config"
import { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import type { Provider } from "@/provider/provider"
import { ProviderTransform } from "@/provider/transform"
import type { MessageV2 } from "./message-v2"
import { KiloSessionOverflow } from "@/kilocode/session/overflow" // kilocode_change
import * as Log from "@opencode-ai/core/util/log" // kilocode_change

const COMPACTION_BUFFER = 20_000
const MIN_INPUT_RATIO = 0.1 // kilocode_change
const log = Log.create({ service: "kilocode.session.overflow" }) // kilocode_change

export function usable(input: { cfg: ConfigV1.Info; model: Provider.Model; outputTokenMax?: number }) { // kilocode_change start - sane limits, caps, and diagnostics for unusable/tiny model limits
  const context = input.model.limit.context
  if (context === 0) return 0

  const maxOutput = ProviderTransform.maxOutputTokens(input.model, input.outputTokenMax)
  const inputLimit = input.model.limit.input
  const effectiveInput = inputLimit && inputLimit >= context * MIN_INPUT_RATIO ? inputLimit : context

  if (!inputLimit) {
    return Math.max(0, effectiveInput - maxOutput)
  }

  const reserved =
    input.cfg.compaction?.reserved ??
    Math.min(COMPACTION_BUFFER, maxOutput)
  const cappedReserved = Math.min(reserved, Math.max(0, effectiveInput) / 2)
  const result = Math.max(0, effectiveInput - cappedReserved)
  if (effectiveInput !== inputLimit) {
    log.debug("usable input override", {
      model: input.model.id,
      provider: input.model.providerID,
      context,
      inputLimit,
      effectiveInput,
      maxOutput,
      reserved,
      cappedReserved,
      result,
    })
  }
  return result
} // kilocode_change end

export function isOverflow(input: {
  cfg: ConfigV1.Info
  tokens: SessionV1.Assistant["tokens"]
  model: Provider.Model
  outputTokenMax?: number
}) {
  if (input.cfg.compaction?.auto === false) return false
  if (input.model.limit.context === 0) return false

  const count = KiloSessionOverflow.count(input.tokens) // kilocode_change
  // kilocode_change start - post-step checks are safety-only; economic thresholds run in preflight
  return count >= usable(input)
  // kilocode_change end
}
