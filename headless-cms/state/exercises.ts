import { atom, atomFamily, selectorFamily } from 'recoil'

export const exercisesAtoms = atomFamily({
  key: 'exercises',
  default: {},
})

// Do we need to keep ID's
export const exercisesState = atom({
  key: 'exercisesIds',
  default: [],
})

export const exerciseFamilySelector = selectorFamily({
  key: 'exercises-access',
  get: (id) => ({ get }) => {
    const atom = get(exercisesAtoms(id))
    return atom
  },
  set: (id) => ({ set }, exercise: any) => {
    if (!exercise) {
      return
    }
    set(exercisesAtoms(id), exercise)
    set(exercisesState, (prev) => [...prev, exercise.id])
  },
})
