// The exercise-service contract: the parent↔iframe postMessage protocol types and guards, plus
// shared constants. Zero dependencies, framework-agnostic — every consumer (React, vanilla,
// backends, tests) depends on this layer.

export * from "./core"
export * from "./server/exerciseServices"
