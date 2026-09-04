import { formatHHMM, parseHHMM, resolveI18n, type I18nText } from '@evolyx/shared';
import { translator, type Translator } from '../i18n/server.js';
import type { RuleRow } from './visibility.js';

/**
 * Le bandeau du moment : une phrase, composée par le serveur, qui dit au client ce qui
 * compte maintenant. L'ordre est celui du cahier des charges — promotions, plats qui
 * touchent à leur fin, plats épuisés — et si rien ne se signale, on rassure.
 *
 * `runningLow` reste vide au lot 1 : il n'y a pas de suivi de stock. Le point d'accroche
 * existe pour que le module Stock puisse alimenter la phrase sans toucher à ce fichier.
 */

export interface MomentInput {
  activePromos: { rule: RuleRow; endsAt: string | null }[];
  soldOut: { name: string }[];
  runningLow?: { name: string }[];
  locale?: string;
}

export function composeMomentBanner(
  input: MomentInput,
  t: Translator = translator(input.locale ?? 'fr'),
): string {
  const locale = input.locale ?? 'fr';
  const segments: string[] = [];

  // 1 — les promotions actives, la seule information qui fasse commander tout de suite.
  const seen = new Set<string>();
  for (const { rule, endsAt } of input.activePromos) {
    const label = resolveI18n(rule.label as I18nText, locale).trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    segments.push(
      endsAt
        ? t('moment.promoUntil', { label: stripTrailingDot(label), time: endsAt })
        : t('moment.promo', { label: stripTrailingDot(label) }),
    );
  }

  // 2 — ce qui va manquer.
  const low = input.runningLow ?? [];
  if (low.length === 1) {
    segments.push(t('moment.runningLow', { count: 1, name: low[0]!.name }));
  } else if (low.length > 1) {
    segments.push(t('moment.runningLow', { count: low.length }));
  }

  // 3 — ce qui manque déjà.
  if (input.soldOut.length === 1) {
    segments.push(t('moment.soldOut', { count: 1, name: input.soldOut[0]!.name }));
  } else if (input.soldOut.length > 1) {
    segments.push(t('moment.soldOut', { count: input.soldOut.length }));
  }

  if (segments.length === 0) return t('moment.allAvailable');
  return segments.join(' ');
}

/** Fin d'un créneau de promotion, en heure locale — « jusqu'à 19:00 ». */
export function promoEndLabel(rule: RuleRow): string | null {
  const end = parseHHMM(rule.endTime);
  return end === null ? null : formatHHMM(end);
}

const stripTrailingDot = (value: string): string => value.replace(/[.。]+$/, '');
