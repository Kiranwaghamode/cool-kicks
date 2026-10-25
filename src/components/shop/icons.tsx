import type { ComponentProps } from "react";
import {
  Apple,
  CalendarHeart,
  Cherry,
  Citrus,
  CupSoda,
  Gift,
  Grape,
  GlassWater,
  IceCreamBowl,
  Leaf,
  Milk,
  Snowflake,
  Sun,
  TreePalm,
  Droplets,
  type LucideIcon,
} from "lucide-react";

/** Brand icons lucide doesn't ship. */
export function WhatsAppIcon(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 0 1-1.45-5.02c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.89.99 6.67 2.77a9.37 9.37 0 0 1 2.76 6.68c0 5.2-4.24 9.43-9.44 9.43m8.04-17.47A11.3 11.3 0 0 0 12.05.7C5.78.7.68 5.8.68 12.06c0 2 .52 3.96 1.52 5.68L.58 23.7l6.1-1.6a11.33 11.33 0 0 0 5.37 1.37h.01c6.26 0 11.36-5.1 11.36-11.37 0-3.03-1.18-5.89-3.33-8.04" />
    </svg>
  );
}

export function InstagramIcon(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M13.5 21v-7.5h2.53l.38-2.94H13.5V8.69c0-.85.24-1.43 1.46-1.43h1.55V4.63A20.6 20.6 0 0 0 14.25 4.5c-2.24 0-3.77 1.37-3.77 3.88v2.18H7.95v2.94h2.53V21z" />
    </svg>
  );
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "fresh-fruit-juices": Apple,
  "ice-juices": Snowflake,
  "mango-juice": Sun,
  "orange-juice": Citrus,
  "watermelon-juice": Cherry,
  "pineapple-juice": TreePalm,
  "grape-juice": Grape,
  "lemon-juice": Droplets,
  mojitos: Leaf,
  milkshakes: Milk,
  smoothies: CupSoda,
  falooda: IceCreamBowl,
  "seasonal-specials": CalendarHeart,
  "combos-offers": Gift,
};

export function CategoryIcon({ slug, ...props }: { slug: string } & ComponentProps<"svg">) {
  const Icon = CATEGORY_ICONS[slug] ?? GlassWater;
  return <Icon aria-hidden {...props} />;
}
