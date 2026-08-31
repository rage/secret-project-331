"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { profileStudiesRoute } from "@/shared-module/common/utils/routes"

const ProfilePage: React.FC = () => {
  const router = useRouter()
  useEffect(() => {
    router.replace(profileStudiesRoute())
  }, [router])
  return null
}

export default ProfilePage
