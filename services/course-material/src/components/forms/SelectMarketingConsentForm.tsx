import { useQuery } from "@tanstack/react-query"
import React, { useEffect, useState } from "react"

import { fetchUserMarketingConsent, updateMarketingConsent } from "@/services/backend"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

interface selectMarketingConstentProps {
  courseId: string
  courseLanguageGroupsId: string
}

const SelectMarketingConstentForm: React.FC<selectMarketingConstentProps> = ({
  courseId,
  courseLanguageGroupsId,
}) => {
  const [marketingConsent, setMarketingConsent] = useState(false)

  const fetchInitialMarketingConsent = useQuery({
    queryKey: ["marketing-consent", courseId],
    queryFn: () => fetchUserMarketingConsent(assertNotNullOrUndefined(courseId)),
    enabled: courseId !== undefined,
  })

  useEffect(() => {
    if (fetchInitialMarketingConsent.isSuccess) {
      setMarketingConsent(fetchInitialMarketingConsent.data.consent)
    }
  }, [fetchInitialMarketingConsent.data, fetchInitialMarketingConsent.isSuccess])

  const handleMarketingConsentChangeMutation = useToastMutation(
    async () => {
      try {
        await updateMarketingConsent(courseId, courseLanguageGroupsId, marketingConsent)
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
