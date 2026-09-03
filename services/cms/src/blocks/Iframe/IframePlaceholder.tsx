"use client"

import { useForm } from "react-hook-form"

import { Button, TextArea } from "@/shared-module/components"
import { useTranslation } from "@/utils/useCmsTranslation"

export interface IFramePlaceHolderProps {
  setUrl: (url: string) => void
  defaultValue: string | undefined
}

// If a url is added to this list, the block refuses to handle it and tells the user to use the
// embed block instead, which gives a better experience for these particular sources.
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

interface IframeSourceFormFields {
  source: string
}

/** Extracts an embeddable url from a pasted url or an `<iframe>` embed snippet, or null if neither parses. */
function parseIframeSourceUrl(rawValue: string): string | null {
  const input = rawValue.trim()
  try {
    // oxlint-disable-next-line no-new -- validates input; throws on invalid URLs, caught below
    new URL(input)
    return input
  } catch (_e) {
    const parser = new DOMParser()
    // oxlint-disable-next-line i18next/no-literal-string
    const htmlDoc = parser.parseFromString(input, "text/html")
    const iframe = htmlDoc.querySelector("iframe")
    if (!iframe) {
      return null
    }
    try {
      // oxlint-disable-next-line no-new -- validates iframe.src; throws on invalid URLs, caught below
      new URL(iframe.src)
      return iframe.src
    } catch (_e2) {
      return null
    }
  }
}

const IFramePlaceHolder: React.FC<IFramePlaceHolderProps> = ({ setUrl, defaultValue }) => {
  const { t } = useTranslation()
  const { control, handleSubmit } = useForm<IframeSourceFormFields>({
    defaultValues: { source: defaultValue ?? "" },
  })

  const onParse = (data: IframeSourceFormFields) => {
    const url = parseIframeSourceUrl(data.source)
    if (url !== null) {
      setUrl(url)
    }
  }

  return (
    <form onSubmit={handleSubmit(onParse)}>
      <TextArea
        name="source"
        control={control}
        label={t("label-url-or-source")}
        rules={{
          validate: (value) => {
            const url = parseIframeSourceUrl(value)
            if (url === null) {
              return t("error-parsing-failed")
            }
            if (URLS_BETTER_HANDLED_BY_THE_EMBED_BLOCK.some((domain) => url.includes(domain))) {
              return t("error-use-embed-block-instead")
            }
            return true
          },
        }}
      />
      <Button variant="primary" size="medium" type="submit">
        {t("parse")}
      </Button>
    </form>
  )
}

export default IFramePlaceHolder
