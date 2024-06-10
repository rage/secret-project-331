/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { useState } from "react"

import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"

export interface IFramePlaceHolderProps {
  setUrl: (url: string) => void
  defaultValue: string | undefined
}

// If an url is added to this list, this one refuses handle that url and will tell the user to use the embed block instead. We do this because we're able to provide a better user experience with the embed block.
const URLS_BETTER_HANDLED_BY_THE_EMBED_BLOCK = [
  "youtu.be",
  "youtube.com",
  "twitter.com",
  "spotify.com",
  "flickr.com",
  "flic.kr",
  "vimeo.com",
  "menti.com",
  "mentimeter.com",
  "thinglink.com",
  "imgur.com",
  "reddit.com",
  "slideshare.net",
  "ted.com",
  "tumblr.com",
]

const IFramePlaceHolder: React.FC<IFramePlaceHolderProps> = ({ setUrl, defaultValue }) => {
  const [value, setValue] = useState(defaultValue ?? "")
  const [error, setError] = useState<string | null>(null)
  return (
    <div>
      <TextAreaField label="URL / source" value={value} onChangeByValue={setValue} />
      {error && (
        <div
          className={css`
            margin: 1rem;
          `}
        >
          <ErrorBanner variant="readOnly" error={error} />
        </div>
      )}
      <Button
        variant="primary"
        size="medium"
        onClick={() => {
          setError(null)
          const input = value.trim()
          let url: string | null = null
          try {
            new URL(input)
            url = input
          } catch (e) {
            const parser = new DOMParser()
            // eslint-disable-next-line i18next/no-literal-string
            const htmlDoc = parser.parseFromString(input, "text/html")
            // eslint-disable-next-line i18next/no-literal-string
            const iframe = htmlDoc.querySelector("iframe")
            if (iframe) {
              try {
                new URL(iframe.src)
                url = iframe.src
              } catch (e) {
                // NOP
              }
            }
          }
          if (url !== null) {
            if (URLS_BETTER_HANDLED_BY_THE_EMBED_BLOCK.find((u) => url?.includes(u))) {
              setError("Please use the embed block instead.")
              return
            }
            setUrl(url)
          } else {
            setError("Parsing failed.")
          }
        }}
      >
        Parse
      </Button>
    </div>
  )
}

export default IFramePlaceHolder
