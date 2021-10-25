import React, { Dispatch } from "react"

export interface SimpleExerciseTask {
  id: string
  exercise_type: string
  private_spec: unknown
  order_number: number
}

export interface SimpleExerciseSlide {
  id: string
  order_number: number
}

export interface SimpleExercise {
  id: string
  name: string
}

interface PageContextState {
  exercises: SimpleExercise[]
  exerciseSlides: SimpleExerciseSlide[]
  exerciseTasks: SimpleExerciseTask[]
}

export const defaultPageContext: PageContextState = {
  exercises: [],
  exerciseSlides: [],
  exerciseTasks: [],
}

const PageContext = React.createContext<PageContextState>(defaultPageContext)

export default PageContext

interface AddExerciseAction {
  type: "addExercise"
  payload: SimpleExercise
}

interface SetExerciseAction {
  type: "setExercise"
  payload: SimpleExercise
}

interface SetExercisesAction {
  type: "setExercises"
  payload: SimpleExercise[]
}

interface AddExerciseSlideAction {
  type: "addExerciseSlide"
  payload: SimpleExerciseSlide
}

interface SetExerciseSlideAction {
  type: "setExerciseSlide"
  payload: SimpleExerciseSlide
}

interface AddExerciseTaskAction {
  type: "addExerciseTask"
  payload: SimpleExerciseTask
}

interface SetExerciseTaskAction {
  type: "setExerciseTask"
  payload: SimpleExerciseTask
}

export type PageContextAction =
  | AddExerciseAction
  | SetExerciseAction
  | SetExercisesAction
  | AddExerciseSlideAction
  | SetExerciseSlideAction
  | AddExerciseTaskAction
  | SetExerciseTaskAction

export function pageStateDispatch(
  prev: PageContextState,
  action: PageContextAction,
): PageContextState {
  switch (action.type) {
    case "addExercise": {
      return { ...prev, exercises: prev.exercises.concat(action.payload) }
    }
    case "setExercise": {
      const exercise = action.payload
      const exercises = prev.exercises.map((x) => (x.id !== exercise.id ? x : exercise))
      return { ...prev, exercises }
    }
    case "setExercises":
      return { ...prev, exercises: action.payload }
    case "addExerciseSlide": {
      return { ...prev, exerciseSlides: prev.exerciseSlides.concat(action.payload) }
    }
    case "setExerciseSlide": {
      const slide = action.payload
      const exerciseSlides = prev.exerciseSlides.map((x) => (x.id !== slide.id ? x : slide))
      return { ...prev, exerciseSlides }
    }
    case "addExerciseTask":
      return { ...prev, exerciseTasks: prev.exerciseTasks.concat(action.payload) }
    case "setExerciseTask": {
      const task = action.payload
      const exerciseTasks = prev.exerciseTasks.map((x) => (x.id !== task.id ? x : task))
      return { ...prev, exerciseTasks }
    }
  }
}

export const PageDispatch = React.createContext<Dispatch<PageContextAction>>(() => {
  throw new Error("CoursePageDispatch called outside provider.")
})
