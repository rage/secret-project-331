import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { MagnifyingGlass, XmarkCircle } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
// useDebounce from "usehooks-ts" doesn't seem to work
import { useDebounce } from "use-debounce"

import { searchPagesWithPhrase, searchPagesWithWords } from "../services/backend"
import { sanitizeCourseMaterialHtml } from "../utils/sanitizeCourseMaterialHtml"

import { PageSearchResult } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import Dialog from "@/shared-module/common/components/Dialog"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export interface SearchDialogProps {
  courseId: string
  organizationSlug: string
}

const HeaderBar = styled.div`
  display: flex;
  padding: 0.75rem 0;
  align-items: center;
  gap: 0.5rem;
  h1 {
    font-size: 1.25rem;
    margin-bottom: 0;
  }
`

const SearchContainer = styled.div<{ $hasContent: boolean }>`
  overflow: hidden;
  width: 100%;
  height: ${(props) => (props.$hasContent ? "700px" : "80px")};
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
`

const SearchInputContainer = styled.div`
  position: relative;
  flex-shrink: 0;
  padding: 0 1rem;
`

const ResultsContainer = styled.div<{ $hasResults: boolean }>`
  margin-top: 1rem;
  padding: 4px 1rem;
  overflow-y: auto;
  max-height: calc(90vh - 90px);
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: 2rem 0;
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  color: ${baseTheme.colors.gray[500]};
  text-align: center;
  transition: padding 0.2s ease;
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
  display: flex;
  background: #ffffff;
  width: 100%;
  padding: 0 3.5rem;
  height: 56px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  border: none;
  outline: 1px solid ${baseTheme.colors.gray[200]};
  margin-right: 0.5rem;
  font-size: 1rem;
  transition: all 0.2s ease;

  &:focus {
    outline: 2px solid ${baseTheme.colors.green[400]};
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
  }
`

const SearchIcon = styled(MagnifyingGlass)`
  position: absolute;
  left: 1.5rem;
  top: 50%;
  transform: translateY(-50%);
  color: ${baseTheme.colors.gray[400]};
  transition: color 0.2s ease;
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

const CloseButton = styled.button`
  background: none;
  border: none;
  padding: 2px;
  margin: 0;
  cursor: pointer;
  color: ${baseTheme.colors.gray[400]};
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;

  &:hover {
    color: ${baseTheme.colors.gray[600]};
  }

  &:focus-visible {
    outline: 2px solid ${baseTheme.colors.green[400]};
    outline-offset: 2px;
  }
`

// Keep the KEYS constant for the shortcut handler
const KEYS = {
  SHORTCUT: "k",
}

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
      if (pages.find((p) => p.id === pageWithWords.id)) {
        return
      }
      pages.push(pageWithWords)
    })
    return pages
  }, [phraseSearchResults, wordSearchResults])

  const hasNoResults = useMemo(() => {
    return combinedResults !== null && combinedResults.length === 0 && debouncedQuery.trim() !== ""
  }, [combinedResults, debouncedQuery])

  const hasContent = useMemo(() => {
    return (
      isLoading || !!error || debouncedQuery.trim() !== "" || (combinedResults?.length ?? 0) > 0
    )
  }, [isLoading, error, debouncedQuery, combinedResults])

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
          searchPagesWithPhrase(
            { query: debouncedQuery },
            courseId,
            abortControllerRef.current.signal,
          ),
          searchPagesWithWords(
            { query: debouncedQuery },
            courseId,
            abortControllerRef.current.signal,
          ),
        ])
        setPhraseSearchResults(pagesWithPhrase)
        setWordSearchResults(pagesWithWords)
      } catch (e: unknown) {
        // Don't set error state if the request was aborted
        if (e instanceof Error && e.name === "AbortError") {
          return
        }

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
      } finally {
        setIsLoading(false)
      }
    }
    innerFunction()

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [courseId, debouncedQuery])

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
        tabIndex={0}
        id="search-for-pages-button"
        className={StyledIcon}
        aria-label={t("button-label-search-for-pages")}
        aria-hidden={false}
        size="small"
        variant="icon"
        onClick={openModal}
      >
        <MagnifyingGlass size={16} weight="bold" />
      </Button>
      <Dialog
        open={open}
        onClose={closeModal}
        noPadding
        preventBackgroundScroll
        aria-labelledby="search-dialog-title"
      >
        <SearchContainer $hasContent={hasContent}>
          <SearchInputContainer>
            <HeaderBar>
              <SearchIcon size={20} weight="bold" />
              <StyledInput
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
              <CloseButton type="button" aria-label={t("close")} onClick={closeModal}>
                <XmarkCircle size={18} />
              </CloseButton>
            </HeaderBar>
          </SearchInputContainer>

          <ResultsContainer $hasResults={!!debouncedQuery || isLoading}>
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

            {isLoading && (
              <LoadingContainer>
                <Spinner variant="medium" />
              </LoadingContainer>
            )}

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
                  href={`/${organizationSlug}/courses/${result.url_path}`}
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
                  {result.chapter_name != null && result.chapter_name !== "" && (
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
