import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import NewCodeGiveawayForm from "./NewCodeGiveawayForm"

import { fetchCodeGiveawaysByCourse } from "@/services/backend/codeGiveaways"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme, headingFont, typography } from "@/shared-module/common/styles"
import { codeGiveawayRoute } from "@/shared-module/common/utils/routes"

interface CodeGiveawayPageProps {
  courseId: string
}

const Content = styled.div`
  margin: 2rem 0;
`

// eslint-disable-next-line i18next/no-literal-string
const CodeGiveawayCard = styled.a`
  padding: 1rem;
  border: 1px solid ${baseTheme.colors.gray[300]};
  border-radius: 0.5rem;
  margin: 1rem 0;
  cursor: pointer;
  transition: background-color 0.2s;
  display: block;
  text-decoration: none;
  color: ${baseTheme.colors.gray[700]};

  &:hover {
    background-color: ${baseTheme.colors.gray[100]};
  }

  h2 {
    margin: 0;
    font-size: ${typography.h6};
  }
`

const CodeGiveawayPage: React.FC<CodeGiveawayPageProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const [newDialogOpen, setNewDialogOpen] = useState(false)

  const codeGiveawayQuery = useQuery({
    queryKey: ["code-giveaways", courseId],
    queryFn: () => fetchCodeGiveawaysByCourse(courseId),
  })

  if (codeGiveawayQuery.isLoading) {
    return <Spinner variant="medium" />
  }

  if (codeGiveawayQuery.isError) {
    return <ErrorBanner variant="readOnly" error={codeGiveawayQuery.error} />
  }
  return (
    <div>
      <h1
        className={css`
          font-size: ${typography.h4};
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
        `}
      >
        {t("heading-code-giveaways")}
      </h1>
      <Content>
        {codeGiveawayQuery.data?.length === 0 && <p>{t("no-code-giveaways")}</p>}
        {codeGiveawayQuery.data?.map((codeGiveaway) => (
          <CodeGiveawayCard href={codeGiveawayRoute(codeGiveaway.id)} key={codeGiveaway.id}>
            <h2>{codeGiveaway.name}</h2>
          </CodeGiveawayCard>
        ))}
      </Content>
      <Button
        size="medium"
        variant="primary"
        onClick={() => {
          setNewDialogOpen(true)
        }}
      >
        {t("button-text-new")}
      </Button>
      <NewCodeGiveawayForm
        courseId={courseId}
        dialogOpen={newDialogOpen}
        setDialogOpen={setNewDialogOpen}
        onCreated={() => {
          codeGiveawayQuery.refetch()
        }}
      />
    </div>
  )
}
export default CodeGiveawayPage
