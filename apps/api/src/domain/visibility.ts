import { parseHHMM, zonedParts } from '@evolyx/shared';

/**
 * Visibilité d'un plat à un instant donné, dans le fuseau du restaurant.
 *
 * Un plat est visible si et seulement si :
 *  1. il n'est ni archivé ni désactivé ;
 *  2. sa catégorie est visible et non archivée ;
 *  3. aucune règle VISIBILITY ne le concerne, **ou** au moins une le concerne et correspond
 *     à l'instant demandé ;
 *  4. aucune règle HIDE posée sur lui **ou** sur sa catégorie ne correspond à l'instant ;
 *  5. `SOLD_OUT` reste visible — marqué épuisé, jamais masqué : le client doit savoir ce que
 *     la maison sert d'habitude.
 *
 * Une règle VISIBILITY posée sur une catégorie s'applique à tous ses plats ; une règle
 * VISIBILITY posée sur un plat l'emporte sur celle de sa catégorie.
 *
 * Les règles HIDE, elles, s'additionnent au lieu de se remplacer : masquer les grillades le
 * dimanche midi masque chacune d'elles, quelles que soient leurs propres règles. Un masquage
 * l'emporte toujours sur une visibilité — c'est la consigne la plus prudente des deux.
 */

export type RuleTargetType = 'CATEGORY' | 'ITEM';
export type RuleKind = 'VISIBILITY' | 'HIDE' | 'PROMO';

export interface RuleRow {
  id: string;
  targetType: RuleTargetType;
  targetId: string;
  kind: RuleKind;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  label?: unknown;
  discountPercent?: number | null;
}

export interface CategoryRow {
  id: string;
  isVisible: boolean;
  archivedAt: Date | null;
}

export interface ItemRow {
  id: string;
  categoryId: string;
  status: 'AVAILABLE' | 'SOLD_OUT' | 'DISABLED';
  archivedAt: Date | null;
}

export interface VisibilityContext {
  at: Date;
  timezone: string;
  rules: RuleRow[];
}

const DAY = 24 * 60;

/**
 * Un créneau correspond-il à l'instant demandé ?
 *
 * Le créneau peut passer minuit (22:00 → 02:00). Dans ce cas le jour de la règle désigne le
 * jour où le créneau **commence** : une promo « samedi 22:00 → 02:00 » est encore active le
 * dimanche à 01:00.
 */
export function ruleMatches(rule: RuleRow, at: Date, timezone: string): boolean {
  const { weekday, minutesOfDay } = zonedParts(at, timezone);
  const start = parseHHMM(rule.startTime);
  const end = parseHHMM(rule.endTime);
  if (start === null || end === null || start === end) return false;
  if (rule.daysOfWeek.length === 0) return false;

  if (end > start) {
    return rule.daysOfWeek.includes(weekday) && minutesOfDay >= start && minutesOfDay < end;
  }

  // Créneau à cheval sur minuit : la fin de soirée du jour J, puis le petit matin de J+1.
  const yesterday = (((weekday - 1) % 7) + 7) % 7;
  if (rule.daysOfWeek.includes(weekday) && minutesOfDay >= start) return true;
  if (rule.daysOfWeek.includes(yesterday) && minutesOfDay < end % DAY) return true;
  return false;
}

/** Règles s'appliquant à un plat : les siennes en priorité, sinon celles de sa catégorie. */
export function rulesFor(
  item: Pick<ItemRow, 'id' | 'categoryId'>,
  rules: RuleRow[],
  kind: RuleKind,
): RuleRow[] {
  const own = rules.filter((r) => r.kind === kind && r.targetType === 'ITEM' && r.targetId === item.id);
  if (own.length > 0) return own;
  return rules.filter(
    (r) => r.kind === kind && r.targetType === 'CATEGORY' && r.targetId === item.categoryId,
  );
}

/** Une règle HIDE visant cette cible est-elle en cours ? */
function isHiddenNow(
  targetType: RuleTargetType,
  targetId: string,
  context: VisibilityContext,
): boolean {
  return context.rules.some(
    (r) =>
      r.kind === 'HIDE' &&
      r.targetType === targetType &&
      r.targetId === targetId &&
      ruleMatches(r, context.at, context.timezone),
  );
}

export function isCategoryVisible(category: CategoryRow, context: VisibilityContext): boolean {
  if (category.archivedAt !== null) return false;
  if (!category.isVisible) return false;
  if (isHiddenNow('CATEGORY', category.id, context)) return false;

  const rules = context.rules.filter(
    (r) => r.kind === 'VISIBILITY' && r.targetType === 'CATEGORY' && r.targetId === category.id,
  );
  if (rules.length === 0) return true;
  return rules.some((rule) => ruleMatches(rule, context.at, context.timezone));
}

export function isItemVisible(
  item: ItemRow,
  category: CategoryRow | undefined,
  context: VisibilityContext,
): boolean {
  if (item.archivedAt !== null) return false;
  if (item.status === 'DISABLED') return false;

  // Sans catégorie retrouvée, on masque : un plat orphelin ne doit pas apparaître au client.
  if (!category) return false;
  if (category.archivedAt !== null || !category.isVisible) return false;

  // Le masquage passe avant tout : celui du plat comme celui de sa catégorie.
  if (isHiddenNow('ITEM', item.id, context)) return false;
  if (isHiddenNow('CATEGORY', category.id, context)) return false;

  const rules = rulesFor(item, context.rules, 'VISIBILITY');
  if (rules.length === 0) {
    // Pas de règle propre au plat : la catégorie peut malgré tout être sous contrainte horaire.
    return isCategoryVisible(category, context);
  }
  return rules.some((rule) => ruleMatches(rule, context.at, context.timezone));
}

/** Promotions actives à l'instant demandé, pour affichage sur la carte. */
export function activePromos(
  item: Pick<ItemRow, 'id' | 'categoryId'>,
  context: VisibilityContext,
): RuleRow[] {
  return rulesFor(item, context.rules, 'PROMO').filter((rule) =>
    ruleMatches(rule, context.at, context.timezone),
  );
}
