import { BlockConfiguration } from "@wordpress/blocks"

import ChapterProgress from "./ChapterProgress"
import CourseChapterGrid from "./CourseChapterGrid"
import CourseProgress from "./CourseProgress"
import Exercise from "./Exercise"
import ExerciseInChapter from "./ExerciseInChapter"
import ExerciseTask from "./ExerciseTask"
import Latex from "./Latex"
import PagesInChapter from "./PagesInChapter"
import UnsupportedBlock from "./UnsupportedBlock"

/**
 * List of custom blocks to be passed on to Gutenberg.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const blockTypeMapForPages: Array<[string, BlockConfiguration<any>]> = [
  ["moocfi/exercise", Exercise],
  ["moocfi/exercise-task", ExerciseTask],
  ["moocfi/course-chapter-grid", CourseChapterGrid],
  ["moocfi/pages-in-chapter", PagesInChapter],
  ["moocfi/exercises-in-chapter", ExerciseInChapter],
  ["moocfi/course-progress", CourseProgress],
  ["moocfi/chapter-progress", ChapterProgress],
  ["moocfi/unsupported-block-type", UnsupportedBlock],
  ["moocfi/latex", Latex],
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const blockTypeMapForTopLevelPages: Array<[string, BlockConfiguration<any>]> = [
  ["moocfi/course-chapter-grid", CourseChapterGrid],
  ["moocfi/course-progress", CourseProgress],
  ["moocfi/unsupported-block-type", UnsupportedBlock],
  ["moocfi/latex", Latex],
]
