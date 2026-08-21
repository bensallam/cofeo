type ProcessStepProps = {
  step: number;
  label: string;
};

export function ProcessStep({ step, label }: ProcessStepProps) {
  return (
    <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
      <span className="text-caption tabular-nums text-text-muted">
        {String(step).padStart(2, "0")}
      </span>
      <span className="text-body-s font-medium text-text-primary">{label}</span>
    </div>
  );
}
