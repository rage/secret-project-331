// Host-side SDK for embedding exercise-service iframes: the parent app renders MessageChannelIFrame,
// which owns the sandboxed <iframe>, the MessagePort handshake, and the set-state/set-language
// protocol. Split out of exercise-react so exercise *services* (which are the iframe child, not the
// host) don't vendor host-only code. Consumers import via the deep path
// `@/shared-module/exercise-iframe-host/MessageChannelIFrame`; this entrypoint exists for tooling.
export { default as MessageChannelIFrame } from "./MessageChannelIFrame"
export type { ExerciseDialogApi } from "./MessageChannelIFrame"
