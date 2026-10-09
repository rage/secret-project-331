"use client"

import React from "react"

import AttentionQueueSection from "@/components/credit-registration/admin/AttentionQueueSection"
import { sectionCardsCss } from "@/components/credit-registration/styles"

/** Everything that needs a person. */
const ErrorsPage: React.FC = () => (
  <div className={sectionCardsCss}>
    <AttentionQueueSection />
  </div>
)

export default ErrorsPage
