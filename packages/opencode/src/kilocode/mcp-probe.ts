export const mcpProbe = (label: string, value: unknown) => {
  const s = typeof value === "string" ? value : "";
  const countSingle = (s.match(/\\(?=")/g) ?? []).length;
  const countDouble = (s.match(/\\\\(?=")/g) ?? []).length;
  const countTriple = (s.match(/\\\\\\(?=")/g) ?? []).length;

  console.error(
    `\n[kilocode_trace:${label}] type=${typeof value} singleBsQuote=${countSingle} doubleBsQuote=${countDouble} tripleBsQuote=${countTriple} tostring=${JSON.stringify(value)}`,
  );

  try {
    if (typeof value === "object" && value !== null) {
      if (Array.isArray(value)) {
        console.error(`[kilocode_trace:${label}] ⚠️ Value is an ARRAY with ${value.length} items`);
      } else {
        // 1. Find the actual data payload (it might be nested in 'output' or 'content')
        let payload: unknown = value;

        const record = value as Record<string, unknown>;
        if ("output" in record && typeof record.output === "object" && record.output !== null) {
          payload = record.output;
        } else if ("content" in record && Array.isArray(record.content) && record.content.length > 0) {
          const textVal = (record.content[0] as { text?: unknown })?.text;
          if (typeof textVal === "string") {
            try {
              payload = JSON.parse(textVal); // Unpack the stringified JSON
            } catch (e) {
              console.error(`[kilocode_trace:${label}] Failed to parse content.text`);
            }
          }
        }

        // 2. Extract Tags and Subtasks from the resolved payload
        if (payload && typeof payload === "object") {
          const p = payload as Record<string, unknown>;

          // Extract Tags (a stringified array like "[\"tag1\"]")
          console.error(`\n[kilocode_trace:${label}] 🏷️ TAGS:`, p.tags);

          // Extract Subtasks (usually an array of objects) - defensive against missing/empty
          const subtasks = Array.isArray(p.subtasks) ? p.subtasks : [];
          console.error(`\n[kilocode_trace:${label}] 📋 SUBTASKS:`, subtasks);
          const firstSub = subtasks[0] as { title?: unknown } | undefined;
          console.error(`\n[kilocode_trace:${label}] 📋 SUBTASK[0]:`, firstSub?.title ?? undefined);
        }

        // 3. (Optional) Still print all top-level keys for context
        try {
          console.error(`\n[kilocode_trace:${label}] Top-level keys:`, Object.keys(value));
        } catch {
          /* best effort */
        }
      }
    }
  } catch (e) {
    console.error(`probe error caught: `, e);
  }
};
