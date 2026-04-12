import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-white text-black hover:bg-white/90 shadow-lg shadow-black/30 border border-white",
  secondary:
    "border border-white/15 bg-white/[0.05] text-white hover:bg-white/10",
  ghost: "text-white/70 hover:text-white hover:bg-white/5 border border-transparent",
  danger:
    "border border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15",
};

const SIZE: Record<Size, string> = {
  xs: "px-2.5 py-1 text-[11px] gap-1.5",
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "secondary", size = "sm", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center rounded-full font-semibold tracking-wide transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...props}
    />
  );
});
