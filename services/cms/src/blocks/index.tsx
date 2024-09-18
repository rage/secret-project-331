/* eslint-disable i18next/no-literal-string */
import { BlockConfiguration } from "@wordpress/blocks"

import Aside from "./Aside"
import Author from "./Author"
import AuthorInnerBlock from "./AuthorInnerBlock"
import ChapterProgress from "./ChapterProgress"
import CodeGiveaway from "./CodeGiveaway"
import ConditionalBlock from "./ConditionalBlock"
import Congratulations from "./Congratulations"
import CourseChapterGrid from "./CourseChapterGrid"
import CourseObjectiveSection from "./CourseObjectiveSection"
import CourseProgress from "./CourseProgress"
import Exercise from "./Exercise"
import ExerciseSettings from "./Exercise/ExerciseSettings"
import ExerciseSlide from "./Exercise/ExerciseSlide"
import ExerciseSlides from "./Exercise/ExerciseSlides"
import ExerciseTask from "./Exercise/ExerciseTask"
import ExerciseCustomView from "./ExerciseCustomView"
import ExerciseInChapter from "./ExerciseInChapter"
import FlipCard from "./FlipCard"
import InnerCard from "./FlipCard/InnerCard"
import Glossary from "./Glossary"
import HeroSection from "./HeroSection"
import HightlightBox from "./HighlightBox"
import Iframe from "./Iframe"
import InfoBox from "./InfoBox"
import InstructionBox from "./InstructionBox"
import LandingPageCopyText from "./LandingPageCopyText"
import LandingPageHeroSection from "./LandingPageHeroSection"
import Latex from "./Latex"
import LearningObjectives from "./LearningObjectives"
import Map from "./Map"
import PagesInChapter from "./PagesInChapter"
import PartnersBlock from "./Partners"
import ResearchFormQuestion from "./ResearchConsentQuestion"
import TableBox from "./TableBox"
import TopLevelPage from "./TopLevelPage"
import UnsupportedBlock from "./UnsupportedBlock"

/**
 * List of custom blocks to be passed on to Gutenberg.
 */
export const blockTypeMapForPages = [
  ["moocfi/aside", Aside],
  ["moocfi/chapter-progress", ChapterProgress],
  ["moocfi/congratulations", Congratulations],
  ["moocfi/course-chapter-grid", CourseChapterGrid],
  ["moocfi/course-progress", CourseProgress],
  ["moocfi/exercise-slide", ExerciseSlide],
  ["moocfi/exercise-task", ExerciseTask],
  ["moocfi/exercise", Exercise],
  ["moocfi/exercise-slides", ExerciseSlides],
  ["moocfi/exercise-settings", ExerciseSettings],
  ["moocfi/exercises-in-chapter", ExerciseInChapter],
  ["moocfi/glossary", Glossary],
  ["moocfi/hero-section", HeroSection],
  ["moocfi/infobox", InfoBox],
  ["moocfi/latex", Latex],
  ["moocfi/learning-objectives", LearningObjectives],
  ["moocfi/pages-in-chapter", PagesInChapter],
  ["moocfi/unsupported-block-type", UnsupportedBlock],
  ["moocfi/highlightbox", HightlightBox],
  ["moocfi/instructionbox", InstructionBox],
  ["moocfi/tablebox", TableBox],
  ["moocfi/iframe", Iframe],
  ["moocfi/map", Map],
  ["moocfi/author", Author],
  ["moocfi/author-inner-block", AuthorInnerBlock],
  ["moocfi/conditional-block", ConditionalBlock],
  ["moocfi/exercise-custom-view-block", ExerciseCustomView],
  ["moocfi/partners", PartnersBlock],
  ["moocfi/top-level-pages", TopLevelPage],
  ["moocfi/flip-card", FlipCard],
  ["moocfi/inner-card", InnerCard],
  ["moocfi/code-giveaway", CodeGiveaway],
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
  ["moocfi/partners", PartnersBlock],
  ["moocfi/top-level-pages", TopLevelPage],
  ["moocfi/unsupported-block-type", UnsupportedBlock],
  ["moocfi/landing-page-copy-text", LandingPageCopyText],
  ["moocfi/iframe", Iframe],
  ["moocfi/map", Map],
  ["moocfi/conditional-block", ConditionalBlock],
  ["moocfi/exercise-custom-view-block", ExerciseCustomView],
  ["moocfi/code-giveaway", CodeGiveaway],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as Array<[string, BlockConfiguration<Record<string, any>>]>

export const blockTypeMapForTopLevelPages = [
  ...blockTypeMapForFrontPages,
  ["moocfi/hero-section", HeroSection],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as Array<[string, BlockConfiguration<Record<string, any>>]>

export const blockTypeMapForResearchConsentForm = [
  ["moocfi/research-consent-question", ResearchFormQuestion],
] as Array<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [string, BlockConfiguration<Record<string, any>>]
>
