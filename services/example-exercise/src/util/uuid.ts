/**
 * Generates an RFC 4122 version 4 UUID.
 *
 * Prefers `crypto.randomUUID`, but falls back to building the UUID from `crypto.getRandomValues`.
 * The fallback matters because the exercise iframe is served over plain HTTP from a custom hostname
 * (e.g. `http://project-331.local/...`), which is not a secure context, and `crypto.randomUUID` is
 * only defined in secure contexts (HTTPS / localhost). `crypto.getRandomValues` is available in
 * insecure contexts too, so this works everywhere the iframe runs.
 */
export function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  // Per RFC 4122 §4.4: set the version (4) and variant (10xx) bits.
  // bytes is a fixed-length Uint8Array(16), so indices 6 and 8 always exist; the
  // `?? 0` defaults only satisfy noUncheckedIndexedAccess and never trigger at runtime.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
  return (
    `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}` +
    `-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`
  )
}
