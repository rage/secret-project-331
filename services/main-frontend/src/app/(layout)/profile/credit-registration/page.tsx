"use client"

import { redirect } from "next/navigation"

import { profileStudiesRoute } from "@/shared-module/common/utils/routes"

/** This content now lives on the studies page; this route stays only so old links still land somewhere. */
export default function ProfileCreditRegistrationPage() {
  redirect(profileStudiesRoute())
}
