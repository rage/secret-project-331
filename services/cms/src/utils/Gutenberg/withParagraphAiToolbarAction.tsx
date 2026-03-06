"use client"

import { css } from "@emotion/css"
import { MagicWandSparkles } from "@vectopus/atlas-icons-react"
import { BlockControls } from "@wordpress/block-editor"
import { Dropdown, MenuGroup, MenuItem, ToolbarButton, ToolbarGroup } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { Fragment, useState } from "@wordpress/element"
import { chevronRight } from "@wordpress/icons"
import { diffWords } from "diff"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

import { executeAbility } from "./ai/abilities"
import {
  AI_GROUPS,
  AI_TONE_SUBMENU,
  AI_TRANSLATE_SUBMENU,
  type AiActionDefinition,
  type AiActionGroupId,
} from "./ai/menu"

import DiffFormatter from "@/shared-module/common/components/DiffFormatter"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"

const PARAGRAPH_BLOCK_NAME = "core/paragraph"

const SUBMENU_TONE = "tone" as const
const SUBMENU_TRANSLATE = "translate" as const

type SubmenuState = AiActionGroupId | typeof SUBMENU_TONE | typeof SUBMENU_TRANSLATE | null

const WP_ADMIN_BORDER_COLOR = "var(--wp-admin-border-color, var(--wp-admin-theme-color-darker-20))"
const WP_ADMIN_SURFACE_COLOR =
  "var(--wp-components-color-background, var(--wp-admin-theme-color-darker-20))"
const WP_ADMIN_ACCENT_COLOR = "var(--wp-admin-theme-color, var(--wp-admin-theme-color-darker-10))"
const WP_ADMIN_ACCENT_SURFACE_COLOR =
  "var(--wp-admin-theme-color-darker-20, var(--wp-admin-theme-color))"
const WP_ADMIN_TEXT_COLOR =
  "var(--wp-components-color-foreground, var(--wp-admin-theme-color-darker-10))"

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

    if (props.name !== PARAGRAPH_BLOCK_NAME) {
      return <BlockEdit {...props} />
    }

    const handleAction = async (action: AiActionDefinition, close: () => void) => {
      const originalText =
        typeof props.attributes?.content === "string" ? props.attributes.content : ""

      setRunning(true)
      try {
        const result = await executeAbility<{ text: string; suggestions?: string[] }>(
          action.abilityName,
          {
            text: originalText,
            meta: action.meta,
          },
        )

        const rawSuggestions =
          result.suggestions && result.suggestions.length > 0
            ? result.suggestions
            : [result.text ?? originalText]

        const suggestions = rawSuggestions.filter((s) => s.trim().length > 0)

        if (suggestions.length === 0) {
          return
        }

        if (suggestions.length === 1 && suggestions[0] === originalText) {
          return
        }

        let selectedIndex = 0

        const dialogContent = (
          <ParagraphAiSuggestionDialog
            originalText={originalText}
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
          props.setAttributes({ content: finalText })
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
                        border-right: ${hasSubmenu ? `1px solid ${WP_ADMIN_BORDER_COLOR}` : "none"};
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
                            {t(group.labelKey as "ai-group-generate")}
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
                        <MenuGroup label={t(sectionGroup.labelKey as "ai-group-generate")}>
                          {sectionGroup.actions.map((action) => (
                            <MenuItem
                              key={action.id}
                              onClick={() => {
                                void handleAction(action, onClose)
                              }}
                            >
                              {t(action.labelKey as "ai-generate-draft-from-notes")}
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
                              {t(action.labelKey as "ai-tone-academic-formal")}
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
                              {t(action.labelKey as "ai-translate-english")}
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
    suggestions: string[]
    onSelectionChange?: (index: number) => void
  }

  const ParagraphAiSuggestionDialog = ({
    originalText,
    suggestions,
    onSelectionChange,
  }: ParagraphAiSuggestionDialogProps) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    const handleSelect = (index: number) => {
      setSelectedIndex(index)
      onSelectionChange?.(index)
    }

    const diffChanges = diffWords(originalText ?? "", suggestions[selectedIndex] ?? "")

    return (
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        `}
      >
        <div
          className={css`
            display: flex;
            flex-wrap: wrap;
            gap: 0.25rem;
          `}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(index)}
              className={css`
                padding: 0.15rem 0.4rem;
                border-radius: 2px;
                border: 1px solid
                  ${selectedIndex === index ? WP_ADMIN_ACCENT_COLOR : WP_ADMIN_BORDER_COLOR};
                background: ${selectedIndex === index
                  ? WP_ADMIN_ACCENT_SURFACE_COLOR
                  : WP_ADMIN_SURFACE_COLOR};
                color: ${WP_ADMIN_TEXT_COLOR};
                cursor: pointer;
                font-size: 11px;
              `}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <p
          className={css`
            white-space: pre-wrap;
            border: 1px solid ${WP_ADMIN_BORDER_COLOR};
            background: ${WP_ADMIN_SURFACE_COLOR};
            color: ${WP_ADMIN_TEXT_COLOR};
            padding: 0.5rem;
            margin: 0;
          `}
        >
          <DiffFormatter changes={diffChanges} />
        </p>
      </div>
    )
  }

  ParagraphWithAiToolbar.displayName = "ParagraphWithAiToolbar"
  return ParagraphWithAiToolbar
  // eslint-disable-next-line i18next/no-literal-string
}, "withParagraphAiToolbarAction")

export default withParagraphAiToolbarAction
