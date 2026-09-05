import { useMemo, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, EmptyState, Field, Input, Modal, Select, Spin, useToast } from '@evolyx/ui';
import { dayName, resolveI18n, type I18nText } from '@evolyx/shared';
import { ApiRequestError, api } from '../lib/api';
import { useSession } from '../lib/session';
import { PageHeader } from '../components/PageHeader';
import { MenuPreview, previewMoments } from '../components/MenuPreview';

/**
 * Horaires des plats — les règles de disponibilité.
 *
 * Deux usages, un seul écran : masquer une catégorie hors de son créneau (le brunch du
 * dimanche) ou annoncer une promotion (l'happy hour). L'aperçu à droite permet de vérifier
 * l'effet **avant** que le client ne le découvre : c'est tout l'intérêt du paramètre `at`.
 */

interface Rule {
  id: string;
  targetType: 'CATEGORY' | 'ITEM';
  targetId: string;
  kind: 'VISIBILITY' | 'PROMO';
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  label: I18nText | null;
  discountPercent: number | null;
}

export function RulesPage(): JSX.Element {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can, session } = useSession();
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const [previewAt, setPreviewAt] = useState<string | null>(null);

  const moments = useMemo(() => previewMoments(), []);

  const rules = useQuery({ queryKey: ['rules'], queryFn: () => api.get<Rule[]>('/availability-rules') });
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ id: string; name: I18nText }[]>('/categories'),
  });
  const items = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => api.get<{ id: string; name: I18nText }[]>('/menu-items'),
  });

  const nameOf = (rule: Rule): string => {
    const source = rule.targetType === 'CATEGORY' ? categories.data : items.data;
    const found = source?.find((entry) => entry.id === rule.targetId);
    return found ? resolveI18n(found.name) : 'Élément supprimé';
  };

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/availability-rules/${id}`),
    onSuccess: async () => {
      toast.success('Règle supprimée.');
      await queryClient.invalidateQueries({ queryKey: ['rules'] });
      await queryClient.invalidateQueries({ queryKey: ['preview'] });
    },
  });

  if (rules.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spin />
      </div>
    );
  }

  const writable = can('rules:write');
  const list = rules.data ?? [];

  return (
    <>
      <PageHeader
        title="Horaires des plats"
        lede="Faites apparaître le brunch le dimanche matin, annoncez l’happy hour du soir."
        actions={
          writable ? (
            <Button size="sm" variant="primary" onClick={() => setEditing('new')}>
              Nouvelle règle
            </Button>
          ) : null
        }
      />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
        <div className="page">
          {list.length === 0 ? (
            <EmptyState
              title="Aucune règle pour l’instant"
              description="Sans règle, tous vos plats visibles sont servis à toute heure d’ouverture. Ajoutez-en une pour réserver une catégorie à un créneau, ou pour annoncer une promotion."
              action={
                writable ? (
                  <Button variant="primary" onClick={() => setEditing('new')}>
                    Créer une règle
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="grid gap-3">
              {list.map((rule) => (
                <article
                  key={rule.id}
                  className="evx-card"
                  style={{ borderColor: rule.kind === 'PROMO' ? 'var(--amber-line)' : undefined }}
                >
                  <div className="evx-card__body flex items-center gap-4">
                    <Badge tone={rule.kind === 'PROMO' ? 'warning' : 'accent'}>
                      {rule.kind === 'PROMO' ? 'Promotion' : 'Visibilité'}
                    </Badge>

                    <div className="flex-1 min-w-0">
                      <p className="m-0 font-semibold truncate">
                        {rule.label ? resolveI18n(rule.label) : nameOf(rule)}
                      </p>
                      <p className="m-0 text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
                        {rule.kind === 'PROMO' ? `${nameOf(rule)} · ` : ''}
                        {describeDays(rule.daysOfWeek)} de {rule.startTime} à {rule.endTime}
                        {rule.endTime <= rule.startTime ? ' (le lendemain)' : ''}
                        {rule.discountPercent ? ` · −${rule.discountPercent} %` : ''}
                      </p>
                    </div>

                    {writable ? (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(rule)}>
                          Modifier
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => remove.mutate(rule.id)}>
                          Supprimer
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="preview-pane">
          <div className="w-full flex items-center justify-between">
            <b className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--ink-3)' }}>
              Aperçu
            </b>
            <span className="live-dot">
              <i /> en direct
            </span>
          </div>

          <div className="when-switch">
            {moments.map((moment) => (
              <button
                key={moment.label}
                type="button"
                aria-pressed={previewAt === moment.at}
                onClick={() => setPreviewAt(moment.at)}
              >
                {moment.label}
              </button>
            ))}
          </div>

          {session?.restaurant ? (
            <MenuPreview slug={session.restaurant.slug} at={previewAt} />
          ) : null}

          <p
            className="text-[11.5px] text-center max-w-[26ch] leading-[1.45] m-0"
            style={{ color: 'var(--ink-3)' }}
          >
            Changez d’instant pour vérifier ce que verront vos clients ce jour-là.
          </p>
        </aside>
      </div>

      {editing ? (
        <RuleModal
          rule={editing === 'new' ? null : editing}
          categories={categories.data ?? []}
          items={items.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await queryClient.invalidateQueries({ queryKey: ['rules'] });
            await queryClient.invalidateQueries({ queryKey: ['preview'] });
          }}
        />
      ) : null}
    </>
  );
}

function RuleModal({
  rule,
  categories,
  items,
  onClose,
  onSaved,
}: {
  rule: Rule | null;
  categories: { id: string; name: I18nText }[];
  items: { id: string; name: I18nText }[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}): JSX.Element {
  const toast = useToast();
  const [kind, setKind] = useState<Rule['kind']>(rule?.kind ?? 'VISIBILITY');
  const [targetType, setTargetType] = useState<Rule['targetType']>(rule?.targetType ?? 'CATEGORY');
  const [targetId, setTargetId] = useState(rule?.targetId ?? categories[0]?.id ?? '');
  const [days, setDays] = useState<number[]>(rule?.daysOfWeek ?? [0]);
  const [startTime, setStartTime] = useState(rule?.startTime ?? '10:00');
  const [endTime, setEndTime] = useState(rule?.endTime ?? '14:00');
  const [label, setLabel] = useState(resolveI18n(rule?.label ?? null));
  const [discount, setDiscount] = useState(String(rule?.discountPercent ?? ''));
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        kind,
        targetType,
        targetId,
        daysOfWeek: days,
        startTime,
        endTime,
        label: label.trim() ? { fr: label.trim() } : null,
        discountPercent: discount ? Number(discount) : null,
      };
      return rule
        ? api.patch(`/availability-rules/${rule.id}`, {
            daysOfWeek: payload.daysOfWeek,
            startTime,
            endTime,
            label: payload.label,
            discountPercent: payload.discountPercent,
          })
        : api.post('/availability-rules', payload);
    },
    onSuccess: async () => {
      toast.success(rule ? 'Règle mise à jour.' : 'Règle créée.');
      await onSaved();
    },
    onError: (cause) =>
      setError(cause instanceof ApiRequestError ? cause.message : 'Enregistrement impossible.'),
  });

  const targets = targetType === 'CATEGORY' ? categories : items;

  return (
    <Modal
      open
      onClose={onClose}
      title={rule ? 'Modifier la règle' : 'Nouvelle règle'}
      description={
        kind === 'VISIBILITY'
          ? 'Hors de ce créneau, l’élément disparaît du menu client.'
          : 'La promotion est affichée aux clients pendant le créneau.'
      }
      width={540}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <Field label="Type de règle">
        {() => (
          <div className="flex gap-2">
            {(['VISIBILITY', 'PROMO'] as const).map((value) => (
              <button
                key={value}
                type="button"
                disabled={Boolean(rule)}
                className={`evx-btn evx-btn--sm ${kind === value ? 'evx-btn--secondary' : 'evx-btn--ghost'}`}
                onClick={() => setKind(value)}
              >
                {value === 'VISIBILITY' ? 'Visibilité' : 'Promotion'}
              </button>
            ))}
          </div>
        )}
      </Field>

      {!rule ? (
        <Field label="S’applique à" required>
          {() => (
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <Select
                value={targetType}
                onChange={(event) => {
                  const next = event.target.value as Rule['targetType'];
                  setTargetType(next);
                  setTargetId((next === 'CATEGORY' ? categories[0]?.id : items[0]?.id) ?? '');
                }}
                aria-label="Type de cible"
              >
                <option value="CATEGORY">Une catégorie</option>
                <option value="ITEM">Un plat</option>
              </Select>
              <Select
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                aria-label="Cible"
              >
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {resolveI18n(target.name)}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </Field>
      ) : null}

      <Field label="Jours" required>
        {() => (
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const active = days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={active}
                  className={`evx-btn evx-btn--sm ${active ? 'evx-btn--secondary' : 'evx-btn--ghost'}`}
                  onClick={() =>
                    setDays((current) =>
                      active ? current.filter((d) => d !== day) : [...current, day],
                    )
                  }
                >
                  {dayName(day).slice(0, 3)}
                </button>
              );
            })}
          </div>
        )}
      </Field>

      <Field label="Créneau" hint="Une fin avant le début signifie que le créneau passe minuit.">
        {() => (
          <div className="flex items-center gap-3">
            <input
              type="time"
              className="evx-input !w-[130px]"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              aria-label="Début"
            />
            <span style={{ color: 'var(--ink-3)' }}>→</span>
            <input
              type="time"
              className="evx-input !w-[130px]"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              aria-label="Fin"
            />
          </div>
        )}
      </Field>

      {kind === 'PROMO' ? (
        <>
          <Field label="Libellé affiché aux clients" required>
            {(id) => (
              <Input
                id={id}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Happy hour −30 % sur les cocktails"
              />
            )}
          </Field>

          <Field
            label="Remise"
            hint="Informatif pour l’instant : le calcul viendra avec le module Caisse."
          >
            {(id) => (
              <div className="flex items-center gap-2">
                <Input
                  id={id}
                  type="number"
                  min={1}
                  max={100}
                  className="!w-24"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                />
                <span style={{ color: 'var(--ink-3)' }}>%</span>
              </div>
            )}
          </Field>
        </>
      ) : null}

      {error ? (
        <p
          className="mt-4 p-3 rounded-[10px] text-[13px]"
          role="alert"
          style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
        >
          {error}
        </p>
      ) : null}
    </Modal>
  );
}

function describeDays(days: number[]): string {
  if (days.length === 7) return 'Tous les jours';
  const sorted = [...days].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  if (sorted.length === 1) return `Le ${dayName(sorted[0]!).toLowerCase()}`;
  return sorted.map((day) => dayName(day).slice(0, 3)).join(', ');
}
