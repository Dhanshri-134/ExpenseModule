"use client";

import { formatUsPhoneNumber } from "@/shared/utils/phone";

export function PhoneInput({
  value = "",
  onValueChange,
  className = "",
  placeholder = "(555) 555-5555",
  ...props
}) {
  return (
    <input
      {...props}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      className={className}
      value={formatUsPhoneNumber(value)}
      onChange={(event) => onValueChange?.(formatUsPhoneNumber(event.target.value))}
      placeholder={placeholder}
    />
  );
}
