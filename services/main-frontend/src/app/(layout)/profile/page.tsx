"use client"

import { redirect } from "next/navigation"

import { profileStudiesRoute } from "@/shared-module/common/utils/routes"

export default function ProfilePage() {
  redirect(profileStudiesRoute())
}
