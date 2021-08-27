import { atom, atomFamily, selector, selectorFamily } from "recoil"

import {
  ExerciseTask,
  ExerciseWithExerciseTasks,
  NormalizedCmsExercise,
  NormalizedCmsExerciseTask,
} from "../shared-module/bindings"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const exercisesAtoms = atomFamily<ExerciseWithExerciseTasks | NormalizedCmsExercise, any>({
  key: "exercises",
  default: null,
})

export const exercisesState = atom<Array<string>>({
  key: "exercises-ids",
  default: [],
})

export const exerciseFamilySelector = selectorFamily<
  ExerciseWithExerciseTasks | NormalizedCmsExercise,
  string
>({
  key: "individual-exercises-access",
  get:
    (id) =>
    ({ get }) => {
      const atom = get(exercisesAtoms(id))
      return atom
    },
  set:
    (id) =>
    ({ set, get }, exercise: ExerciseWithExerciseTasks | NormalizedCmsExercise) => {
      set(exercisesAtoms(id), exercise)
      if (!get(exercisesState).includes(id)) {
        set(exercisesState, (prev) => [...prev, id])
      }
    },
})

export const exerciseTaskFamilySelector = selectorFamily<
  ExerciseTask | NormalizedCmsExerciseTask,
  [string, string]
>({
  key: "individual-exercises-items-access",
  get:
    (id) =>
    ({ get }) => {
      const atom = get(exercisesAtoms(id[0]))
      return atom.exercise_tasks.find((task) => task.id === id[1])
    },
  set:
    (id) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ set }, exerciseTaskSpec: any) => {
      set(exercisesAtoms(id[0]), (prev) => {
        return {
          ...prev,
          exercise_tasks: prev.exercise_tasks.map((et) => {
            if (et.id !== exerciseTaskSpec.id) {
              return et
            }
            return exerciseTaskSpec
          }),
        }
      })
    },
})

export const allExercises = selector<(ExerciseWithExerciseTasks | NormalizedCmsExercise)[]>({
  key: "all-exercises",
  get: ({ get }) => {
    const ids = get(exercisesState)
    const allExercises = ids.map((id) => {
      return get(exercisesAtoms(id))
    })
    return allExercises
  },
})
