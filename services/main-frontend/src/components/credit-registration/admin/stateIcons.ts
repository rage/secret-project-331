import {
  ArrowRight,
  CheckCircle,
  CheckClipboard,
  Clock,
  EnvelopeArrowRight,
  Layers,
  LockKeyhole,
  MagnifyingGlass,
  Medal,
  MinusCircle,
  Question,
  RotateLeft,
  RotateRight,
  StopCircle,
  Stopwatch,
  XmarkCircle,
} from "@vectopus/atlas-icons-react"
import type React from "react"

import type { CreditRegistrationState } from "@/generated/api/types.generated"

/** The props these glyphs are given here; the icon set accepts more. */
type StateIcon = React.ComponentType<{ size?: number; className?: string }>

/**
 * One glyph per stored state, so a scanned column has a shape to recognise before the label is
 * read. Each says what the row is waiting for or what became of it, not how bad it is: the tone is
 * the stage it sits under, and a glyph is drawn in the table's own ink.
 *
 * `satisfies` over the whole enum means a state added to the backend fails the build here rather
 * than rendering a blank cell.
 *
 * Two of this set's names do not draw what they sound like: `Cross` is a crucifix, not an X (use
 * `XmarkCircle`), and `ClockTime` is the same wall clock as `Clock` — `awaiting_verification` uses
 * `Stopwatch` instead to stay visually distinct from `pending`.
 */
export const STATE_ICONS = {
  pending: Clock,
  ready_to_submit: EnvelopeArrowRight,
  resolving_enrolment: MagnifyingGlass,
  checking_enrolment: CheckClipboard,
  submitting: ArrowRight,
  awaiting_verification: Stopwatch,
  blocked: LockKeyhole,
  no_usable_enrolment: MinusCircle,
  submission_uncertain: Question,
  failed_retryable: RotateRight,
  failed_permanent: XmarkCircle,
  misregistered: RotateLeft,
  registered: CheckCircle,
  duplicate: Layers,
  not_improved: Medal,
  cancelled: StopCircle,
} as const satisfies Record<CreditRegistrationState, StateIcon>
