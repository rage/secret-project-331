import { BlockConfiguration } from "@wordpress/blocks"

import ChapterProgress from "./ChapterProgress"
import CourseChapterGrid from "./CourseChapterGrid"
import CourseProgress from "./CourseProgress"
import Exercise from "./Exercise"
import ExerciseInChapter from "./ExerciseInChapter"
import ExerciseTask from "./ExerciseTask"
import PagesInChapter from "./PagesInChapter"

export const blockTypeMap: Array<[string, BlockConfiguration]> = [
  // @ts-ignore: Guternberg types (╯°□°）╯︵ ┻━┻
  ["moocfi/exercise", Exercise],
  // @ts-ignore: Guternberg types (╯°□°）╯︵ ┻━┻
  ["moocfi/exercise-task", ExerciseTask],
  ["moocfi/course-chapter-grid", CourseChapterGrid],
  ["moocfi/pages-in-chapter", PagesInChapter],
  ["moocfi/exercises-in-chapter", ExerciseInChapter],
  ["moocfi/course-progress", CourseProgress],
  ["moocfi/chapter-progress", ChapterProgress],
]
