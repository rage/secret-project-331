import { BlockConfiguration } from "@wordpress/blocks"

import ChapterProgress from "./ChapterProgress"
import CourseChapterGrid from "./CourseChapterGrid"
import CourseObjectiveSection from "./CourseObjectiveSection"
import CourseProgress from "./CourseProgress"
import Exercise from "./Exercise"
import ExerciseInChapter from "./ExerciseInChapter"
import ExerciseTask from "./ExerciseTask"
import HeroSection from "./HeroSection"
import LandingPageHeroSection from "./LandingPageHeroSection"
import Latex from "./Latex"
import PagesInChapter from "./PagesInChapter"

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
  ["moocfi/latex", Latex],
  ["moocfi/hero-section", HeroSection],
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const blockTypeMapForTopLevelPages: Array<[string, BlockConfiguration<any>]> = [
  ["moocfi/course-chapter-grid", CourseChapterGrid],
  ["moocfi/course-progress", CourseProgress],
  ["moocfi/latex", Latex],
  ["moocfi/landing-page-hero-section", LandingPageHeroSection],
  ["moocfi/course-objective-section", CourseObjectiveSection],
]
