import { createContext } from "react"

import { ExerciseAttributes } from "../blocks/Exercise"

interface ExerciseBlockContextType {
  setAttributes: (attributes: Partial<ExerciseAttributes>) => void
  attributes: ExerciseAttributes | null
}

/** Used only with the Exercise block so that the components inside it can update the exercise's attributes. */
const ExerciseBlockContext = createContext<ExerciseBlockContextType>({
  setAttributes: function (_attributes): void {
    throw new Error("Function not implemented.")
  },
  attributes: null,
})

export default ExerciseBlockContext
