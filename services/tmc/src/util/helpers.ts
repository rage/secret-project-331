import { RepositoryExercise } from "@/shared-module/common/bindings"

export const buildArchiveName = (exercise: RepositoryExercise, identifier?: string): string => {
  if (identifier) {
    return exercise.part + "/" + exercise.name + "-" + identifier + ".tar.zst"
  } else {
    return exercise.part + "/" + exercise.name + ".tar.zst"
  }
}
