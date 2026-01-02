import { atom } from "jotai"

/**
 * Tracks the user's language preference for course material.
 * - "same-as-course": UI language should match the current course language (default on page load)
 * - string: Specific language code the user has manually selected (triggers course redirect)
 */
export const courseLanguagePreferenceAtom = atom<"same-as-course" | string>("same-as-course")
