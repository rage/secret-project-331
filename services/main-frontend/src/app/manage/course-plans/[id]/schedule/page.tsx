"use client"

import ScheduleWizardPage from "./components/ScheduleWizardPage"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export default withErrorBoundary(withSignedIn(ScheduleWizardPage))
