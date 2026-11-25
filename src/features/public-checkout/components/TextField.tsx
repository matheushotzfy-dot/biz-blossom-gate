import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "id"> {
  id: string;
  label: ReactNode;
  optional?: boolean;
  error?: string;
  hint?: string;
  onValue: (value: string) => void;
  trailing?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, optional, error, hint, onValue, trailing, className, ...rest },
  ref,
) {
  const message = error || hint;
  return (
    <div className="ck-field">
      <label className="ck-label" htmlFor={id}>
        {label}
        {optional && <span className="ck-opt"> (opcional)</span>}
      </label>
      <div className="ck-inbox">
        <input
          ref={ref}
          id={id}
          className={`ck-input${className ? ` ${className}` : ""}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? `${id}-msg` : undefined}
          onChange={(event) => onValue(event.target.value)}
          {...rest}
        />
        {trailing}
      </div>
      {message && (
        <p id={`${id}-msg`} className="ck-msg" data-tone={error ? "error" : undefined}>
          {message}
        </p>
      )}
    </div>
  );
});
