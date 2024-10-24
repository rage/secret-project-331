import React, { useEffect, useState } from "react"

import { fetchUserMarketingConsent, updateMarketingConsent } from "@/services/backend"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

interface selectMarketingConstentProps {
  courseId: string
}

const SelectMarketingConstentForm: React.FC<selectMarketingConstentProps> = ({ courseId }) => {
  const [marketingConsent, setMarketingConsent] = useState(false)

  useEffect(() => {
    const fetchConsentStatus = async () => {
      const response = await fetchUserMarketingConsent(courseId)
      setMarketingConsent(response.consent)
    }
    fetchConsentStatus()
  }, [courseId])

  const handleMarketingConsentChangeMutation = useToastMutation(
    async () => {
      try {
        await updateMarketingConsent(courseId, marketingConsent)
      } catch (error) {
        setMarketingConsent(!marketingConsent)
      }
      return null
    },
    { notify: false },
  )

  return (
    <>
      <CheckBox
        // eslint-disable-next-line i18next/no-literal-string
        label="I consent to receive marketing messages for this course."
        type="checkbox"
        checked={marketingConsent}
        onChange={() => {
          setMarketingConsent(!marketingConsent)
          handleMarketingConsentChangeMutation.mutate()
        }}
      ></CheckBox>
    </>
  )
}

export default SelectMarketingConstentForm
