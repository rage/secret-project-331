import { atom, atomFamily, selectorFamily } from 'recoil'
import { ExerciseWithExerciseItems, PageUpdateExercise } from '../services/services.types'

export const exercisesAtoms = atomFamily<ExerciseWithExerciseItems | PageUpdateExercise, any>({
  key: 'exercises',
  default: null,
})

export const exercisesState = atom<Array<string>>({
  key: 'exercisesIds',
  default: [],
})

export const exerciseFamilySelector = selectorFamily<
  ExerciseWithExerciseItems | PageUpdateExercise,
  string
>({
  key: 'exercises-access',
  get: (id) => ({ get }) => {
    const atom = get(exercisesAtoms(id))
    return atom
  },
  set: (id) => ({ set }, exercise: any) => {
    set(exercisesAtoms(id), exercise)
    set(exercisesState, (prev) => [...prev, id])
  },
})
