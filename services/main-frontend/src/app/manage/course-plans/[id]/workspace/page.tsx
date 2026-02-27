"use client"

import CoursePlanWorkspacePage from "./components/CoursePlanWorkspacePage"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export default withErrorBoundary(withSignedIn(CoursePlanWorkspacePage))
