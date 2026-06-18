// Framework-agnostic browser runtime for exercise-service iframes: the parent-connection,
// height-observer, and output-state engines, the `createExerciseClient` vanilla façade, plus
// error reporting and language/cookie helpers. Depends only on the protocol layer (+ immer).
// The React adapter wraps these engines; a non-React exercise can use them directly.

export * from "./client"
export * from "./errors/reportErrorOccurrence"
export * from "./utils/constants"
export * from "./utils/cookies"
export * from "./utils/language"
