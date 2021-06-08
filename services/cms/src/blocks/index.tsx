import { BlockConfiguration } from "@wordpress/blocks"
import CourseGrid from "./CourseGrid"
import ChapterProgress from "./ChapterProgress"
import CourseProgress from "./CourseProgress"
import Exercise from "./Exercise"
import ExerciseInChapter from "./ExerciseInChapter"
import ExerciseItem from "./ExerciseItem"
import PagesInChapter from "./PagesInChapter"

export const blockTypeMap: Array<[string, BlockConfiguration]> = [
  ["moocfi/exercise", Exercise],
  ["moocfi/exercise-item", ExerciseItem],
  ["moocfi/course-grid", CourseGrid],
  ["moocfi/pages-in-chapter", PagesInChapter],
  ["moocfi/exercises-in-chapter", ExerciseInChapter],
  ["moocfi/course-progress", CourseProgress],
  ["moocfi/chapter-progress", ChapterProgress],
]
