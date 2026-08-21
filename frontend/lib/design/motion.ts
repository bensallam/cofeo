/**
 * Motion tokens for the `motion` package. Mirrors app/styles/tokens.css'
 * --ease-precise — CSS custom properties aren't readable by Motion's JS
 * transition config, so the same curve is duplicated here deliberately
 * as the one other place motion values are allowed to live.
 */
export const EASE_PRECISE = [0.22, 1, 0.36, 1] as const;

export const DURATION = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
} as const;

export const FADE_IN_UP = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION.base, ease: EASE_PRECISE },
} as const;

export const FADE_IN = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: DURATION.base, ease: EASE_PRECISE },
} as const;
