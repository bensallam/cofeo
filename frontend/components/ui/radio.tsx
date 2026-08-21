import * as React from "react";
import { cn } from "@/lib/design/cn";

type RadioProps = Omit<React.ComponentPropsWithoutRef<"input">, "id" | "type"> & {
  label: string;
  id?: string;
};

export function Radio({ label, id, className, ...props }: RadioProps) {
  const generatedId = React.useId();
  const radioId = id ?? generatedId;

  return (
    <label htmlFor={radioId} className="inline-flex items-center gap-2.5">
      <input
        id={radioId}
        type="radio"
        className={cn(
          "size-4 accent-text-primary",
          "disabled:pointer-events-none disabled:opacity-40",
          className || null,
        )}
        {...props}
      />
      <span className="text-body-s text-text-primary">{label}</span>
    </label>
  );
}
