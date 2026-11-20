"use client";

import { useId, useMemo, useState } from "react";
import type * as React from "react";
import RS, { type Props as ReactSelectProps, type StylesConfig } from "react-select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  meta?: string;
}

export interface SelectProps {
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  triggerClassName?: string;
  align?: "start" | "end";
  invalid?: boolean;
  disabled?: boolean;
  /** Enable typeahead search when the option list is long enough. */
  searchable?: boolean;
}

type WorkoraSelect = React.ComponentType<ReactSelectProps<SelectOption, false>>;

const InnerSelect = RS as unknown as WorkoraSelect;

const BRAND = "#5a50e5";
const NEUTRAL_200 = "#e5e5e5";
const NEUTRAL_400 = "#a3a3a3";
const NEUTRAL_500 = "#737373";
const NEUTRAL_800 = "#262626";
const NEUTRAL_900 = "#171717";

const CONTROL_HEIGHT = 40;

function createStyles(invalid?: boolean): StylesConfig<SelectOption, false> {
  return {
    container: (base) => ({ ...base, width: "100%" }),
    control: (base, state) => ({
      ...base,
      minHeight: CONTROL_HEIGHT,
      height: CONTROL_HEIGHT,
      borderRadius: 8,
      border: `1px solid ${invalid ? "#fb7185" : state.isFocused ? BRAND : NEUTRAL_200}`,
      boxShadow: state.isFocused ? "0 0 0 2px rgba(90, 80, 229, 0.25)" : "none",
    }),
    valueContainer: (base) => ({ ...base, minHeight: CONTROL_HEIGHT, height: CONTROL_HEIGHT, padding: "0 12px" }),
    singleValue: (base) => ({ ...base, color: NEUTRAL_900, margin: 0 }),
    placeholder: (base) => ({ ...base, color: NEUTRAL_400, margin: 0 }),
    input: (base) => ({ ...base, margin: 0, padding: 0, width: "100%" }),
    indicatorsContainer: (base) => ({ ...base, height: CONTROL_HEIGHT }),
    indicatorSeparator: () => ({ display: "none" as const }),
    dropdownIndicator: (base, state) => ({ ...base, padding: 8, color: state.isFocused ? BRAND : NEUTRAL_400, "&:hover": { color: BRAND } }),
    menu: (base) => ({
      ...base,
      minWidth: 160,
      marginTop: 6,
      zIndex: 50,
      borderRadius: 8,
      border: `1px solid ${NEUTRAL_200}`,
      boxShadow: "0 20px 40px -12px rgba(0, 0, 0, 0.18)",
    }),
    menuList: (base) => ({ ...base, padding: 4, borderRadius: 8, maxHeight: 288 }),
    option: (base, state) => ({
      ...base,
      borderRadius: 6,
      fontSize: 14,
      padding: "8px 10px",
      backgroundColor: state.isSelected ? "#f0f0fe" : state.isFocused ? "#f5f5f5" : "transparent",
      color: state.isSelected ? "#3e36a6" : NEUTRAL_800,
      cursor: "pointer",
      "&:active": { backgroundColor: "#e4e3fd" },
    }),
    noOptionsMessage: (base) => ({ ...base, fontSize: 13, color: NEUTRAL_500, padding: 12 }),
  };
}

export function Select(props: SelectProps) {
  const { value, options, onChange, placeholder, ariaLabel, className, invalid, disabled, searchable, align } = props;
  const generatedId = useId();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? null;
  const searchableEnabled = searchable ?? options.length > 8;

  const styles = useMemo(() => createStyles(invalid), [invalid]);

  const formatOptionLabel = (option: SelectOption, _info: unknown) => {
    const current = option;
    const isSelectedFinal = current.value === value;
    return (
      <span className="flex min-w-0 flex-col">
        <span className={`truncate ${isSelectedFinal ? "font-medium text-brand-800" : "text-neutral-800"}`}>{current.label}</span>
        {current.meta ? <span className="truncate text-xs text-neutral-500">{current.meta}</span> : null}
      </span>
    );
  };

  return (
    <div className={cn("relative", className)}>
      <InnerSelect
        aria-label={ariaLabel}
        id={generatedId}
        instanceId={generatedId}
        isDisabled={disabled}
        isMulti={false}
        isSearchable={searchableEnabled}
        isClearable={false}
        value={selected}
        onChange={(option) => onChange((option as SelectOption | null)?.value ?? "")}
        placeholder={placeholder}
        styles={styles}
        formatOptionLabel={formatOptionLabel}
        menuIsOpen={open}
        onMenuOpen={() => setOpen(true)}
        onMenuClose={() => setOpen(false)}
        menuPlacement="bottom"
        options={options}
      />
    </div>
  );
}

/** Uncontrolled filter select for GET forms; the chosen value syncs to a hidden field via `name`. */
export function FilterSelect({
  name,
  defaultValue,
  label,
  className,
  options,
}: {
  name: string;
  defaultValue: string;
  label: string;
  className?: string;
  options: SelectOption[];
}) {
  const generatedId = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(defaultValue);
  const selected = options.find((o) => o.value === value) ?? null;

  const formatOptionLabel = (option: SelectOption, _info: unknown) => {
    const current = option;
    const isSelectedFinal = current.value === value;
    return (
      <span className="flex min-w-0 flex-col">
        <span className={`truncate ${isSelectedFinal ? "font-medium text-brand-800" : "text-neutral-800"}`}>{current.label}</span>
        {current.meta ? <span className="truncate text-xs text-neutral-500">{current.meta}</span> : null}
      </span>
    );
  };

  return (
    <div className={cn("relative", className)}>
      <InnerSelect
        aria-label={label}
        id={generatedId}
        instanceId={generatedId}
        isDisabled={false}
        isMulti={false}
        isSearchable={options.length > 8}
        isClearable={false}
        value={selected}
        onChange={(option) => setValue((option as SelectOption | null)?.value ?? null)}
        placeholder={label}
        styles={createStyles()}
        formatOptionLabel={formatOptionLabel}
        menuIsOpen={open}
        onMenuOpen={() => setOpen(true)}
        onMenuClose={() => setOpen(false)}
        menuPlacement="bottom"
        name={name}
        options={options}
      />
    </div>
  );
}
