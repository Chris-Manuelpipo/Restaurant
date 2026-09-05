import { useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArtTableTent,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Spin,
  useToast,
} from '@evolyx/ui';
import type { AccessPointSummary } from '@evolyx/shared';
import { API_URL, ApiRequestError, api, getAccessToken } from '../lib/api';
import { useSession } from '../lib/session';
import { PageHeader } from '../components/PageHeader';
import { downloadPdf } from '../lib/download';
import { kindLabel } from '../onboarding/StepAccessPoints';

/**
 * Codes QR.
 *
 * L'écran insiste sur une chose : le code ne change jamais. Réaffecter la table 3 vers la
 * table 7 se fait ici, en modifiant le libellé — le carton collé sous la table reste valable,
 * il n'y a rien à réimprimer. C'est le scénario B du cahier de recette.
 */
export function AccessPointsPage(): JSX.Element {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can } = useSession();

  const [editing, setEditing] = useState<AccessPointSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [showRevoked, setShowRevoked] = useState(false);

  const points = useQuery({
    queryKey: ['access-points', showRevoked],
    queryFn: () =>
      api.get<AccessPointSummary[]>(`/access-points?includeRevoked=${showRevoked ? 'true' : 'false'}`),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.post(`/access-points/${id}/revoke`),
    onSuccess: async () => {
      toast.success('Code révoqué. Il ne mène plus à votre menu.');
      await queryClient.invalidateQueries({ queryKey: ['access-points'] });
    },
    onError: () => toast.error('Révocation impossible.'),
  });

  if (points.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spin />
      </div>
    );
  }

  const list = points.data ?? [];
  const writable = can('access_points:write');
  const active = list.filter((point) => point.revokedAt === null);

  return (
    <>
      <PageHeader
        title="Codes QR"
        lede="Imprimés une fois, valables pour toujours."
        actions={
          <>
            {active.length > 0 ? (
              <>
                <Button size="sm" onClick={() => void downloadPdf('a6', toast.error)}>
                  Pack A6
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void downloadPdf('a4', toast.error)}>
                  Planche A4
                </Button>
              </>
            ) : null}
            {writable ? (
              <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
                Ajouter
              </Button>
            ) : null}
          </>
        }
      />

      <div className="page">
        {list.length === 0 ? (
          <EmptyState
            art={<ArtTableTent />}
            title="Aucun code pour l’instant"
            description="Créez un code par table. Chaque code est définitif : il reste valable même si vous renommez la table ou changez de charte."
            action={
              writable ? (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  Générer mes codes
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
                {active.length} code{active.length > 1 ? 's' : ''} actif{active.length > 1 ? 's' : ''}
              </p>
              <label className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
                <input
                  type="checkbox"
                  checked={showRevoked}
                  onChange={(event) => setShowRevoked(event.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Afficher les codes révoqués
              </label>
            </div>

            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}>
              {list.map((point) => (
                <article
                  key={point.id}
                  className="evx-card"
                  style={{ opacity: point.revokedAt ? 0.55 : 1 }}
                >
                  <div className="evx-card__body text-center">
                    <div
                      className="mx-auto w-[120px] h-[120px] rounded-[10px] grid place-items-center overflow-hidden"
                      style={{ background: '#fff', border: '1px solid var(--rule)' }}
                    >
                      <QrThumb id={point.id} />
                    </div>

                    <p className="mt-3 mb-0 font-semibold">{point.label}</p>
                    <code
                      className="inline-block mt-1 font-mono text-[12.5px] px-2 py-1 rounded-md tracking-[0.14em]"
                      style={{ background: 'var(--paper)', color: 'var(--ink-2)' }}
                    >
                      {point.code}
                    </code>

                    <div className="mt-2 flex justify-center gap-2">
                      <Badge tone="neutral">{kindLabel(point.kind)}</Badge>
                      {point.revokedAt ? <Badge tone="danger">Révoqué</Badge> : null}
                    </div>

                    {writable && !point.revokedAt ? (
                      <div className="mt-4 flex gap-2 justify-center">
                        <Button size="sm" onClick={() => setEditing(point)}>
                          Réaffecter
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Révoquer « ${point.label} » ? Le carton imprimé cessera de fonctionner.`,
                              )
                            ) {
                              revoke.mutate(point.id);
                            }
                          }}
                        >
                          Révoquer
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {editing ? (
        <RenameModal
          point={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await queryClient.invalidateQueries({ queryKey: ['access-points'] });
          }}
        />
      ) : null}

      {creating ? (
        <CreateModal
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await queryClient.invalidateQueries({ queryKey: ['access-points'] });
          }}
        />
      ) : null}
    </>
  );
}

/** L'aperçu est derrière une route authentifiée : on le charge en blob, pas en `<img src>`. */
function QrThumb({ id }: { id: string }): JSX.Element {
  const query = useQuery({
    queryKey: ['qr', id],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/v1/access-points/${id}/qr.svg`, {
        headers: { authorization: `Bearer ${getAccessToken() ?? ''}` },
      });
      if (!response.ok) throw new Error('qr indisponible');
      return response.text();
    },
    staleTime: Infinity,
  });

  if (!query.data) return <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>…</span>;
  return (
    <div
      className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
      // Le SVG vient de notre propre API, sur une route authentifiée.
      dangerouslySetInnerHTML={{ __html: query.data }}
    />
  );
}

function RenameModal({
  point,
  onClose,
  onSaved,
}: {
  point: AccessPointSummary;
  onClose: () => void;
  onSaved: () => Promise<void>;
}): JSX.Element {
  const toast = useToast();
  const [label, setLabel] = useState(point.label);

  const save = useMutation({
    mutationFn: () => api.patch(`/access-points/${point.id}`, { label }),
    onSuccess: async () => {
      toast.success('Point d’accès réaffecté. Aucun code à réimprimer.');
      await onSaved();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : 'Modification impossible.'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Réaffecter ce code"
      description="Le code reste identique : le carton déjà collé continue de fonctionner."
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <Field label="Code" hint="Immuable — c’est ce qui est imprimé.">
        {(id) => <Input id={id} value={point.code} disabled className="font-mono tracking-[0.14em]" />}
      </Field>

      <Field label="Nouveau libellé" required>
        {(id) => (
          <Input
            id={id}
            autoFocus
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Table 7"
          />
        )}
      </Field>
    </Modal>
  );
}

function CreateModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}): JSX.Element {
  const toast = useToast();
  const [kind, setKind] = useState('TABLE');
  const [label, setLabel] = useState('Table');
  const [quantity, setQuantity] = useState(1);
  const [startAt, setStartAt] = useState(1);

  const create = useMutation({
    mutationFn: () => api.post('/access-points', { kind, label, quantity, startAt }),
    onSuccess: async () => {
      toast.success('Codes générés.');
      await onSaved();
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : 'Génération impossible.'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Ajouter des points d’accès"
      description="Les codes générés sont définitifs. Imprimez-les une fois, ils resteront valables."
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={create.isPending} onClick={() => create.mutate()}>
            Générer
          </Button>
        </>
      }
    >
      <Field label="Type">
        {(id) => (
          <Select id={id} value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="TABLE">Table</option>
            <option value="COUNTER">Comptoir</option>
            <option value="WINDOW">Vitrine</option>
            <option value="POSTER">Affiche</option>
            <option value="OTHER">Autre</option>
          </Select>
        )}
      </Field>

      <Field label="Libellé" hint="Numéroté automatiquement au-delà d’une unité.">
        {(id) => <Input id={id} value={label} onChange={(event) => setLabel(event.target.value)} />}
      </Field>

      <div className="grid grid-cols-2 gap-4">
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

        <Field label="Numéroter à partir de">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              value={startAt}
              onChange={(event) => setStartAt(Math.max(1, Number(event.target.value)))}
            />
          )}
        </Field>
      </div>

      <p className="mt-4 text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
        Sera créé : {quantity > 1 ? `${label} ${startAt} … ${label} ${startAt + quantity - 1}` : label}
      </p>
    </Modal>
  );
}
