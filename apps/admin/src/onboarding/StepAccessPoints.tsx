import { useState, type FormEvent, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Field, Input, Select, useToast } from '@evolyx/ui';
import type { AccessPointSummary } from '@evolyx/shared';
import { ApiRequestError, api } from '../lib/api';
import { downloadPdf } from '../lib/download';

/**
 * Étape 5 — les codes QR.
 *
 * Le geste normal d'une mise en service est « 20 tables », pas vingt créations à l'unité.
 * Une fois générés, les codes sont **définitifs** : c'est écrit là, en toutes lettres, parce
 * que c'est le seul point de cette mise en service qu'on ne peut pas défaire.
 */

const KINDS = [
  { value: 'TABLE', label: 'Tables', hint: 'Un code par table' },
  { value: 'COUNTER', label: 'Comptoir', hint: 'Pour la vente à emporter' },
  { value: 'WINDOW', label: 'Vitrine', hint: 'Visible depuis la rue' },
  { value: 'POSTER', label: 'Affiche', hint: 'Mur, flyer, chevalet' },
] as const;

export function StepAccessPoints({ onNext }: { onNext: () => Promise<void> }): JSX.Element {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<string>('TABLE');
  const [label, setLabel] = useState('Table');
  const [quantity, setQuantity] = useState(20);

  const points = useQuery({
    queryKey: ['access-points'],
    queryFn: () => api.get<AccessPointSummary[]>('/access-points'),
  });

  const create = useMutation({
    mutationFn: () => api.post<AccessPointSummary[]>('/access-points', { kind, label, quantity }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['access-points'] });
      toast.success(`${created.length} code${created.length > 1 ? 's' : ''} généré${created.length > 1 ? 's' : ''}.`);
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : 'Génération impossible.'),
  });

  const existing = points.data ?? [];

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    void onNext();
  };

  return (
    <form id="step-access" onSubmit={submit}>
      <span className="eyebrow">Codes QR</span>
      <h1 className="page-title">Vos codes, imprimés une fois pour toutes.</h1>
      <p className="page-lede">
        Chaque code est définitif : il ne change jamais, même si vous renommez la table,
        changez de charte ou d’adresse web. Vous imprimez une fois, vous ne réimprimez plus.
      </p>

      <div
        className="mt-6 p-4 rounded-[12px] border grid sm:grid-cols-[1fr_1fr_120px] gap-4 items-end"
        style={{ borderColor: 'var(--rule)', background: 'var(--card)' }}
      >
        <Field label="Type">
          {(id) => (
            <Select id={id} value={kind} onChange={(event) => {
              setKind(event.target.value);
              const found = KINDS.find((entry) => entry.value === event.target.value);
              if (found) setLabel(found.value === 'TABLE' ? 'Table' : found.label);
            }}>
              {KINDS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label} — {entry.hint}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Libellé">
          {(id) => (
            <Input
              id={id}
              value={label}
              maxLength={60}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Table"
            />
          )}
        </Field>

        <Field label="Combien ?">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              max={300}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))}
            />
          )}
        </Field>

        <div className="sm:col-span-3">
          <Button
            type="button"
            variant="primary"
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Générer {quantity} code{quantity > 1 ? 's' : ''}
          </Button>
          <span className="ml-3 text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
            {quantity > 1 ? `${label} 1 … ${label} ${quantity}` : label}
          </span>
        </div>
      </div>

      {existing.length > 0 ? (
        <div className="mt-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              {existing.length} point{existing.length > 1 ? 's' : ''} d’accès
            </h2>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void downloadPdf('a6', toast.error)}
              >
                Pack A6 à découper
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void downloadPdf('a4', toast.error)}
              >
                Planche A4
              </Button>
            </div>
          </div>

          <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: 'var(--rule)' }}>
            <div className="max-h-[260px] overflow-y-auto">
              {existing.map((point) => (
                <div key={point.id} className="row">
                  <span className="flex-1 font-medium">{point.label}</span>
                  <code
                    className="font-mono text-[12.5px] px-2 py-1 rounded-md tracking-[0.12em]"
                    style={{ background: 'var(--paper)', color: 'var(--ink-2)' }}
                  >
                    {point.code}
                  </code>
                  <Badge tone="neutral">{kindLabel(point.kind)}</Badge>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-3 text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
            Imprimez le pack A6, découpez, plastifiez. La planche A4 vous sert de récapitulatif
            au comptoir.
          </p>
        </div>
      ) : null}
    </form>
  );
}

export function kindLabel(kind: string): string {
  return (
    { TABLE: 'Table', COUNTER: 'Comptoir', WINDOW: 'Vitrine', POSTER: 'Affiche', OTHER: 'Autre' }[
      kind
    ] ?? kind
  );
}
