// React adapter for exercise services: hooks, contexts, components, i18n, styles, and the
// host-side `MessageChannelIFrame`. Wraps the framework-agnostic engines in `exercise-client`
// and the contract in `exercise-protocol`. Consumers import via deep
// `@/shared-module/exercise-react/...` paths; this entrypoint exists for tooling.

export { createI18n } from "./react/i18n/createI18n"
