/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { CheckCircle, MovementArrowsUpDown, XmarkCircle } from "@vectopus/atlas-icons-react"
import { forwardRef, InputHTMLAttributes, useState } from "react"
import {
  Autocomplete,
  Button,
  Input,
  ListBox,
  ListBoxItem,
  Popover,
  SearchField,
  Select,
  SelectValue,
  useFilter,
} from "react-aria-components"

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
}

const SearchableSelectField = forwardRef<HTMLSelectElement, SearchableSelectProps>(
  ({ value, label, options, onChangeByValue }) => {
    const { contains } = useFilter({ sensitivity: "base" })
    const [, setIsOpen] = useState(false)
    return (
      <Select
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
        `}
      >
        <label>{label}</label>
        <Button
          onClick={() => setIsOpen((isOpen) => !isOpen)}
          className={css`
            display: flex;
            align-items: center;
            cursor: default;
            border-radius: 0.75rem;
            border: 0;
            background: rgba(255, 255, 255, 0.9);
            transition: background-color 0.2s ease;
            padding: 0.5rem 1.25rem 0.5rem 0.5rem;
            font-size: 1rem;
            text-align: left;
            line-height: 1.5;
            box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.1);
            color: #4a4a4a;
            &:focus-visible {
              outline: 2px solid black;
              outline-offset: 3px;
            }
          `}
        >
          <SelectValue
            className={css`
              flex: 1;
              overflow: hidden;
              text-overflow: ellipsis;
            `}
          />
          <MovementArrowsUpDown />
        </Button>

        <Popover
          className={css`
            max-height: 20rem !important;
            width: var(--trigger-width);
            display: flex;
            flex-direction: column;
            border-radius: 0.375rem;
            background-color: white;
            font-size: 1rem;
            box-shadow:
              0 10px 15px -3px rgba(0, 0, 0, 0.1),
              0 4px 6px -2px rgba(0, 0, 0, 0.05);
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05);
          `}
        >
          <Autocomplete filter={contains}>
            <SearchField
              aria-label="Search"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              className={css`
                display: flex;
                align-items: center;
                background: white;
                border: 2px solid #d1d5db;
                border-radius: 9999px;
                margin: 0.25rem;
                padding: 0.5rem;
                &:focus {
                  border-color: #38bdf8;
                }
              `}
            >
              <SearchIcon />
              <Input
                placeholder="Search languages"
                className={css`
                  padding: 0.25rem 0.5rem;
                  flex: 1;
                  min-width: 0;
                  border: none;
                  outline: none;
                  background: white;
                  font-size: 1rem;
                  color: #4b5563;
                  ::placeholder {
                    color: #6b7280;
                  }
                `}
              />
              <Button
                className={css`
                  font-size: 0.875rem;
                  text-align: center;
                  border: 0;
                  padding: 0.25rem;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: #4b5563;
                  background: transparent;
                  transition: background-color 0.2s ease;
                  &:hover {
                    background-color: rgba(0, 0, 0, 0.05);
                  }
                  &:active {
                    background-color: rgba(0, 0, 0, 0.1);
                  }
                `}
              >
                <XmarkCircle />
              </Button>
            </SearchField>
            <ListBox
              items={options}
              className={css`
                outline: none;
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
                    cursor: default;
                    user-select: none;
                    padding: 0.5rem 1rem;
                    outline: none;
                    border-radius: 0.25rem;
                    color: #1f2937;
                    &:focus {
                      background-color: #0284c7;
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
                          font-weight: normal;

                          .group-selected & {
                            font-weight: 500;
                          }
                        `}
                      >
                        {item.label}
                      </span>
                      <span
                        className={css`
                          width: 1.25rem;
                          display: flex;
                          align-items: center;
                          color: #0284c7;
                          .group:focus & {
                            color: white;
                          }
                        `}
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
