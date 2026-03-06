"use client"

import { css } from "@emotion/css"
import { MagicWandSparkles } from "@vectopus/atlas-icons-react"
import { BlockControls } from "@wordpress/block-editor"
import { Dropdown, MenuGroup, MenuItem, ToolbarButton, ToolbarGroup } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { Fragment, useState } from "@wordpress/element"
import { chevronRight } from "@wordpress/icons"
import { diffWords } from "diff"
import { useContext } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

import PageContext from "../../contexts/PageContext"
import {
  createParagraphAiSource,
  extractPlainTextFromHtml,
  hasMeaningfulParagraphSuggestionChange,
} from "../Gutenberg/paragraphAiSource"
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

import DiffFormatter from "@/shared-module/common/components/DiffFormatter"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
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
      const { originalText, requestContent, requestIsHtml } = paragraphSource
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

        const rawSuggestions =
          result.suggestions && result.suggestions.length > 0
            ? result.suggestions
            : [result.text ?? requestContent]

        const suggestions = rawSuggestions.filter((s) => s.trim().length > 0)

        if (suggestions.length === 0) {
          return
        }

        if (
          suggestions.length === 1 &&
          !hasMeaningfulParagraphSuggestionChange(originalHtml, suggestions[0] ?? "")
        ) {
          return
        }

        let selectedIndex = 0

        const dialogContent = (
          <ParagraphAiSuggestionDialog
            originalText={originalText}
            originalHtml={originalHtml}
            allowedHtmlTagNames={allowedHtmlTagNames}
            suggestions={suggestions}
            onSelectionChange={(index) => {
              selectedIndex = index
            }}
          />
        )

        close()

        const confirmed = await confirm(dialogContent, t("ai-dialog-title-apply"))

        if (confirmed) {
          const finalText = suggestions[selectedIndex] ?? suggestions[0]
          try {
            const safeHtml = sanitizeParagraphHtml(finalText, {
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
    originalText: string
    originalHtml: string
    allowedHtmlTagNames: Set<string>
    suggestions: string[]
    onSelectionChange?: (index: number) => void
  }

  const ParagraphAiSuggestionDialog = ({
    originalText,
    originalHtml: _originalHtml,
    allowedHtmlTagNames: _allowedHtmlTagNames,
    suggestions,
    onSelectionChange,
  }: ParagraphAiSuggestionDialogProps) => {
    const { t } = useTranslation()
    const [selectedIndex, setSelectedIndex] = useState(0)

    const handleSelect = (index: number) => {
      setSelectedIndex(index)
      onSelectionChange?.(index)
    }

    const hasMultiple = suggestions.length > 1

    return (
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        `}
      >
        {suggestions.map((suggestion, index) => {
          const suggestionText = extractPlainTextFromHtml(suggestion)
          const diffChanges = diffWords(originalText ?? "", suggestionText)
          const isSelected = selectedIndex === index

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(index)}
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
                <DiffFormatter changes={diffChanges} dontShowAdded />
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
