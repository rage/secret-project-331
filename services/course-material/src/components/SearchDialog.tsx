import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Button, Dialog, Paper, TextField } from "@material-ui/core"
import { useEffect, useState } from "react"
import sanitizeHtml from "sanitize-html"
import { useDebounce } from "use-debounce"

import { searchPageswithPhrase } from "../services/backend"
import { PageSearchResult } from "../shared-module/bindings"
import DebugModal from "../shared-module/components/DebugModal"

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

const SearchDialog: React.FC<SearchDialogProps> = ({ courseId }) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string | null>(null)
  const [debouncedQuery] = useDebounce(query, 200)
  const [results, setResults] = useState<PageSearchResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function innerFunction() {
      if (!debouncedQuery || debouncedQuery.trim() === "") {
        return
      }
      try {
        const pages = await searchPageswithPhrase({ query: debouncedQuery }, courseId)
        setResults(pages)
      } catch (e) {
        if (e?.response?.data) {
          setError(JSON.stringify(e.response.data, undefined, 2))
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
      <Button onClick={() => openModal()}>Search</Button>
      <Dialog maxWidth="xl" open={open} onClose={closeModal}>
        <Paper
          className={css`
            overflow: hidden;
            width: 500px;
            min-height: 700px;
          `}
        >
          <HeaderBar>
            <h1>Search</h1>
            <div
              className={css`
                flex-grow: 1;
              `}
            />
            <DebugModal data={results} />
            <Button onClick={closeModal}>Close</Button>
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
              placeholder="Search..."
            />
            <div
              className={css`
                margin-top: 1rem;
              `}
            >
              {error && <div>{error}</div>}
              {results?.map((result) => {
                if (!result.title_headline) {
                  return null
                }
                return (
                  <div
                    className={css`
                      margin-bottom: 1rem;
                    `}
                    key={result.id}
                  >
                    <h2
                      className={css`
                        b {
                          text-decoration: underline;
                        }
                      `}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(result.title_headline) }}
                    />
                    {result.content_headline && (
                      <p
                        className={css`
                          color: #5a5757;
                        `}
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(result.content_headline) }}
                      />
                    )}
                  </div>
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
