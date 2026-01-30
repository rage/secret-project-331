"use client"

import { css, cx } from "@emotion/css"
import { CheckCircle, MovementArrowsUpDown, XmarkCircle } from "@vectopus/atlas-icons-react"
import { forwardRef, InputHTMLAttributes, SetStateAction, useState } from "react"
import {
  Autocomplete,
  Button,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SearchField,
  Select,
  SelectValue,
  useFilter,
} from "react-aria-components"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../styles"
import { primaryFont } from "../../styles/typography"

import SearchIcon from "@/shared-module/common/img/search-icon.svg"

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SearchableSelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: SelectOption[]
  error?: string
  value?: string
  onChangeByValue?: (value: string) => void
  className?: string
  placeholder?: string
}

const SearchableSelectField = forwardRef<HTMLDivElement, SearchableSelectProps>(
  ({ value, label, options, onChangeByValue, placeholder, required }, ref) => {
    // eslint-disable-next-line i18next/no-literal-string
    const { contains } = useFilter({ sensitivity: "base" })
    const [, setIsOpen] = useState(false)
    const [searchInput, setSearchInput] = useState("")
    const { t } = useTranslation()

    const handleInputChange = (e: { target: { value: SetStateAction<string> } }) => {
      setSearchInput(e.target.value)
    }
    const handleClear = () => {
      setSearchInput("")
    }

    return (
      <Select
        ref={ref}
        placeholder={placeholder}
        selectedKey={value}
        onSelectionChange={(selected) => {
          const newValue = String(selected)
          onChangeByValue?.(newValue)
        }}
        className={css`
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          width: 250px;
          margin-bottom: 1rem;
        `}
      >
        <Label
          className={cx(css`
            color: ${baseTheme.colors.gray[600]};
            font-family: ${primaryFont};
            font-weight: 500;
            font-size: ${baseTheme.fontSizes[0]}px;
            display: block;
            margin-bottom: 2px;
          `)}
        >
          {label}
          {required === true && ` *`}
        </Label>
        <Button
          onClick={() => setIsOpen((isOpen) => !isOpen)}
          className={css`
            display: flex;
            align-items: center;
            cursor: pointer;
            border-radius: 0.5rem;
            border: 0;
            background: ${baseTheme.colors.primary[100]};

            padding: 0.5rem 0.5rem 0.5rem 0.5rem;
            font-size: ${baseTheme.fontSizes[1]}px;
            text-align: left;
            line-height: 1.5;
            box-shadow:
              0 4px 6px -1px rgba(0, 0, 0, 0.1),
              0 2px 4px -2px rgba(0, 0, 0, 0.05),
              inset 0 0 0 1px rgba(0, 0, 0, 0.05);
            &:focus-visible {
              outline: 2px solid black;
              outline-offset: 3px;
              box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.25);
            }
          `}
        >
          <SelectValue
            className={css`
              flex: 1;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              color: ${baseTheme.colors.primary[200]};
            `}
          >
            {({ defaultChildren, isPlaceholder }) => (
              <div
                className={css`
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                  justify-content: space-between;
                `}
              >
                {isPlaceholder && placeholder ? placeholder : defaultChildren}
                <MovementArrowsUpDown
                  size={14}
                  className={css`
                    color: ${baseTheme.colors.gray[400]};
                  `}
                />
              </div>
            )}
          </SelectValue>
        </Button>

        <Popover
          shouldFlip={false}
          className={css`
            max-height: 20rem;
            width: var(--trigger-width);
            display: flex;
            flex-direction: column;
            border-radius: 0.375rem;
            background-color: white;
            font-size: ${baseTheme.fontSizes[1]}px;
            box-shadow:
              0 10px 15px -3px rgba(0, 0, 0, 0.1),
              0 4px 6px -2px rgba(0, 0, 0, 0.05),
              inset 0 0 0 1px rgba(0, 0, 0, 0.05);
          `}
        >
          <Autocomplete filter={contains}>
            <SearchField
              aria-label={t("label-search")}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              className={css`
                display: flex;
                align-items: center;
                background: white;
                border: 2px solid ${baseTheme.colors.clear[400]};
                border-radius: 9999px;
                margin: 0.25rem;

                &:focus-within {
                  border-color: ${baseTheme.colors.green[400]};
                }
              `}
            >
              <SearchIcon
                className={css`
                  width: 1rem;
                  height: 1rem;
                  margin-left: 0.5rem;
                  color: ${baseTheme.colors.gray[100]};
                `}
              />
              <Input
                value={searchInput}
                onChange={handleInputChange}
                placeholder={placeholder ?? t("label-search")}
                className={css`
                  padding: 0.25rem 0.5rem;
                  flex: 1;
                  min-width: 0;
                  border: none;
                  outline: none;
                  background: white;
                  font-size: ${baseTheme.fontSizes[1]}px;
                  color: ${baseTheme.colors.gray[500]};

                  border-radius: 9999px;

                  ::placeholder {
                    color: ${baseTheme.colors.gray[300]};
                  }

                  ::-webkit-search-cancel-button {
                    display: none;
                  }
                `}
              />
              {searchInput && (
                <Button
                  onClick={handleClear}
                  className={css`
                    text-align: center;
                    justify-content: center;
                    border: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: ${baseTheme.colors.gray[500]};
                    background: transparent;
                    transition: background-color 0.2s ease;
                    margin-right: 0.25rem;
                    width: 2rem;
                    height: 2rem;
                  `}
                >
                  <XmarkCircle
                    className={css`
                      border-radius: 9999px;

                      &:hover {
                        background-color: ${baseTheme.colors.gray[200]};
                      }

                      &:active {
                        background-color: ${baseTheme.colors.gray[200]};
                      }
                    `}
                  />
                </Button>
              )}
            </SearchField>
            <ListBox
              items={options}
              className={css`
                padding: 0.25rem;
                overflow: auto;
                flex: 1;
                max-height: 20rem;
              `}
            >
              {(item) => (
                <ListBoxItem
                  key={item.value}
                  id={item.value}
                  textValue={item.label}
                  className={css`
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    user-select: none;
                    padding: 0.5rem 1rem;
                    border-radius: 0.25rem;
                    color: ${baseTheme.colors.primary[200]};

                    &:hover {
                      background-color: ${baseTheme.colors.green[600]};
                      color: white;
                    }
                    &:hover .icon {
                      color: white;
                    }
                  `}
                >
                  {({ isSelected }) => (
                    <>
                      <span
                        className={css`
                          display: flex;
                          flex: 1;
                          align-items: center;
                          gap: 0.5rem;
                          white-space: nowrap;
                          overflow: hidden;
                          text-overflow: ellipsis;
                        `}
                      >
                        {item.label}
                      </span>
                      <span
                        className={cx(
                          "icon",
                          css`
                            width: 1.25rem;
                            display: flex;
                            align-items: center;
                            justify-content: flex-end;
                            color: ${isSelected ? "#0284c7" : "transparent"};
                          `,
                        )}
                      >
                        {isSelected && <CheckCircle />}
                      </span>
                    </>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
          </Autocomplete>
        </Popover>
      </Select>
    )
  },
)

SearchableSelectField.displayName = "SearchableSelectField"

export default SearchableSelectField
