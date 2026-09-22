"use client";
import { useId, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
export function PasswordInput({ id, ...props }: Omit<ComponentProps<"input">, "type">) {
  const generated = useId();
  const inputId = id ?? generated;
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-control">
      <input {...props} id={inputId} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={inputId}
        aria-pressed={visible}
        disabled={props.disabled}
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </span>
  );
}
