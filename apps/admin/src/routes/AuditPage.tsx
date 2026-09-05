import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, EmptyState, Spin } from '@evolyx/ui';
import { formatAmount, type AuditEntry } from '@evolyx/shared';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';

/**
 * Journal.
 *
 * Il répond à une question précise, celle qu'on se pose six mois plus tard : « qui a changé
 * ce prix, et quand ? ». D'où la mise en forme des différences plutôt qu'un dépôt de JSON.
 */

const ACTION_LABELS: Record<string, string> = {
  'price.changed': 'Prix modifié',
  'item.status_changed': 'Disponibilité changée',
  'item.created': 'Plat créé',
  'item.updated': 'Plat modifié',
  'item.archived': 'Plat archivé',
  'category.created': 'Catégorie créée',
  'category.updated': 'Catégorie modifiée',
  'category.archived': 'Catégorie archivée',
  'theme.updated': 'Charte modifiée',
  'restaurant.updated': 'Fiche modifiée',
  'rule.created': 'Règle créée',
  'rule.updated': 'Règle modifiée',
  'rule.deleted': 'Règle supprimée',
  'access_point.created': 'Codes QR générés',
  'access_point.updated': 'Point d’accès réaffecté',
  'access_point.revoked': 'Code QR révoqué',
  'user.created': 'Compte créé',
  'user.updated': 'Compte modifié',
  'user.deactivated': 'Compte désactivé',
  'restaurant.created': 'Restaurant créé',
  'restaurant.status_changed': 'Statut changé',
  'restaurant.modules_changed': 'Modules changés',
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'disponible',
  SOLD_OUT: 'épuisé',
  DISABLED: 'retiré',
};

export function AuditPage(): JSX.Element {
  const entries = useQuery({
    queryKey: ['audit'],
    queryFn: () => api.get<AuditEntry[]>('/restaurant/audit?limit=100'),
  });

  if (entries.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spin />
      </div>
    );
  }

  const list = entries.data ?? [];

  return (
    <>
      <PageHeader title="Journal" lede="Ce qui a changé, par qui, et quand." />

      <div className="page max-w-[860px]">
        {list.length === 0 ? (
          <EmptyState
            title="Rien à signaler"
            description="Les changements de prix, de disponibilité et de charte apparaîtront ici."
          />
        ) : (
          <div className="evx-card">
            {list.map((entry) => (
              <div key={entry.id} className="row items-start">
                <span className="w-[132px] shrink-0 text-[12px] tabular-nums" style={{ color: 'var(--ink-3)' }}>
                  {new Date(entry.createdAt).toLocaleString('fr', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>

                <Badge tone={entry.action === 'price.changed' ? 'warning' : 'neutral'}>
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </Badge>

                <div className="flex-1 min-w-0">
                  <p className="m-0 text-[13px]">{describe(entry)}</p>
                  <p className="m-0 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                    {entry.userName ?? 'Système'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** Traduit un diff en une phrase lisible — c'est tout l'intérêt du journal. */
function describe(entry: AuditEntry): string {
  const diff = entry.diff as { before?: Record<string, unknown>; after?: Record<string, unknown> };
  const before = diff?.before ?? {};
  const after = diff?.after ?? {};

  if (entry.action === 'price.changed') {
    const from = before.basePrice as number | null;
    const to = after.basePrice as number | null;
    if (from != null && to != null) {
      return `${formatAmount(from)} F → ${formatAmount(to)} F`;
    }
    return 'Grille tarifaire modifiée.';
  }

  if (entry.action === 'item.status_changed') {
    return `${STATUS_LABELS[String(before.status)] ?? before.status} → ${
      STATUS_LABELS[String(after.status)] ?? after.status
    }`;
  }

  if (entry.action === 'access_point.revoked') {
    return `Code ${String(after.code ?? before.code ?? '')} révoqué.`;
  }

  if (entry.action === 'access_point.created') {
    return `${after.count ?? '?'} × ${after.label ?? 'point d’accès'}`;
  }

  const changed = (entry.diff as { changed?: string[] })?.changed ?? [];
  if (changed.length > 0) return `Champs : ${changed.join(', ')}`;
  return '—';
}
