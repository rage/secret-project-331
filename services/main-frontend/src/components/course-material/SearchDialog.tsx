"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { MagnifyingGlass } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
// useDebounce from "usehooks-ts" doesn't seem to work
import { useDebounce } from "use-debounce"

import {
  searchPagesWithPhrase,
  searchPagesWithWords,
} from "@/generated/course-material-api/sdk.generated"
import type { PageSearchResult } from "@/generated/course-material-api/types.generated"
import { isAbortError } from "@/shared-module/common/errors/AppApiError"
import { normalizeErrorForDisplay } from "@/shared-module/common/errors/normalizeErrorForDisplay"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { Button, Dialog, LoadingRegion } from "@/shared-module/components"
import { sanitizeCourseMaterialHtml } from "@/utils/course-material/sanitizeCourseMaterialHtml"

export interface SearchDialogProps {
  courseId: string
  organizationSlug: string
}

/** Grows with its results up to a cap, so an empty or short result list leaves no blank band. */
const SearchContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: min(700px, 85vh);
`

/** Holds the close button too, so it lines up with the input instead of floating over it. */
const HeaderBar = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
`

const InputWrapper = styled.div`
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
`

const ResultsContainer = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0 var(--space-4) var(--space-4);

  &:empty {
    display: none;
  }
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-5) var(--space-4) var(--space-4-5);
  color: ${baseTheme.colors.gray[500]};
  text-align: center;

  h3 {
    margin: var(--space-3) 0 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  p {
    margin: 0;
  }
`

const ResultCard = styled(Link)`
  text-decoration: none;
  color: unset;
  display: block;
  background: #ffffff;
  margin-bottom: 0.5rem;
  padding: 1rem;
  border-radius: 6px;
  transition: all 0.2s ease;
  border: 1px solid ${baseTheme.colors.gray[100]};

  &:hover {
    background: ${baseTheme.colors.green[100]};
    border-color: ${baseTheme.colors.green[200]};
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
  }

  .chapter-name {
    font-size: 0.75rem;
    color: ${baseTheme.colors.gray[500]};
    margin: 0 0 0.25rem;
    line-height: 1.4;
  }

  h2 {
    font-size: 1rem;
    margin: 0 0 0.25rem;
    line-height: 1.4;

    ${respondToOrLarger.md} {
      font-size: 1.125rem;
    }
  }

  p {
    font-size: 0.875rem;
    margin: 0;
    line-height: 1.5;
    color: ${baseTheme.colors.gray[600]};

    ${respondToOrLarger.md} {
      font-size: 0.875rem;
    }
  }
`

const StyledInput = styled.input`
  display: block;
  width: 100%;
  height: 48px;
  padding: 0 var(--space-4) 0 calc(var(--space-4) + 20px + var(--space-3));
  background: #ffffff;
  border: none;
  border-radius: 8px;
  outline: 1px solid ${baseTheme.colors.gray[200]};
  font-size: 1rem;
  transition: outline-color 0.2s ease;

  &:focus {
    outline: 2px solid ${baseTheme.colors.green[400]};
  }
`

const SearchIcon = styled(MagnifyingGlass)`
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  color: ${baseTheme.colors.gray[400]};
  pointer-events: none;
`

const CLOSE_SYMBOL = "×"

const closeSymbolCss = css`
  font-size: 1.5rem;
  line-height: 1;
`

const SEARCH_BUTTON_ID = "search-for-pages-button"

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

const KEYS = {
  SHORTCUT: "k",
}

const SearchDialog: React.FC<React.PropsWithChildren<SearchDialogProps>> = ({
  courseId,
  organizationSlug,
}) => {
  const { t } = useTranslation()
  const { t: tErrors } = useTranslation("errors")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string>("")
  const [debouncedQuery] = useDebounce(query, 200)
  const [phraseSearchResults, setPhraseSearchResults] = useState<PageSearchResult[] | null>(null)
  const [wordSearchResults, setWordSearchResults] = useState<PageSearchResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef<AbortController>(new AbortController())

  // Combines the search results from the two requests
  const combinedResults = useMemo(() => {
    if (phraseSearchResults === null || wordSearchResults === null) {
      return null
    }
    // The search results start with with the results from the phrase, because those results are more accurate
    const pages = [...phraseSearchResults]
    // After the phrase search results, we add the word search results if the page is not already in the result set
    wordSearchResults.forEach((pageWithWords) => {
      if (pages.some((p) => p.id === pageWithWords.id)) {
        return
      }
      pages.push(pageWithWords)
    })
    return pages
  }, [phraseSearchResults, wordSearchResults])

  const hasNoResults = useMemo(() => {
    return combinedResults !== null && combinedResults.length === 0 && debouncedQuery.trim() !== ""
  }, [combinedResults, debouncedQuery])

  useEffect(() => {
    async function innerFunction() {
      // Cancel any pending requests
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      if (!debouncedQuery || debouncedQuery.trim() === "") {
        setPhraseSearchResults([])
        setWordSearchResults([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const [pagesWithPhrase, pagesWithWords] = await Promise.all([
          searchPagesWithPhrase({
            body: { query: debouncedQuery },
            path: {
              course_id: courseId,
            },
            signal: abortControllerRef.current.signal,
          }),
          searchPagesWithWords({
            body: { query: debouncedQuery },
            path: {
              course_id: courseId,
            },
            signal: abortControllerRef.current.signal,
          }),
        ])
        setPhraseSearchResults(pagesWithPhrase)
        setWordSearchResults(pagesWithWords)
      } catch (e: unknown) {
        // Don't set error state if the request was aborted
        if (isAbortError(e)) {
          return
        }
        const parsed = normalizeErrorForDisplay(e, tErrors)
        setError(parsed.message ?? parsed.title)
      } finally {
        setIsLoading(false)
      }
    }
    innerFunction()

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [courseId, debouncedQuery, tErrors])

  // Keep the keyboard shortcut functionality
  useEffect(() => {
    const controller = new AbortController()
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === KEYS.SHORTCUT) {
        e.preventDefault()
        setOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown, { signal: controller.signal })

    return () => {
      controller.abort()
    }
  }, [])

  const closeModal = () => {
    setOpen(false)
  }

  const openModal = () => {
    setOpen(true)
  }

  const handleResultClick = () => {
    setOpen(false)
    setQuery("")
    setPhraseSearchResults([])
    setWordSearchResults([])
  }

  return (
    <>
      <Button
        domProps={{ tabIndex: 0, id: SEARCH_BUTTON_ID, "aria-hidden": false }}
        className={StyledIcon}
        aria-label={t("button-label-search-for-pages")}
        size="small"
        variant="icon"
        onClick={openModal}
      >
        <MagnifyingGlass size={16} weight="bold" />
      </Button>
      <Dialog
        open={open}
        onClose={closeModal}
        padding="none"
        showCloseButton={false}
        aria-label={t("title-search-dialog")}
      >
        <SearchContainer>
          <HeaderBar>
            <InputWrapper>
              <SearchIcon size={20} weight="bold" />
              <StyledInput
                value={query}
                // oxlint-disable-next-line jsx-a11y/no-autofocus -- search bar opens as its own overlay; nothing is skipped
                autoFocus
                onChange={(e) => {
                  setError(null)
                  setQuery(e.target.value)
                }}
                placeholder={t("search-field-placeholder")}
              />
            </InputWrapper>
            <Button variant="icon" size="medium" aria-label={t("close")} onClick={closeModal}>
              <span aria-hidden="true" className={closeSymbolCss}>
                {CLOSE_SYMBOL}
              </span>
            </Button>
          </HeaderBar>

          <ResultsContainer>
            {error && (
              <div
                className={css`
                  padding: 1rem;
                  background-color: ${baseTheme.colors.red[100]};
                  border-left: 4px solid ${baseTheme.colors.red[500]};
                  color: ${baseTheme.colors.red[700]};
                  margin-bottom: 1rem;
                  border-radius: 4px;
                `}
              >
                {error}
              </div>
            )}

            {isLoading && <LoadingRegion />}

            {hasNoResults && (
              <EmptyState>
                <MagnifyingGlass size={48} weight="thin" />
                <h3>{t("no-results-found")}</h3>
                <p>{t("try-different-search-terms")}</p>
              </EmptyState>
            )}

            {!isLoading &&
              combinedResults?.map((result) => (
                <ResultCard
                  href={`/org/${organizationSlug}/courses/${result.url_path}`}
                  key={result.id}
                  onClick={handleResultClick}
                >
                  <h2
                    className={css`
                      font-size: 1.5rem;
                      b {
                        text-decoration: underline;
                      }
                    `}
                    dangerouslySetInnerHTML={{
                      __html: sanitizeCourseMaterialHtml(result.title_headline ?? ""),
                    }}
                  />
                  {result.chapter_name !== null &&
                    result.chapter_name !== undefined &&
                    result.chapter_name !== "" && (
                      <div
                        className={css`
                          font-size: 0.75rem;
                          color: ${baseTheme.colors.gray[500]};
                          margin: 0 0 0.25rem;
                          line-height: 1.4;
                        `}
                      >
                        {result.chapter_name}
                      </div>
                    )}
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
                </ResultCard>
              ))}
          </ResultsContainer>
        </SearchContainer>
      </Dialog>
    </>
  )
}

export default SearchDialog
