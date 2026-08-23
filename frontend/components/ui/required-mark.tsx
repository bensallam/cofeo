/**
 * The asterisk beside a required field's label — `aria-hidden` because
 * the actual "required" semantics live on the form control itself
 * (`aria-required="true"` / `required`, set by each field alongside
 * this), not on this decorative glyph. `ms-0.5` (margin-inline-start)
 * rather than a plain left margin keeps it immediately after the label
 * text in both LTR and RTL — a fixed-side margin would visually detach
 * it from the label under RTL instead of hugging it.
 */
export function RequiredMark() {
  return (
    <span className="ms-0.5 text-error" aria-hidden="true">
      *
    </span>
  );
}
