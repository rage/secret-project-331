"use client"

import { redirect } from "next/navigation"

import { creditRegistrationOverviewRoute } from "@/shared-module/common/utils/routes"

/** Sends the bare route to the default tab. */
export default function CreditRegistrationRedirect() {
  redirect(creditRegistrationOverviewRoute())
}
