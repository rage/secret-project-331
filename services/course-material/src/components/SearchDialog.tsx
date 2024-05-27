import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { MagnifyingGlass, XmarkCircle } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
// useDebounce from "usehooks-ts" doesn't seem to work
import { useDebounce } from "use-debounce"

import { searchPagesWithPhrase, searchPagesWithWords } from "../services/backend"
import { sanitizeCourseMaterialHtml } from "../utils/sanitizeCourseMaterialHtml"

import { PageSearchResult } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import Dialog from "@/shared-module/common/components/Dialog"
import { baseTheme } from "@/shared-module/common/styles"

export interface SearchDialogProps {
  courseId: string
  organizationSlug: string
}

const HeaderBar = styled.div`
  display: flex;
  padding: 1rem 0;
  align-items: center;
  h1 {
    font-size: 1.25rem;
    margin-bottom: 0;
  }
`

const StyledIcon = css`
  right: -8px;
  bottom: -2px;
  :hover {
    cursor: pointer;
  }
  &:focus-visible {
    outline: 2px solid ${baseTheme.colors.green[500]};
    outline-offset: 2px;
  }
`

const SearchDialog: React.FC<React.PropsWithChildren<SearchDialogProps>> = ({
  courseId,
  organizationSlug,
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string>("")
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
      <Button
        tabIndex={0}
        id="search-for-pages-button"
        className={cx(StyledIcon)}
        aria-label={t("button-label-search-for-pages")}
        aria-hidden={false}
        size="small"
        variant="icon"
        onClick={openModal}
      >
        <MagnifyingGlass size={16} weight="bold" />
      </Button>
      <Dialog open={open} onClose={closeModal} noPadding aria-labelledby="search-for-pages-button">
        <div
          className={css`
            overflow: hidden;
            width: 100%;
            min-height: 700px;
          `}
        >
          <div
            className={css`
              padding: 0 1rem;
            `}
          >
            <HeaderBar>
              <MagnifyingGlass
                weight="bold"
                className={css`
                  margin-right: -23px;
                  z-index: 2;
                  font-size: 22px;
                  position: relative;
                  right: -8px;
                  color: ${baseTheme.colors.gray[400]};
                `}
              />

              <input
                className={css`
                  display: flex;
                  background: #ffffff;
                  width: 100%;
                  padding-left: 45px;
                  padding-right: 10px;
                  height: 60px;
                  box-shadow: 0px 8px 40px rgb(0 0 0 / 5%);
                  border-radius: 3px;
                  border: none;
                  outline: 1px solid ${baseTheme.colors.gray[200]};
                  margin-right: 0.5rem;

                  &:focus {
                    outline: 1px solid ${baseTheme.colors.blue[400]};
                  }
                `}
                value={query}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- This is a search bar that opens on the screen. This rule seems to be to prevent people from autofocusing in middle of a page which would skip important content such as headers. However, in this case we aren't skipping anything since the search bar is the thing that opens.
                autoFocus
                onChange={(e) => {
                  setError(null)
                  setQuery(e.target.value)
                }}
                /* fullWidth */
                placeholder={t("search-field-placeholder")}
              />
              <Button
                size="medium"
                variant="secondary"
                aria-label={t("close")}
                onClick={closeModal}
              >
                <XmarkCircle />
              </Button>
            </HeaderBar>
            <div
              className={css`
                margin-top: 1rem;
              `}
            >
              {error && <div>{error}</div>}
              {
                <div>
                  {combinedResults?.map((result) => {
                    if (!result.title_headline) {
                      return null
                    }
                    return (
                      <Link
                        href={`/${organizationSlug}/courses/${result.url_path}`}
                        key={result.id}
                        onClick={() => {
                          setOpen(false)
                        }}
                        className={css`
                          text-decoration: none;
                          color: unset;
                          display: block;
                          background: #f5f6f7;
                          margin-bottom: 0.5rem;
                          padding: 1rem;

                          :hover {
                            background: #ebedee;
                          }
                        `}
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
                      </Link>
                    )
                  })}
                </div>
              }
            </div>
          </div>
        </div>
      </Dialog>
    </>
  )
}

export default SearchDialog
