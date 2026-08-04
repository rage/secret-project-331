"use client"

import { redirect } from "next/navigation"

import { creditRegistrationOverviewRoute } from "@/shared-module/common/utils/routes"

export default function CreditRegistrationRedirect() {
  redirect(creditRegistrationOverviewRoute())
}
