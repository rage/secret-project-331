import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Dialog, Paper, TextField } from "@material-ui/core"
import Link from "next/link"
import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useDebounce } from "use-debounce"

import { searchPagesWithPhrase, searchPagesWithWords } from "../services/backend"
import { PageSearchResult } from "../shared-module/bindings"
import Button from "../shared-module/components/Button"
import DebugModal from "../shared-module/components/DebugModal"
import { sanitizeCourseMaterialHtml } from "../utils/sanitizeCourseMaterialHtml"

export interface SearchDialogProps {
  courseId: string
}

const HeaderBar = styled.div`
  display: flex;
  padding: 0.5rem;
  align-items: center;
  h1 {
    font-size: 1.25rem;
    margin-bottom: 0;
  }
`

const StyledIcon = css`
  :hover {
    cursor: pointer;
  }
`

const SearchDialog: React.FC<SearchDialogProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string | null>(null)
  const [debouncedQuery] = useDebounce(query, 200)
  const [phraseSearchResults, setPhraseSearchResults] = useState<PageSearchResult[] | null>(null)
  const [wordSearchResults, setWordSearchResults] = useState<PageSearchResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Combines the search results from the two requests
  const combinedResults = useMemo(() => {
    if (phraseSearchResults === null || wordSearchResults === null) {
      return null
    }
    // The search results start with with the results from the phrase, because those results are more accurate
    const pages = [...phraseSearchResults]
    // After the phrase search results, we add the word search results if the page is not already in the result set
    wordSearchResults.forEach((pageWithWords) => {
      if (pages.find((p) => p.id === pageWithWords.id)) {
        return
      }
      pages.push(pageWithWords)
    })
    return pages
  }, [phraseSearchResults, wordSearchResults])

  useEffect(() => {
    async function innerFunction() {
      if (!debouncedQuery || debouncedQuery.trim() === "") {
        return
      }
      try {
        const [pagesWithPhrase, pagesWithWords] = await Promise.all([
          searchPagesWithPhrase({ query: debouncedQuery }, courseId),
          searchPagesWithWords({ query: debouncedQuery }, courseId),
        ])
        setPhraseSearchResults(pagesWithPhrase)
        setWordSearchResults(pagesWithWords)
      } catch (e: unknown) {
        if (!(e instanceof Error)) {
          throw e
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((e as any)?.response?.data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setError(JSON.stringify((e as any).response.data, undefined, 2))
        } else {
          setError(e.toString())
        }
      }
    }
    innerFunction()
  }, [courseId, debouncedQuery])

  const closeModal = () => {
    setOpen(false)
  }

  const openModal = () => {
    setOpen(true)
  }

  return (
    <>
      <FontAwesomeIcon
        className={cx(StyledIcon)}
        icon={faSearch}
        aria-label={t("button-label-search-for-pages")}
        onClick={openModal}
      />
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Dialog maxWidth="xl" open={open} onClose={closeModal}>
        <Paper
          className={css`
            overflow: hidden;
            width: 500px;
            min-height: 700px;
          `}
        >
          <HeaderBar>
            <h1>{t("search")}</h1>
            <div
              className={css`
                flex-grow: 1;
              `}
            />
            <DebugModal data={{ phraseSearchResults, wordSearchResults, combinedResults }} />
            <Button size="medium" variant="secondary" onClick={closeModal}>
              {t("close")}
            </Button>
          </HeaderBar>
          <div
            className={css`
              padding: 0 1rem;
            `}
          >
            <TextField
              value={query}
              onChange={(e) => {
                setError(null)
                setQuery(e.target.value)
              }}
              fullWidth
              placeholder={t("search-field-placeholder")}
            />
            <div
              className={css`
                margin-top: 1rem;
              `}
            >
              {error && <div>{error}</div>}
              {combinedResults?.map((result) => {
                if (!result.title_headline) {
                  return null
                }
                return (
                  <Link href={result.url_path} key={result.id} passHref>
                    <a
                      href="replace"
                      className={css`
                        text-decoration: none;
                        color: unset;
                        display: block;
                        margin-bottom: 1rem;

                        padding: 1rem;

                        :hover {
                          background: #f3f3f3;
                        }
                      `}
                      key={result.id}
                    >
                      <h2
                        className={css`
                          font-size: 1.5rem;
                          b {
                            text-decoration: underline;
                          }
                        `}
                        dangerouslySetInnerHTML={{
                          __html: sanitizeCourseMaterialHtml(result.title_headline),
                        }}
                      />

                      {result.content_headline && (
                        <p
                          className={css`
                            color: #5a5757;
                          `}
                          dangerouslySetInnerHTML={{
                            __html: sanitizeCourseMaterialHtml(result.content_headline),
                          }}
                        />
                      )}
                    </a>
                  </Link>
                )
              })}
            </div>
          </div>
        </Paper>
      </Dialog>
    </>
  )
}

export default SearchDialog
