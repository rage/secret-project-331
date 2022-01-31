import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import { fetchAcronyms, newAcronym } from "../../../../services/backend"
import Button from "../../../../shared-module/components/Button"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import TextField from "../../../../shared-module/components/InputFields/TextField"
import Spinner from "../../../../shared-module/components/Spinner"
import useLanguage from "../../../../shared-module/hooks/useLanguage"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import dontRenderUntilQueryParametersReady from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface Props {
  query: { organizationSlug: string; courseSlug: string }
}

const AcronymsPage: React.FC<Props> = ({ query }) => {
  const { t } = useTranslation()
  const { organizationSlug, courseSlug } = query
  const language = useLanguage() || "en"
  const acronyms = useQuery(`${courseSlug}-acronyms-${language}`, () =>
    fetchAcronyms(courseSlug, language),
  )
  const [acronym, setAcronym] = useState("")
  const [meaning, setMeaning] = useState("")
  const addAcronym = useMutation(() => newAcronym(courseSlug, language, { acronym, meaning }), {
    onSuccess: () => acronyms.refetch(),
  })

  if (acronyms.isIdle || acronyms.isLoading) {
    return <Spinner variant={"small"} />
  }

  if (acronyms.isError) {
    return <ErrorBanner variant={"readOnly"} error={acronyms.error} />
  }

  return (
    <Layout organizationSlug={organizationSlug}>
      <div
        className={css`
          margin: 0 auto;
          a {
            text-decoration: none;
            color: #007bff;
            :hover {
              text-decoration: underline;
            }
          }
          ${respondToOrLarger.sm} {
            padding-top: 100px;
          }
        `}
      >
        <h1
          className={css`
            margin-bottom: 40px;
            text-transform: uppercase;
          `}
        >
          {t("acronyms")}
        </h1>
        <table
          className={css`
            text-align: left;
            border-spacing: 5px;
            th {
              padding: 20px;
              background: #8fb4b1;
            }
            td {
              vertical-align: top;
              padding: 20px;
            }
            tr:nth-child(2n) {
              background: #1f696466;
            }
            tr:nth-child(2n + 1) {
              background: #1f696433;
            }
          `}
        >
          <thead>
            <tr>
              <th>{t("acronyms")}</th>
              <th
                className={css`
                  width: 100%;
                `}
              >
                {t("meaning")}
              </th>
            </tr>
          </thead>
          <tbody>
            {acronyms.data
              .sort((a, b) => a.acronym.toLowerCase().localeCompare(b.acronym.toLowerCase()))
              .map((a) => {
                return (
                  <tr key={a.id}>
                    <td>{a.acronym}</td>
                    <td>{a.meaning}</td>
                  </tr>
                )
              })}
            <tr>
              <td>
                <TextField id="new-acronym" placeholder={t("new-acronym")} onChange={setAcronym} />
              </td>
              <td
                className={css`
                  display: flex;
                `}
              >
                <TextField id="new-meaning" placeholder={t("new-meaning")} onChange={setMeaning} />
                <Button
                  onClick={() => addAcronym.mutate()}
                  disabled={!acronym || !meaning}
                  variant="primary"
                  size="medium"
                  className={css`
                    margin-left: 20px;
                  `}
                >
                  {t("save")}
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Layout>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(AcronymsPage))
