import { atom } from "jotai"

import type { Course, Organization } from "@/shared-module/common/bindings"

export type ViewParams =
  | { type: "material"; courseSlug: string; path: string }
  | { type: "exam"; examId: string; isTestMode: boolean }
  | { type: "management"; organization: Organization; course: Course }
  | null

export const viewParamsAtom = atom<ViewParams>(null)
