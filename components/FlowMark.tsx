type FlowMarkProps = {
  className?: string;
  label?: string;
};

export function FlowMark({ className, label }: FlowMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      {label && <title>{label}</title>}
      <path d="M7 9h6c4 0 6 2 6 6v2c0 4 2 6 6 6" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="7" cy="9" r="2.35" fill="var(--flow-node, currentColor)" />
      <circle cx="19" cy="16" r="2.35" fill="var(--flow-node, currentColor)" />
      <circle cx="25" cy="23" r="2.35" fill="var(--flow-node, currentColor)" />
    </svg>
  );
}
