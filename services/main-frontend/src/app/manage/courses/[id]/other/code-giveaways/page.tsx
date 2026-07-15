"use client"

import { useParams } from "next/navigation"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import CodeGiveawayPage from "./CodeGiveawayPage"

function OtherCodeGiveawaysPage() {
  const params = useParams<{ id: string }>()
  return <CodeGiveawayPage courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(OtherCodeGiveawaysPage))
