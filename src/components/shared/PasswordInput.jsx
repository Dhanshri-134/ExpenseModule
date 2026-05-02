"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/dashboard/icons";

export default function PasswordInput({
  value,
  onChange,
  className = "acm-input",
  inputClassName = "",
  buttonClassName = "",
  ...props
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${className}`.trim()}>
      <input
        {...props}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        className={`w-full bg-transparent pr-12 outline-none ${inputClassName}`.trim()}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className={`absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center text-[color:var(--acm-muted-fg)] ${buttonClassName}`.trim()}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
      </button>
    </div>
  );
}
