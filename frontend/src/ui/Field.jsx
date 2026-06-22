/**
 * Field — labeled form control wrapper.
 *
 * Props:
 *   label    : string              — visible label text
 *   htmlFor  : string              — links label to the control's id
 *   error    : string | undefined  — error message shown in danger color
 *   children : ReactNode           — the input/select/textarea
 */

export function Field({ label, htmlFor, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium text-text"
        >
          {label}
        </label>
      )}

      {children}

      {error && (
        <p
          role="alert"
          className="text-sm text-danger"
        >
          {error}
        </p>
      )}
    </div>
  )
}
