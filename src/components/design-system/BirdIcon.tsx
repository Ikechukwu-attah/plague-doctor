import type { SVGProps } from "react";

type BirdIconProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number;
  strokeWidth?: number;
};

/** The Plague Doctor bird glyph (from the design logo). Decorative: hidden from assistive tech. */
export function BirdIcon({ size = 34, strokeWidth = 1.8, ...rest }: BirdIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 34 34"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M6 13c0-5 4-9 9-9s8 4 8 8l9 9-11-2c-1 4-4 7-8 7-4 0-7-4-7-9z" />
      <circle cx="13" cy="12" r="2.4" />
    </svg>
  );
}
