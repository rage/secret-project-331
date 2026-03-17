"use client"

import { css } from "@emotion/css"
import { MagicWandSparkles } from "@vectopus/atlas-icons-react"
import { BlockControls } from "@wordpress/block-editor"
import { Dropdown, MenuGroup, MenuItem, ToolbarButton, ToolbarGroup } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { Fragment, useEffect, useState } from "@wordpress/element"
import { chevronRight } from "@wordpress/icons"
import { useContext } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

import PageContext from "../../contexts/PageContext"
import { createParagraphAiSource, extractPlainTextFromHtml } from "../Gutenberg/paragraphAiSource"
import {
  collectParagraphHtmlTagNames,
  sanitizeParagraphHtml,
} from "../Gutenberg/paragraphHtmlSanitizer"

import { executeAbility } from "./ai/abilities"
import {
  AI_GROUPS,
  AI_TONE_SUBMENU,
  AI_TRANSLATE_SUBMENU,
  type AiActionDefinition,
  type AiActionGroupId,
  type AiActionLabelKey,
  type AiGroupLabelKey,
} from "./ai/menu"

import Spinner from "@/shared-module/common/components/Spinner"
import {
  useConfirmDialogControls,
  useDialog,
} from "@/shared-module/common/components/dialogs/DialogProvider"
import { baseTheme } from "@/shared-module/common/styles"

const PARAGRAPH_BLOCK_NAME = "core/paragraph"

const SUBMENU_TONE = "tone" as const
const SUBMENU_TRANSLATE = "translate" as const

type SubmenuState = AiActionGroupId | typeof SUBMENU_TONE | typeof SUBMENU_TRANSLATE | null

const BORDER_COLOR = baseTheme.colors.gray[200]
const ACCENT_COLOR = baseTheme.colors.green[600]
const TEXT_COLOR = baseTheme.colors.gray[700]

interface ParagraphBlockProps {
  name: string
  attributes: {
    content?: string
    [key: string]: unknown
  }
  setAttributes: (attrs: Record<string, unknown>) => void
  [key: string]: unknown
}

