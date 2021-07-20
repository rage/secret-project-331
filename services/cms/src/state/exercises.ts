import { atom, atomFamily, selector, selectorFamily } from "recoil"

import {
  ExerciseTask,
  ExerciseWithExerciseTasks,
  PageUpdateExercise,
  PageUpdateExerciseTask,
} from "../shared-module/bindings"

export const exercisesAtoms = atomFamily<
  ExerciseWithExerciseTasks | PageUpdateExercise | null,
  any
>({
  key: "exercises",
  default: null,
})

export const exercisesState = atom<Array<string>>({
  key: "exercises-ids",
  default: [],
})

export const exerciseFamilySelector = selectorFamily<
  ExerciseWithExerciseTasks | PageUpdateExercise | null,
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
    ({ set, get }, exercise) => {
      set(exercisesAtoms(id), exercise)
      if (!get(exercisesState).includes(id)) {
        set(exercisesState, (prev) => [...prev, id])
      }
    },
})

export const exerciseTaskFamilySelector = selectorFamily<
  ExerciseTask | PageUpdateExerciseTask | null,
  [string, string]
>({
  key: "individual-exercises-items-access",
  get:
    (id) =>
    ({ get }) => {
      const atom = get(exercisesAtoms(id[0]))
      const result = atom?.exercise_tasks.find((task) => task.id === id[1])
      return result ?? null
    },
  set:
    (id) =>
    ({ set }, exerciseTaskSpec) => {
      // @ts-ignore: TODO...
      set(exercisesAtoms(id[0]), (prev) => {
        return {
          ...prev,
          exercise_tasks: prev?.exercise_tasks.map((et) => {
            // @ts-ignore: TODO...
            if (et.id !== exerciseTaskSpec.id) {
              return et
            }
            return exerciseTaskSpec
          }),
        }
      })
    },
})

export const allExercises = selector<(ExerciseWithExerciseTasks | PageUpdateExercise | null)[]>({
  key: "all-exercises",
  get: ({ get }) => {
    const ids = get(exercisesState)
    const allExercises = ids.map((id) => {
      return get(exercisesAtoms(id))
    })
    return allExercises
  },
})
