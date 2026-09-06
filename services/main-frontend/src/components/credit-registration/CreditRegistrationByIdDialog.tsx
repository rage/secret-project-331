"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"

import { getCreditRegistrationDetailsOptions } from "@/generated/api/@tanstack/react-query.generated"
import { QueryResult } from "@/shared-module/components"

import CreditRegistrationDetailsDialog from "./CreditRegistrationDetailsDialog"

interface Props {
  creditRegistrationId: string
  onClose: () => void
}

/**
 * The details of a registration a caller knows only by id.
 *
 * For the action log, whose entries carry a target id and no student: mount it on demand so one
 * request is made for the row the reader asked about rather than one per entry.
 */
const CreditRegistrationByIdDialog: React.FC<Props> = ({ creditRegistrationId, onClose }) => {
  const detailsQuery = useQuery(
    getCreditRegistrationDetailsOptions({
      path: { credit_registration_id: creditRegistrationId },
    }),
  )

  return (
    <QueryResult query={detailsQuery}>
      {(details) => (
        <CreditRegistrationDetailsDialog
          registration={details.registration}
          open
          onClose={onClose}
        />
      )}
    </QueryResult>
  )
}

export default CreditRegistrationByIdDialog
