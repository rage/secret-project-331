import { BlockConfiguration } from "@wordpress/blocks"
import CourseGrid from "./CourseGrid"
import CourseProgress from "./CourseProgress"
import Exercise from "./Exercise"
import ExerciseInPart from "./ExerciseInPart"
import ExerciseItem from "./ExerciseItem"
import PagesInPart from "./PagesInPart"

export const blockTypeMap: Array<[string, BlockConfiguration]> = [
  ["moocfi/exercise", Exercise],
  ["moocfi/exercise-item", ExerciseItem],
  ["moocfi/course-grid", CourseGrid],
  ["moocfi/pages-in-part", PagesInPart],
  ["moocfi/exercises-in-part", ExerciseInPart],
  ["moocfi/course-progress", CourseProgress],
]
