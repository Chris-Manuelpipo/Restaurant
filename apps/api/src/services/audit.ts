import { asSystem } from '../db/index.js';

/**
 * Journal d'audit.
 *
 * On journalise ce qui coûte cher à reconstituer : un prix qui bouge, un plat qu'on éteint,
 * une charte qu'on modifie, un code QR qu'on révoque, un compte qu'on crée ou désactive.
 * Le `diff` ne garde que les champs qui ont changé — un journal illisible ne sert personne.
 *
 * L'écriture passe en mode système : le journal doit aboutir même quand l'action a été
 * refusée en aval, et il ne doit jamais faire échouer l'opération qu'il observe.
 */

export type AuditAction =
  | 'price.changed'
  | 'item.status_changed'
  | 'item.created'
  | 'item.updated'
  | 'item.archived'
  | 'category.created'
  | 'category.updated'
  | 'category.archived'
  | 'theme.updated'
  | 'restaurant.updated'
  | 'rule.created'
  | 'rule.updated'
  | 'rule.deleted'
  | 'access_point.created'
  | 'access_point.updated'
  | 'access_point.revoked'
  | 'user.created'
  | 'user.updated'
  | 'user.deactivated'
  | 'restaurant.created'
  | 'restaurant.status_changed'
  | 'restaurant.modules_changed';

export interface AuditInput {
  restaurantId: string | null;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  /** Champs à journaliser ; par défaut, ceux qui diffèrent. */
  fields?: string[];
}

/** Réduit deux états au strict nécessaire : les champs qui ont réellement bougé. */
export function diffOf(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  fields?: string[],
): { before: Record<string, unknown>; after: Record<string, unknown>; changed: string[] } {
  const keys = fields ?? [
    ...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]),
  ];

  const beforeDiff: Record<string, unknown> = {};
  const afterDiff: Record<string, unknown> = {};
  const changed: string[] = [];

  for (const key of keys) {
    const previous = before?.[key];
    const next = after?.[key];
    if (stable(previous) === stable(next)) continue;
    changed.push(key);
    if (before) beforeDiff[key] = previous ?? null;
    if (after) afterDiff[key] = next ?? null;
  }

  return { before: beforeDiff, after: afterDiff, changed };
}

const stable = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value ?? null);
};

/**
 * Écrit une entrée d'audit. Ne lève jamais : un journal en panne ne doit pas empêcher un
 * gérant de marquer un plat épuisé en plein service. L'échec est signalé par la valeur de
 * retour, à charge de l'appelant de le remonter dans ses logs s'il le souhaite.
 */
export async function recordAudit(input: AuditInput): Promise<boolean> {
  const { before, after, changed } = diffOf(input.before, input.after, input.fields);
  if (changed.length === 0 && input.before !== undefined && input.after !== undefined) {
    return true; // rien n'a bougé : pas de ligne de bruit dans le journal
  }

  try {
    await asSystem((db) =>
      db.auditLog.create({
        data: {
          restaurantId: input.restaurantId,
          userId: input.userId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          diff: { before, after, changed } as never,
        },
      }),
    );
    return true;
  } catch (error) {
    console.error('[audit] écriture impossible', error);
    return false;
  }
}