// https://developer.wordpress.org/block-editor/reference-guides/filters/block-filters/#editor-blockedit
const withParagraphAiToolbarAction = createHigherOrderComponent((BlockEdit) => {
  const ParagraphWithAiToolbar = (props: ParagraphBlockProps) => {
    const { t } = useTranslation()
    const { confirm } = useDialog()
    const [running, setRunning] = useState(false)
    const [submenu, setSubmenu] = useState<SubmenuState>(null)
    const pageContext = useContext(PageContext)

    if (props.name !== PARAGRAPH_BLOCK_NAME) {
      return <BlockEdit {...props} />
    }

    const handleAction = async (action: AiActionDefinition, close: () => void) => {
      const originalHtml =
        typeof props.attributes?.content === "string" ? props.attributes.content : ""
      const paragraphSource = createParagraphAiSource(originalHtml)
      const { requestContent, requestIsHtml } = paragraphSource
      const allowedHtmlTagNames = collectParagraphHtmlTagNames(originalHtml)

      const paragraphContext =
        pageContext && "page" in pageContext
          ? {
              page_id: pageContext.page.id,
              course_id: pageContext.page.course_id,
              locale: null,
            }
          : null

      setRunning(true)
      try {
        let selectedSuggestion = ""
        const dialogContent = (
          <ParagraphAiSuggestionDialog
            action={action}
            requestContent={requestContent}
            requestIsHtml={requestIsHtml}
            paragraphContext={paragraphContext}
            originalHtml={originalHtml}
            allowedHtmlTagNames={allowedHtmlTagNames}
            onSelectionChange={(text) => {
              selectedSuggestion = text
            }}
          />
        )
        close()
        const confirmed = await confirm(dialogContent, t("ai-dialog-title-apply"), {
          confirmDisabled: true,
        })
        if (confirmed && selectedSuggestion) {
          try {
            const safeHtml = sanitizeParagraphHtml(selectedSuggestion, {
              allowedTagNames: allowedHtmlTagNames,
            })
            props.setAttributes({ content: safeHtml })
          } catch {
            toast.error(t("ai-action-failed"))
          }
        }
      } catch (_err) {
        toast.error(t("ai-action-failed"))
      } finally {
        setRunning(false)
      }
    }

    return (
      <Fragment>
        <BlockEdit {...props} />
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <BlockControls group="block">
          <ToolbarGroup>
            <Dropdown
              renderToggle={({ isOpen, onToggle }) => (
                <ToolbarButton
                  icon={<MagicWandSparkles />}
                  label={t("ai-toolbar-label")}
                  aria-expanded={isOpen}
                  onClick={() => {
                    setSubmenu(null)
                    onToggle()
                  }}
                  disabled={running}
                />
              )}
              renderContent={({ onClose }) => {
                const hasSubmenu = submenu !== null

                const sectionGroup =
                  submenu !== null && submenu !== SUBMENU_TONE && submenu !== SUBMENU_TRANSLATE
                    ? AI_GROUPS.find((group) => group.id === submenu)
                    : undefined

                const toneGroup = submenu === SUBMENU_TONE ? AI_TONE_SUBMENU : undefined
                const translateGroup =
                  submenu === SUBMENU_TRANSLATE ? AI_TRANSLATE_SUBMENU : undefined

                return (
                  <div
                    className={css`
                      display: flex;
                      align-items: stretch;
                      position: relative;
                    `}
                  >
                    <div
                      className={css`
                        min-width: 220px;
                        padding-right: 0.5rem;
                        border-right: ${hasSubmenu ? `1px solid ${BORDER_COLOR}` : "none"};
                      `}
                    >
                      <MenuGroup>
                        {AI_GROUPS.map((group) => (
                          <MenuItem
                            key={group.id}
                            onClick={() => {
                              setSubmenu(group.id)
                            }}
                            icon={chevronRight}
                            // eslint-disable-next-line i18next/no-literal-string
                            aria-haspopup="menu"
                            aria-expanded={submenu === group.id}
                          >
                            {t(group.labelKey as AiGroupLabelKey)}
                          </MenuItem>
                        ))}
                      </MenuGroup>
                      <MenuGroup>
                        <MenuItem
                          onClick={() => setSubmenu(SUBMENU_TONE)}
                          icon={chevronRight}
                          // eslint-disable-next-line i18next/no-literal-string
                          aria-haspopup="menu"
                          aria-expanded={submenu === SUBMENU_TONE}
                        >
                          {t("ai-submenu-tone-voice")}
                        </MenuItem>
                        <MenuItem
                          onClick={() => setSubmenu(SUBMENU_TRANSLATE)}
                          icon={chevronRight}
                          // eslint-disable-next-line i18next/no-literal-string
                          aria-haspopup="menu"
                          aria-expanded={submenu === SUBMENU_TRANSLATE}
                        >
                          {t("ai-submenu-translate")}
                        </MenuItem>
                      </MenuGroup>
                    </div>
                    {sectionGroup && (
                      <div
                        className={css`
                          min-width: 260px;
                          margin-left: 0.5rem;
                        `}
                      >
                        <MenuGroup label={t(sectionGroup.labelKey as AiGroupLabelKey)}>
                          {sectionGroup.actions.map((action) => (
                            <MenuItem
                              key={action.id}
                              onClick={() => {
                                void handleAction(action, onClose)
                              }}
                            >
                              {t(action.labelKey as AiActionLabelKey)}
                            </MenuItem>
                          ))}
                        </MenuGroup>
                      </div>
                    )}
                    {toneGroup && (
                      <div
                        className={css`
                          min-width: 260px;
                          margin-left: 0.5rem;
                        `}
                      >
                        <MenuGroup label={t("ai-submenu-tone-voice")}>
                          {toneGroup.actions.map((action) => (
                            <MenuItem
                              key={action.id}
                              onClick={() => {
                                void handleAction(action, onClose)
                              }}
                            >
                              {t(action.labelKey as AiActionLabelKey)}
                            </MenuItem>
                          ))}
                        </MenuGroup>
                      </div>
                    )}
                    {translateGroup && (
                      <div
                        className={css`
                          min-width: 260px;
                          margin-left: 0.5rem;
                        `}
                      >
                        <MenuGroup label={t("ai-submenu-translate")}>
                          {translateGroup.actions.map((action) => (
                            <MenuItem
                              key={action.id}
                              onClick={() => {
                                void handleAction(action, onClose)
                              }}
                            >
                              {t(action.labelKey as AiActionLabelKey)}
                            </MenuItem>
                          ))}
                        </MenuGroup>
                      </div>
                    )}
                  </div>
                )
              }}
            />
          </ToolbarGroup>
        </BlockControls>
      </Fragment>
    )
  }

  interface ParagraphAiSuggestionDialogProps {
    action: AiActionDefinition
    requestContent: string
    requestIsHtml: boolean
    paragraphContext: { page_id: string; course_id: string | null; locale: null } | null
    originalHtml: string
    allowedHtmlTagNames: Set<string>
    onSelectionChange?: (text: string) => void
  }

  const ParagraphAiSuggestionDialog = ({
    action,
    requestContent,
    requestIsHtml,
    paragraphContext,
    originalHtml,
    onSelectionChange,
  }: ParagraphAiSuggestionDialogProps) => {
    const { t } = useTranslation()
    const confirmDialogControls = useConfirmDialogControls()
    const [suggestions, setSuggestions] = useState<string[] | null>(null)
    const [error, setError] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => {
      confirmDialogControls?.setConfirmDisabled(suggestions === null || error)
    }, [confirmDialogControls, error, suggestions])

    useEffect(() => {
      let cancelled = false
      void (async () => {
        try {
          const result = await executeAbility<{ text: string; suggestions?: string[] }>(
            action.abilityName,
            {
              text: requestContent,
              isHtml: requestIsHtml,
              meta: {
                ...action.meta,
                context: paragraphContext,
              },
            },
          )
          if (cancelled) {
            return
          }
          const rawSuggestions =
            result.suggestions && result.suggestions.length > 0
              ? result.suggestions
              : [result.text ?? requestContent]
          const list = rawSuggestions.filter((s) => s.trim().length > 0)
          if (list.length === 0) {
            onSelectionChange?.("")
            setError(true)
            return
          }
          setSuggestions(list)
          onSelectionChange?.(list[0] ?? "")
        } catch {
          if (!cancelled) {
            onSelectionChange?.("")
            setError(true)
          }
        }
      })()
      return () => {
        cancelled = true
      }
    }, [action, requestContent, requestIsHtml, paragraphContext, onSelectionChange])

    const handleSelect = (index: number, text: string) => {
      setSelectedIndex(index)
      onSelectionChange?.(text)
    }

    if (suggestions === null && !error) {
      return (
        <div
          className={css`
            min-width: 220px;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 1.5rem;
          `}
        >
          <Spinner variant="small" disableMargin />
          <span
            className={css`
              margin-top: 0.5rem;
              font-size: 0.8rem;
              color: ${TEXT_COLOR};
            `}
          >
            {t("ai-loading")}
          </span>
        </div>
      )
    }

    if (error) {
      return (
        <div
          className={css`
            padding: 1rem;
            color: ${TEXT_COLOR};
            font-size: 0.9rem;
          `}
        >
          {t("ai-loading-error")}
        </div>
      )
    }

    const list = suggestions ?? []
    const hasMultiple = list.length > 1
    const originalText = extractPlainTextFromHtml(originalHtml)

    return (
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          max-height: 90vh;
          overflow-y: auto;
        `}
      >
        {originalText.trim().length > 0 && (
          <div
            className={css`
              padding: 0.75rem 1rem;
              border-radius: 4px;
              border: 1px solid ${BORDER_COLOR};
              background: #f9fafb;
              color: ${TEXT_COLOR};
              font-size: 0.9rem;
            `}
          >
            <span
              className={css`
                display: block;
                font-size: 0.75rem;
                font-weight: 600;
                margin-bottom: 0.35rem;
              `}
            >
              {t("ai-dialog-original-text")}
            </span>
            <p
              className={css`
                margin: 0;
                line-height: 1.5;
                white-space: pre-wrap;
                overflow-wrap: break-word;
              `}
            >
              {originalText}
            </p>
          </div>
        )}
        {list.map((suggestion, index) => {
          const suggestionText = extractPlainTextFromHtml(suggestion)
          const isSelected = selectedIndex === index

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(index, suggestion)}
              className={css`
                display: block;
                width: 100%;
                text-align: left;
                padding: 0.75rem 1rem;
                border-radius: 4px;
                border: 2px solid ${isSelected ? ACCENT_COLOR : BORDER_COLOR};
                background: #fff;
                color: inherit;
                cursor: pointer;
                white-space: pre-wrap;
                overflow-wrap: break-word;
                transition:
                  border-color 0.15s ease,
                  box-shadow 0.15s ease;
                &:hover {
                  border-color: ${isSelected ? ACCENT_COLOR : ACCENT_COLOR};
                  box-shadow: 0 0 0 1px ${BORDER_COLOR};
                }
              `}
            >
              {hasMultiple && (
                <span
                  className={css`
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 600;
                    margin-bottom: 0.35rem;
                    color: ${TEXT_COLOR};
                  `}
                >
                  {t("ai-dialog-label-suggestion-n", { number: index + 1 })}
                </span>
              )}
              <p
                className={css`
                  margin: 0;
                  font-size: inherit;
                  line-height: 1.5;
                `}
              >
                {suggestionText}
              </p>
            </button>
          )
        })}
      </div>
    )
  }

  ParagraphWithAiToolbar.displayName = "ParagraphWithAiToolbar"
  return ParagraphWithAiToolbar
  // eslint-disable-next-line i18next/no-literal-string
}, "withParagraphAiToolbarAction")

export default withParagraphAiToolbarAction
