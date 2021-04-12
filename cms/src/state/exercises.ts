import { atom, atomFamily, selector, selectorFamily } from 'recoil'
import {
  ExerciseItem,
  ExerciseWithExerciseItems,
  PageUpdateExercise,
  PageUpdateExerciseItem,
} from '../services/services.types'

export const exercisesAtoms = atomFamily<ExerciseWithExerciseItems | PageUpdateExercise, any>({
  key: 'exercises',
  default: null,
})

export const exercisesState = atom<Array<string>>({
  key: 'exercises-ids',
  default: [],
})

export const exerciseFamilySelector = selectorFamily<
  ExerciseWithExerciseItems | PageUpdateExercise,
  string
>({
  key: 'individual-exercises-access',
  get: (id) => ({ get }) => {
    const atom = get(exercisesAtoms(id))
    return atom
  },
  set: (id) => ({ set, get }, exercise: ExerciseWithExerciseItems | PageUpdateExercise) => {
    set(exercisesAtoms(id), exercise)
    if (!get(exercisesState).includes(id)) {
      set(exercisesState, (prev) => [...prev, id])
    }
  },
})

export const exerciseItemFamilySelector = selectorFamily<
  ExerciseItem | PageUpdateExerciseItem,
  [string, string]
>({
  key: 'individual-exercises-items-access',
  get: (id) => ({ get }) => {
    const atom = get(exercisesAtoms(id[0]))
    return atom.exercise_items.find((item) => item.id === id[1])
  },
  set: (id) => ({ set }, exerciseItemSpec: any) => {
    set(exercisesAtoms(id[0]), (prev) => {
      return {
        ...prev,
        exercise_items: prev.exercise_items.map((ei) => {
          if (ei.id !== exerciseItemSpec.id) {
            return ei
          }
          return exerciseItemSpec
        }),
      }
    })
  },
})

export const allExercises = selector<ExerciseWithExerciseItems[] | PageUpdateExercise[]>({
  key: 'all-exercises',
  get: ({ get }) => {
    const ids = get(exercisesState)
    const allExercises = ids.map((id) => {
      return get(exercisesAtoms(id))
    })
    return allExercises
  },
})
