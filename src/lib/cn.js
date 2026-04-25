import clsx from "clsx";

// Tiny wrapper so consumers don't need to import clsx everywhere.
export function cn(...inputs) {
  return clsx(inputs);
}
