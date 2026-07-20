// Framework-agnostic browser runtime for exercise-service iframes.
//
// These engines contain the DOM + protocol logic shared by every framework adapter. The React
// hooks/components wrap them; a vanilla-JS exercise can use `createExerciseClient` directly.

export * from "./parentConnection"
export * from "./heightObserver"
export * from "./outputState"
export * from "./createExerciseClient"
export * from "./parentDialog"
