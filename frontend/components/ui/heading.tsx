import { cn } from "@/lib/design/cn";

const SIZE_CLASSES = {
  display: "text-display font-semibold tracking-tight",
  xl: "text-heading-xl font-semibold tracking-tight",
  l: "text-heading-l font-semibold tracking-tight",
  m: "text-heading-m font-medium",
  s: "text-heading-s font-medium",
} as const;

type HeadingSize = keyof typeof SIZE_CLASSES;

type HeadingProps = React.ComponentPropsWithoutRef<
  "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
> & {
  /** Semantic level — kept independent of visual `size` so hierarchy
   * (h1 > h2 > h3...) doesn't have to match the desired visual weight. */
  level: 1 | 2 | 3 | 4 | 5 | 6;
  size?: HeadingSize;
};

export function Heading({
  level,
  size = "l",
  className,
  children,
  ...props
}: HeadingProps) {
  const Tag = `h${level}` as const;
  return (
    <Tag className={cn("text-text-primary", SIZE_CLASSES[size], className || null)} {...props}>
      {children}
    </Tag>
  );
}
