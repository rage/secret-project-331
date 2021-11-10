/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import ChapterProgress from "./ChapterProgress"
import CourseChapterGrid from "./CourseChapterGrid"
import CourseObjectiveSection from "./CourseObjectiveSection"
import CourseProgress from "./CourseProgress"
import Exercise from "./Exercise"
import ExerciseInChapter from "./ExerciseInChapter"
import ExerciseSlide from "./ExerciseSlide"
import ExerciseTask from "./ExerciseTask"
import HeroSection from "./HeroSection"
import LandingPageHeroSection from "./LandingPageHeroSection"
import Latex from "./Latex"
import PagesInChapter from "./PagesInChapter"
import UnsupportedBlock from "./UnsupportedBlock"

/**
 * List of custom blocks to be passed on to Gutenberg.
 */
export const blockTypeMapForPages = [
  ["moocfi/exercise", Exercise],
  ["moocfi/exercise-task", ExerciseTask],
  ["moocfi/exercise-slide", ExerciseSlide],
  ["moocfi/course-chapter-grid", CourseChapterGrid],
  ["moocfi/pages-in-chapter", PagesInChapter],
  ["moocfi/exercises-in-chapter", ExerciseInChapter],
  ["moocfi/course-progress", CourseProgress],
  ["moocfi/chapter-progress", ChapterProgress],
  ["moocfi/unsupported-block-type", UnsupportedBlock],
  ["moocfi/latex", Latex],
  ["moocfi/hero-section", HeroSection],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as Array<[string, BlockConfiguration<Record<string, any>>]>

export const blockTypeMapForTopLevelPages = [
  ["moocfi/course-chapter-grid", CourseChapterGrid],
  ["moocfi/course-progress", CourseProgress],
  ["moocfi/unsupported-block-type", UnsupportedBlock],
  ["moocfi/latex", Latex],
  ["moocfi/landing-page-hero-section", LandingPageHeroSection],
  ["moocfi/course-objective-section", CourseObjectiveSection],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as Array<[string, BlockConfiguration<Record<string, any>>]>
