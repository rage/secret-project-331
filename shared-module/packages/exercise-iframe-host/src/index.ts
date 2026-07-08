// Host-side SDK for embedding exercise-service iframes: the parent renders MessageChannelIFrame,
// which owns the sandboxed <iframe>, the MessagePort handshake, and the set-state/set-language
// protocol. Split out of exercise-react so exercise services (the iframe child) don't vendor
// host-only code. Consumers import the deep path; this entrypoint exists for tooling.
export { default as MessageChannelIFrame } from "./MessageChannelIFrame"
export type { ExerciseDialogApi } from "./MessageChannelIFrame"
