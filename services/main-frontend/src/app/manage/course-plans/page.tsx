"use client"

import CoursePlansListPage from "./components/CoursePlansListPage"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export default withErrorBoundary(withSignedIn(CoursePlansListPage))
