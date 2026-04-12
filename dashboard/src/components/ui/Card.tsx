import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";

type CardTone = "default" | "muted" | "inset";

const TONE: Record<CardTone, string> = {
  default:
    "border-white/10 bg-white/[0.035] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.85)] backdrop-blur-2xl",
  muted:
    "border-white/10 bg-white/[0.02] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.7)] backdrop-blur-xl",
  inset: "border-white/10 bg-black/25 backdrop-blur",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, tone = "default", ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={clsx(
        "relative overflow-hidden rounded-3xl border",
        TONE[tone],
        className
      )}
      {...props}
    />
  );
});

export function CardHeader({
  className,
  eyebrow,
  title,
  description,
  icon,
  actions,
}: {
  className?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      className={clsx(
        "flex items-start justify-between gap-4 px-6 pt-6",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/80 shadow-inner shadow-black/30">
            {icon}
          </div>
        )}
        <div className="space-y-1">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h3 className="text-lg font-semibold tracking-tight text-white">
            {title}
          </h3>
          {description && (
            <p className="max-w-xl text-xs leading-relaxed text-white/55">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions}
    </div>
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("px-6 pb-6 pt-4", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-6 py-4 text-xs text-white/55",
        className
      )}
      {...props}
    />
  );
}
