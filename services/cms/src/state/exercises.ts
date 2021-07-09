import { atom, atomFamily, selector, selectorFamily } from "recoil"

import {
  ExerciseTask,
  ExerciseWithExerciseTasks,
  PageUpdateExercise,
  PageUpdateExerciseTask,
} from "../services/services.types"

export const exercisesAtoms = atomFamily<ExerciseWithExerciseTasks | PageUpdateExercise, any>({
  key: "exercises",
  default: null,
})

export const exercisesState = atom<Array<string>>({
  key: "exercises-ids",
  default: [],
})

export const exerciseFamilySelector = selectorFamily<
  ExerciseWithExerciseTasks | PageUpdateExercise,
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
    ({ set, get }, exercise: ExerciseWithExerciseTasks | PageUpdateExercise) => {
      set(exercisesAtoms(id), exercise)
      if (!get(exercisesState).includes(id)) {
        set(exercisesState, (prev) => [...prev, id])
      }
    },
})

export const exerciseTaskFamilySelector = selectorFamily<
  ExerciseTask | PageUpdateExerciseTask,
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

export const allExercises = selector<ExerciseWithExerciseTasks[] | PageUpdateExercise[]>({
  key: "all-exercises",
  get: ({ get }) => {
    const ids = get(exercisesState)
    const allExercises = ids.map((id) => {
      return get(exercisesAtoms(id))
    })
    return allExercises
  },
})
