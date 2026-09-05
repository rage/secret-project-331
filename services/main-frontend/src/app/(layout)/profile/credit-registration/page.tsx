"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { profileStudiesRoute } from "@/shared-module/common/utils/routes"

/** This content now lives on the studies page; this route stays only so old links still land somewhere. */
const ProfileCreditRegistrationPage: React.FC = () => {
  const router = useRouter()
  useEffect(() => {
    router.replace(profileStudiesRoute())
  }, [router])
  return null
}

export default ProfileCreditRegistrationPage
