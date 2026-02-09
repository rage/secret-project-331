"use client"

import { useParams } from "next/navigation"

import CodeGiveawayPage from "./CodeGiveawayPage"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function OtherCodeGiveawaysPage() {
  const params = useParams<{ id: string }>()
  return <CodeGiveawayPage courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(OtherCodeGiveawaysPage))
