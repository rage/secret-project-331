// The exercise-service protocol types are owned by @moocfi/exercise-protocol. This re-export keeps
// the historical `common/exerciseServiceTypes` import path working without a second declaration
// that can drift; the specifier resolves both here and in every vendored shared-module copy.
export type * from "@/shared-module/exercise-protocol/core/exerciseServiceTypes"
