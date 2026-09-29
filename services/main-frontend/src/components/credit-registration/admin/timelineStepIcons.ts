import {
  CalendarSchedule,
  CheckShield,
  CircleArrowsLeftRight,
  FileSearch,
  Gear,
  MagnifyingGlassUser,
  PaperAirplane,
  PlusCircle,
  Timer,
  User,
  UserGear,
} from "@vectopus/atlas-icons-react"
import type React from "react"

import type { TimelineStep } from "./timelineRows"

type StepIcon = React.ComponentType<{ size?: number; className?: string }>

/** A glyph per timeline step; none may reuse a `STATE_ICONS` glyph, drawn in the next column. */
export const TIMELINE_STEP_ICONS = {
  created: PlusCircle,
  pipeline: Gear,
  held_back: Timer,
  student: User,
  admin: UserGear,
  student_lookup: MagnifyingGlassUser,
  enrolment_check: CalendarSchedule,
  credit_search: FileSearch,
  submission: PaperAirplane,
  registration_check: CheckShield,
  suotar_exchange: CircleArrowsLeftRight,
} as const satisfies Record<TimelineStep, StepIcon>
