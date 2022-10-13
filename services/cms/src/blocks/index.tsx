/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import Aside from "./Aside"
import ChapterProgress from "./ChapterProgress"
import Congratulations from "./Congratulations"
import CourseChapterGrid from "./CourseChapterGrid"
import CourseObjectiveSection from "./CourseObjectiveSection"
import CourseProgress from "./CourseProgress"
import Exercise from "./Exercise"
import ExerciseInChapter from "./ExerciseInChapter"
import ExerciseSlide from "./ExerciseSlide"
import ExerciseTask from "./ExerciseTask"
import Glossary from "./Glossary"
import HeroSection from "./HeroSection"
import HightlightBox from "./HighlightBox"
import InfoBox from "./InfoBox"
import LandingPageCopyText from "./LandingPageCopyText"
import LandingPageHeroSection from "./LandingPageHeroSection"
import Latex from "./Latex"
import LearningObjectives from "./LearningObjectives"
import PagesInChapter from "./PagesInChapter"
import SponsorBlock from "./Sponsor"
import TableBox from "./TableBox"
import TopLevelPage from "./TopLevelPage"
import UnsupportedBlock from "./UnsupportedBlock"

/**
 * List of custom blocks to be passed on to Gutenberg.
 */
export const blockTypeMapForPages = [
  ["moocfi/aside", Aside],
  ["moocfi/chapter-progress", ChapterProgress],
  ["moocfi/congratulations", HeroSection],
  ["moocfi/course-chapter-grid", CourseChapterGrid],
  ["moocfi/course-progress", CourseProgress],
  ["moocfi/exercise-slide", ExerciseSlide],
  ["moocfi/exercise-task", ExerciseTask],
  ["moocfi/exercise", Exercise],
  ["moocfi/exercises-in-chapter", ExerciseInChapter],
  ["moocfi/glossary", Glossary],
  ["moocfi/hero-section", HeroSection],
  ["moocfi/infobox", InfoBox],
  ["moocfi/latex", Latex],
  ["moocfi/learning-objectives", LearningObjectives],
  ["moocfi/pages-in-chapter", PagesInChapter],
  ["moocfi/unsupported-block-type", UnsupportedBlock],
  ["moocfi/highlightbox", HightlightBox],
  ["moocfi/tablebox", TableBox],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as Array<[string, BlockConfiguration<Record<string, any>>]>

export const blockTypeMapForFrontPages = [
  ["moocfi/congratulations", Congratulations],
  ["moocfi/course-chapter-grid", CourseChapterGrid],
  ["moocfi/course-objective-section", CourseObjectiveSection],
  ["moocfi/course-progress", CourseProgress],
  ["moocfi/glossary", Glossary],
  ["moocfi/landing-page-hero-section", LandingPageHeroSection],
  ["moocfi/latex", Latex],
  ["moocfi/sponsor", SponsorBlock],
  ["moocfi/top-level-pages", TopLevelPage],
  ["moocfi/unsupported-block-type", UnsupportedBlock],
  ["moocfi/landing-page-copy-text", LandingPageCopyText],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as Array<[string, BlockConfiguration<Record<string, any>>]>

export const blockTypeMapForTopLevelPages = [
  ...blockTypeMapForFrontPages,
  ["moocfi/hero-section", HeroSection],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as Array<[string, BlockConfiguration<Record<string, any>>]>
