import { useState, type FormEvent, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Field, Textarea, useToast } from '@evolyx/ui';
import { formatAmount, type MenuImportPreview, type MenuImportRow } from '@evolyx/shared';
import { ApiRequestError, api } from '../lib/api';

/**
 * Étape 4 — le menu par collage.
 *
 * Le gérant colle sa carte telle qu'elle existe : un message WhatsApp, un tableur, un Word.
 * Le parseur propose une lecture ligne par ligne ; **rien n'est écrit** tant qu'il n'a pas
 * confirmé. Les lignes incomprises restent affichées telles quelles, avec un champ de prix
 * à remplir — on ne devine jamais un prix.
 */
export function StepMenu({ onNext }: { onNext: () => Promise<void> }): JSX.Element {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<MenuImportPreview | null>(null);
  const [fixes, setFixes] = useState<Record<number, string>>({});

  const existing = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => api.get<{ id: string }[]>('/menu-items'),
  });

  const analyse = useMutation({
    mutationFn: (value: string) => api.post<MenuImportPreview>('/menu-items/import', { text: value }),
    onSuccess: (result) => {
      setPreview(result);
      setFixes({});
    },
    onError: () => toast.error("La carte n'a pas pu être lue."),
  });

  const commit = useMutation({
    mutationFn: (rows: { name: string; price: number; categoryName?: string }[]) =>
      api.post<{ created: number }>('/menu-items/import/commit', { items: rows }),
    onSuccess: async (result) => {
      toast.success(`${result.created} plat${result.created > 1 ? 's' : ''} créé${result.created > 1 ? 's' : ''}.`);
      // La carte et les catégories viennent de changer : les écrans suivants doivent les relire.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['menu-items'] }),
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
        queryClient.invalidateQueries({ queryKey: ['preview'] }),
      ]);
      await onNext();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : 'Création impossible.'),
  });

  const rows = preview?.rows ?? [];
  const ready = rows
    .map((row, index) => resolveRow(row, fixes[index]))
    .filter((row): row is { name: string; price: number; categoryName?: string } => row !== null);

  const alreadyHasItems = (existing.data?.length ?? 0) > 0;

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (ready.length === 0) {
      // Rien à créer : on laisse passer, la carte se remplira depuis l'écran « La carte ».
      void onNext();
      return;
    }
    commit.mutate(ready);
  };

  return (
    <form id="step-menu" onSubmit={submit}>
      <span className="eyebrow">Menu</span>
      <h1 className="page-title">Collez votre carte, on s’occupe du reste.</h1>
      <p className="page-lede">
        Depuis WhatsApp, un tableur ou un document Word — peu importe la mise en forme. Vous
        corrigerez les lignes mal comprises juste en dessous.
      </p>

      {alreadyHasItems ? (
        <p
          className="mt-5 p-3 rounded-[10px] text-[12.5px]"
          style={{ background: 'var(--accent-soft)', color: 'var(--ink-2)' }}
        >
          Votre carte contient déjà {existing.data?.length} plats. Cet import les complétera
          sans rien remplacer.
        </p>
      ) : null}

      <Field label="Votre carte" hint="Une ligne par plat. Les prix se reconnaissent seuls, avec ou sans « FCFA ».">
        {(id) => (
          <Textarea
            id={id}
            spellCheck={false}
            className="font-mono !text-[12.5px] !leading-[1.85] min-h-[210px]"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={() => text.trim() && analyse.mutate(text)}
            placeholder={`GRILLADES
Poulet braisé entier – 4 500
Poulet DG - 6000 FCFA
Brochettes de bœuf : 1000

POISSONS
Maquereau braisé – 2 500`}
          />
        )}
      </Field>

      <div className="mt-3 flex gap-3">
        <Button
          type="button"
          onClick={() => analyse.mutate(text)}
          loading={analyse.isPending}
          disabled={!text.trim()}
        >
          Lire ma carte
        </Button>
        {preview ? (
          <Button type="button" variant="ghost" onClick={() => { setPreview(null); setText(''); }}>
            Recommencer
          </Button>
        ) : null}
      </div>

      {preview ? (
        <div className="mt-6 rounded-[12px] border overflow-hidden" style={{ borderColor: 'var(--rule)' }}>
          <header
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--rule-2)', background: '#fbfaf7' }}
          >
            <b className="text-[13px]">Aperçu de l’import</b>
            <div className="flex gap-2">
              <Badge tone="accent">
                {preview.recognised} plat{preview.recognised > 1 ? 's' : ''} reconnu
                {preview.recognised > 1 ? 's' : ''}
              </Badge>
              {preview.rejected > 0 ? (
                <Badge tone="danger">{preview.rejected} à corriger</Badge>
              ) : null}
            </div>
          </header>

          <div className="max-h-[380px] overflow-y-auto">
            {rows.map((row, index) => {
              const resolved = resolveRow(row, fixes[index]);
              return (
                <div key={`${row.line}-${index}`} className="row">
                  <span
                    className="w-[18px] h-[18px] rounded-full grid place-items-center text-[11px] shrink-0"
                    style={
                      resolved
                        ? { background: 'var(--accent-soft)', color: 'var(--accent)' }
                        : { background: 'var(--danger-soft)', color: 'var(--danger)' }
                    }
                    aria-hidden
                  >
                    {resolved ? '✓' : '!'}
                  </span>

                  <span className={`flex-1 min-w-0 truncate ${row.ok ? 'font-medium' : ''}`}>
                    {row.ok ? row.name : <span className="font-mono text-[12px]">{row.raw.trim()}</span>}
                  </span>

                  {row.categoryName ? (
                    <span
                      className="text-[11.5px] px-2 py-[3px] rounded-md shrink-0"
                      style={{ background: 'var(--paper)', color: 'var(--ink-3)' }}
                    >
                      {row.categoryName}
                    </span>
                  ) : null}

                  {row.ok ? (
                    <span className="tabular-nums font-semibold shrink-0">
                      {formatAmount(row.price!)} F
                    </span>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder="Prix ?"
                      className="evx-input !w-[96px] !min-h-[32px] !py-1 !px-2 !text-[12.5px] shrink-0"
                      value={fixes[index] ?? ''}
                      onChange={(event) =>
                        setFixes((current) => ({ ...current, [index]: event.target.value }))
                      }
                      aria-label={`Prix pour « ${row.raw.trim()} »`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {preview && ready.length > 0 ? (
        <p className="mt-4 text-[13px]" style={{ color: 'var(--ink-2)' }}>
          <b>{ready.length}</b> plat{ready.length > 1 ? 's seront créés' : ' sera créé'} en
          continuant.
        </p>
      ) : null}
    </form>
  );
}

/** Une ligne est exploitable si le parseur l'a comprise, ou si le gérant a saisi le prix. */
function resolveRow(
  row: MenuImportRow,
  fix: string | undefined,
): { name: string; price: number; categoryName?: string } | null {
  const name = row.name?.trim();
  if (!name) return null;

  const price = row.ok ? row.price : fix ? Number(fix) : null;
  if (price === null || !Number.isFinite(price) || price <= 0) return null;

  return {
    name,
    price: Math.round(price),
    ...(row.categoryName ? { categoryName: row.categoryName } : {}),
  };
}
