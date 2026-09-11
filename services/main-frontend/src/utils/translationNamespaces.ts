import type { TFunction } from "i18next"

/**
 * A `t` fixed to any namespace this service loads, for helpers that both the credit-registration
 * views and the rest of the app call.
 *
 * Every namespace falls back to `main-frontend`, so the same keys resolve either way, but
 * `TFunction` is invariant in its namespace and will not take one for the other.
 */
export type ServiceTFunction = TFunction<"main-frontend" | "credit-registration">
