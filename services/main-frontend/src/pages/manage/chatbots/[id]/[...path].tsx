import { useRouter } from "next/router"
import React from "react"
import { useTranslation } from "react-i18next"

import MainFrontendBreadCrumbs from "@/components/MainFrontendBreadCrumbs"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const CustomizeChatbotPage = () => {
  // useroute
  const { t } = useTranslation()
  const router = useRouter()
  const { id } = router.query
  console.log(id)
  const ChatbotConf = null // get from db?
  return (
    <>
      <MainFrontendBreadCrumbs organizationSlug={null} courseId={null} />
      <h1>HI</h1>
    </>
  )
}

export default withErrorBoundary(withSignedIn(CustomizeChatbotPage))
