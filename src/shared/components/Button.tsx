import { ComponentProps } from "react";
import { ClassNameValue, twJoin } from "tailwind-merge";
import { Link } from "wasp/client/router";

type ButtonSize = "md" | "sm" | "xs";
type ButtonVariant = "primary" | "danger" | "ghost";

interface ButtonProps extends ComponentProps<"button"> {
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export function Button({
  children,
  className,
  type = "button",
  size = "md",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={getButtonClasses({
        size,
        variant,
        className,
      })}
      {...props}
    >
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function ButtonLink({
  children,
  className,
  size = "md",
  variant = "primary",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={getButtonClasses({
        size,
        variant,
        className,
      })}
      {...props}
    >
      {children}
    </Link>
  );
}

function getButtonClasses({
  size,
  variant,
  className,
}: {
  size: ButtonSize;
  variant: ButtonVariant;
  className: ClassNameValue;
}): string {
  return twJoin(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-[13px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-60",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

const sizeStyles: Record<ButtonSize, ClassNameValue> = {
  md: "px-3.5 py-2",
  sm: "px-3 py-1.5 text-xs",
  xs: "px-2.5 py-1 text-xs",
};

const variantStyles: Record<ButtonVariant, ClassNameValue> = {
  primary:
    "border-transparent bg-primary-600 text-white shadow-sm hover:bg-primary-700 active:bg-primary-800",
  danger: "border-transparent bg-danger text-white shadow-sm hover:bg-red-600 active:bg-red-700",
  ghost:
    "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 hover:shadow-sm active:bg-neutral-50",
};
