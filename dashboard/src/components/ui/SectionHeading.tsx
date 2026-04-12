import type { ReactNode } from "react";
import clsx from "clsx";

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  icon,
  actions,
  className,
}: Props) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className="flex items-start gap-4">
        {icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/85 shadow-inner shadow-black/40">
            {icon}
          </div>
        )}
        <div className="space-y-1.5">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {title}
          </h2>
          {description && (
            <p className="max-w-2xl text-sm leading-relaxed text-white/55">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
