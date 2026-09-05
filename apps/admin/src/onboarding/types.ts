import type { ThemeInput } from '@evolyx/shared';

/** Le restaurant tel que le manipule la mise en service. */
export interface RestaurantDraft {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  theme: ThemeInput;
  timezone: string;
  currency: string;
  defaultLocale: string;
  enabledLocales: string[];
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  socials: Record<string, string>;
  openingHours: OpeningHourDraft[];
  onboardingStep: number;
  onboardingCompletedAt: string | null;
}

export interface OpeningHourDraft {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface StepProps {
  draft: RestaurantDraft;
  onChange: (draft: RestaurantDraft) => void;
  onNext: (patch?: Partial<RestaurantDraft>) => Promise<void>;
  busy?: boolean;
}

/** Une semaine par défaut, plausible : mieux vaut cela qu'un restaurant affiché fermé. */
export const DEFAULT_WEEK: OpeningHourDraft[] = [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => ({
  dayOfWeek,
  isOpen: true,
  openTime: '11:00',
  closeTime: '22:00',
}));
