import { useMemo, useState, type JSX } from 'react';
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
  Switch,
  useToast,
} from '@evolyx/ui';
import {
  MODULES,
  TABLE_STATUSES,
  type AccessPointSummary,
  type DiningTableSummary,
  type TableStatus,
} from '@evolyx/shared';
import { ApiRequestError, api } from '../lib/api';
import { useSession } from '../lib/session';
import { PageHeader } from '../components/PageHeader';

/**
 * Tables de la salle.
 *
 * Deux publics sur un même écran : le gérant qui configure (noms, places, zones, cartons) et
 * le personnel qui, en plein service, passe une table de « libre » à « occupée ». Le second
 * geste doit rester à un clic ; le premier peut passer par une fenêtre.
 */

const STATUS_LABEL: Record<TableStatus, string> = {
  FREE: 'Libre',
  OCCUPIED: 'Occupée',
  RESERVED: 'Réservée',
  OUT_OF_SERVICE: 'Hors service',
};

const STATUS_TONE: Record<TableStatus, 'success' | 'warning' | 'accent' | 'neutral'> = {
  FREE: 'success',
  OCCUPIED: 'warning',
  RESERVED: 'accent',
  OUT_OF_SERVICE: 'neutral',
};

const NO_ZONE = 'Sans zone';

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof ApiRequestError ? error.message : fallback;

export function TablesPage(): JSX.Element {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can, session } = useSession();

  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DiningTableSummary | null>(null);
  const [linking, setLinking] = useState<DiningTableSummary | null>(null);

  const writable = can('tables:write');
  const canStatus = can('tables:status');
  const qrEnabled = session?.modules.includes(MODULES.MENU_QR) ?? false;
  const canQr = writable && qrEnabled && can('access_points:write');

  const tables = useQuery({
    queryKey: ['tables', showArchived],
    queryFn: () =>
      api.get<DiningTableSummary[]>(`/tables?includeArchived=${showArchived ? 'true' : 'false'}`),
  });

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['tables'] });
    await queryClient.invalidateQueries({ queryKey: ['access-points'] });
  };

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TableStatus }) =>
      api.patch<DiningTableSummary>(`/tables/${id}/status`, { status }),
    // Le geste du service doit paraître instantané : on met à jour avant la réponse.
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['tables'] });
      queryClient.setQueriesData<DiningTableSummary[]>({ queryKey: ['tables'] }, (current) =>
        current?.map((table) => (table.id === id ? { ...table, status } : table)),
      );
    },
    onError: async (error) => {
      toast.error(errorMessage(error, 'Statut non enregistré.'));
      await refresh();
    },
  });

  const archive = useMutation({
    mutationFn: (id: string) => api.post(`/tables/${id}/archive`),
    onSuccess: async () => {
      toast.success('Table archivée. Son code QR reste valable et peut servir ailleurs.');
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error, 'Archivage impossible.')),
  });

  const restore = useMutation({
    mutationFn: (id: string) => api.post(`/tables/${id}/restore`),
    onSuccess: async () => {
      toast.success('Table remise en service.');
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error, 'Restauration impossible.')),
  });

  const list = useMemo(() => tables.data ?? [], [tables.data]);
  const active = list.filter((table) => table.archivedAt === null);

  const zones = useMemo(() => {
    const groups = new Map<string, DiningTableSummary[]>();
    for (const table of list) {
      const key = table.zone ?? NO_ZONE;
      groups.set(key, [...(groups.get(key) ?? []), table]);
    }
    // « Sans zone » en dernier : c'est le reliquat, pas une salle.
    return [...groups.entries()].sort(([a], [b]) =>
      a === NO_ZONE ? 1 : b === NO_ZONE ? -1 : a.localeCompare(b, 'fr'),
    );
  }, [list]);

  const existingZones = useMemo(
    () => [...new Set(active.flatMap((table) => (table.zone ? [table.zone] : [])))].sort(),
    [active],
  );

  if (tables.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spin />
      </div>
    );
  }

  const count = (status: TableStatus) => active.filter((table) => table.status === status).length;
  const seats = active.reduce((sum, table) => sum + table.seats, 0);

  return (
    <>
      <PageHeader
        title="Tables"
        lede="La salle telle que le personnel la voit : qui est libre, qui est occupé."
        actions={
          writable ? (
            <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
              Ajouter des tables
            </Button>
          ) : null
        }
      />

      <div className="page">
        {list.length === 0 && !showArchived ? (
          <EmptyState
            art={<ArtTableTent />}
            title="Aucune table pour l’instant"
            description="Déclarez vos tables, leurs places et leur zone. Vous pourrez ensuite poser un code QR sur chacune."
            action={
              writable ? (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  Ajouter mes tables
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex flex-wrap gap-2 text-[13px]" style={{ color: 'var(--ink-2)' }}>
                <span>
                  {active.length} table{active.length > 1 ? 's' : ''} · {seats} place{seats > 1 ? 's' : ''}
                </span>
                {TABLE_STATUSES.map((status) =>
                  count(status) > 0 ? (
                    <Badge key={status} tone={STATUS_TONE[status]}>
                      {count(status)} {STATUS_LABEL[status].toLowerCase()}
                      {count(status) > 1 && status !== 'OUT_OF_SERVICE' ? 's' : ''}
                    </Badge>
                  ) : null,
                )}
              </div>
              {writable ? (
                <label className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(event) => setShowArchived(event.target.checked)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  Afficher les tables archivées
                </label>
              ) : null}
            </div>

            {zones.map(([zone, items]) => (
              <section key={zone} className="mb-7">
                <h2
                  className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {zone} <span style={{ fontWeight: 400 }}>· {items.length}</span>
                </h2>

                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
                  {items.map((table) => {
                    const archived = table.archivedAt !== null;
                    return (
                      <article key={table.id} className="evx-card" style={{ opacity: archived ? 0.55 : 1 }}>
                        <div className="evx-card__body">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="m-0 font-semibold truncate">{table.label}</p>
                              <p className="m-0 text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
                                {table.seats} place{table.seats > 1 ? 's' : ''}
                              </p>
                            </div>
                            {archived ? (
                              <Badge tone="danger">Archivée</Badge>
                            ) : (
                              <Badge tone={STATUS_TONE[table.status]}>{STATUS_LABEL[table.status]}</Badge>
                            )}
                          </div>

                          {!archived && canStatus ? (
                            <Select
                              aria-label={`Statut de ${table.label}`}
                              className="mt-3"
                              value={table.status}
                              onChange={(event) =>
                                setStatus.mutate({ id: table.id, status: event.target.value as TableStatus })
                              }
                            >
                              {TABLE_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {STATUS_LABEL[status]}
                                </option>
                              ))}
                            </Select>
                          ) : null}

                          {qrEnabled ? (
                            <p className="mt-3 mb-0 text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
                              {table.accessPoint ? (
                                <>
                                  QR{' '}
                                  <code
                                    className="font-mono px-1.5 py-0.5 rounded tracking-[0.12em]"
                                    style={{ background: 'var(--paper)' }}
                                  >
                                    {table.accessPoint.code}
                                  </code>
                                  {!table.accessPoint.isActive ? ' · inactif' : ''}
                                </>
                              ) : (
                                <span style={{ color: 'var(--ink-3)' }}>Pas de code QR</span>
                              )}
                            </p>
                          ) : null}

                          {writable ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {archived ? (
                                <Button
                                  size="sm"
                                  loading={restore.isPending && restore.variables === table.id}
                                  onClick={() => restore.mutate(table.id)}
                                >
                                  Restaurer
                                </Button>
                              ) : (
                                <>
                                  <Button size="sm" onClick={() => setEditing(table)}>
                                    Modifier
                                  </Button>
                                  {canQr ? (
                                    <Button size="sm" onClick={() => setLinking(table)}>
                                      Code QR
                                    </Button>
                                  ) : null}
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Archiver « ${table.label} » ? Elle disparaîtra du service ; son code QR restera valable.`,
                                        )
                                      ) {
                                        archive.mutate(table.id);
                                      }
                                    }}
                                  >
                                    Archiver
                                  </Button>
                                </>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      {creating ? (
        <CreateTablesModal
          zones={existingZones}
          qrEnabled={canQr}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await refresh();
          }}
        />
      ) : null}

      {editing ? (
        <EditTableModal
          table={editing}
          zones={existingZones}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      ) : null}

      {linking ? (
        <QrModal
          table={linking}
          tables={active}
          onClose={() => setLinking(null)}
          onSaved={async () => {
            setLinking(null);
            await refresh();
          }}
        />
      ) : null}
    </>
  );
}

/* ── Zone : texte libre, avec les zones existantes en suggestion ───────────── */

function ZoneInput({
  id,
  value,
  onChange,
  zones,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  zones: string[];
}): JSX.Element {
  return (
    <>
      <Input
        id={id}
        list={`${id}-zones`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Salle, Terrasse, Étage…"
      />
      <datalist id={`${id}-zones`}>
        {zones.map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
    </>
  );
}

function CreateTablesModal({
  zones,
  qrEnabled,
  onClose,
  onSaved,
}: {
  zones: string[];
  qrEnabled: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}): JSX.Element {
  const toast = useToast();
  const [label, setLabel] = useState('Table');
  const [quantity, setQuantity] = useState(1);
  const [startAt, setStartAt] = useState(1);
  const [seats, setSeats] = useState(4);
  const [zone, setZone] = useState('');
  const [withQrCodes, setWithQrCodes] = useState(qrEnabled);

  const create = useMutation({
    mutationFn: () =>
      api.post('/tables', { label: label.trim(), quantity, startAt, seats, zone, withQrCodes }),
    onSuccess: async () => {
      toast.success(quantity > 1 ? `${quantity} tables ajoutées.` : 'Table ajoutée.');
      await onSaved();
    },
    onError: (error) => toast.error(errorMessage(error, 'Création impossible.')),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Ajouter des tables"
      description="Au-delà d’une table, le nom sert de préfixe et les tables sont numérotées."
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={label.trim() === ''}
            onClick={() => create.mutate()}
          >
            Ajouter
          </Button>
        </>
      }
    >
      <Field label="Nom" required>
        {(id) => <Input id={id} autoFocus value={label} onChange={(event) => setLabel(event.target.value)} />}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Combien ?">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              max={200}
              value={quantity}
              onChange={(event) => setQuantity(Math.min(200, Math.max(1, Number(event.target.value))))}
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
              disabled={quantity === 1}
              onChange={(event) => setStartAt(Math.max(1, Number(event.target.value)))}
            />
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Places par table">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              max={100}
              value={seats}
              onChange={(event) => setSeats(Math.min(100, Math.max(1, Number(event.target.value))))}
            />
          )}
        </Field>
        <Field label="Zone" hint="Facultative.">
          {(id) => <ZoneInput id={id} value={zone} onChange={setZone} zones={zones} />}
        </Field>
      </div>

      {qrEnabled ? (
        <div className="flex items-center justify-between gap-4 mt-2">
          <div>
            <p className="m-0 text-[13.5px] font-medium">Générer un code QR par table</p>
            <p className="m-0 text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
              Déjà rattaché, prêt à imprimer depuis « Codes QR ».
            </p>
          </div>
          <Switch checked={withQrCodes} onChange={setWithQrCodes} label="Générer un code QR par table" />
        </div>
      ) : null}

      <p className="mt-4 text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
        Sera créé :{' '}
        {quantity > 1
          ? `${label.trim()} ${startAt} … ${label.trim()} ${startAt + quantity - 1}`
          : label.trim()}
      </p>
    </Modal>
  );
}

function EditTableModal({
  table,
  zones,
  onClose,
  onSaved,
}: {
  table: DiningTableSummary;
  zones: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}): JSX.Element {
  const toast = useToast();
  const [label, setLabel] = useState(table.label);
  const [seats, setSeats] = useState(table.seats);
  const [zone, setZone] = useState(table.zone ?? '');

  const save = useMutation({
    mutationFn: () => api.patch(`/tables/${table.id}`, { label: label.trim(), seats, zone }),
    onSuccess: async () => {
      toast.success('Table modifiée.');
      await onSaved();
    },
    onError: (error) => toast.error(errorMessage(error, 'Modification impossible.')),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Modifier « ${table.label} »`}
      description={
        table.accessPoint
          ? 'Le code QR posé sur la table prend le nouveau nom ; le code lui-même ne change pas.'
          : undefined
      }
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={label.trim() === ''}
            onClick={() => save.mutate()}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <Field label="Nom" required>
        {(id) => <Input id={id} autoFocus value={label} onChange={(event) => setLabel(event.target.value)} />}
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Places">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              max={100}
              value={seats}
              onChange={(event) => setSeats(Math.min(100, Math.max(1, Number(event.target.value))))}
            />
          )}
        </Field>
        <Field label="Zone">
          {(id) => <ZoneInput id={id} value={zone} onChange={setZone} zones={zones} />}
        </Field>
      </div>
    </Modal>
  );
}

/**
 * Le carton d'une table : en garder un, en poser un libre, en générer un neuf, ou l'enlever.
 * Les codes « libres » sont ceux qu'aucune table en service ne porte.
 */
function QrModal({
  table,
  tables,
  onClose,
  onSaved,
}: {
  table: DiningTableSummary;
  tables: DiningTableSummary[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}): JSX.Element {
  const toast = useToast();
  const [choice, setChoice] = useState('');

  const points = useQuery({
    queryKey: ['access-points', false],
    queryFn: () => api.get<AccessPointSummary[]>('/access-points?includeRevoked=false'),
  });

  const taken = new Set(tables.flatMap((other) => (other.accessPoint ? [other.accessPoint.id] : [])));
  const free = (points.data ?? []).filter((point) => !taken.has(point.id));

  const link = useMutation({
    mutationFn: (body: { accessPointId: string | null } | { generate: true }) =>
      api.put(`/tables/${table.id}/qr`, body),
    onSuccess: async (_data, body) => {
      toast.success(
        'generate' in body
          ? 'Code QR généré. Imprimez-le depuis « Codes QR ».'
          : body.accessPointId
            ? 'Code QR rattaché.'
            : 'Code QR retiré. Il reste valable et peut servir ailleurs.',
      );
      await onSaved();
    },
    onError: (error) => toast.error(errorMessage(error, 'Modification impossible.')),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Code QR de « ${table.label} »`}
      description="Un code ne sert qu’une table à la fois. Retirer un code ne l’invalide pas."
      footer={<Button onClick={onClose}>Fermer</Button>}
    >
      {table.accessPoint ? (
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <p className="m-0 text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
              Code actuel
            </p>
            <code className="font-mono text-[15px] tracking-[0.14em]">{table.accessPoint.code}</code>
          </div>
          <Button
            size="sm"
            loading={link.isPending && 'accessPointId' in (link.variables ?? {})}
            onClick={() => link.mutate({ accessPointId: null })}
          >
            Retirer
          </Button>
        </div>
      ) : (
        <p className="mt-0 mb-5 text-[13px]" style={{ color: 'var(--ink-2)' }}>
          Aucun code n’est posé sur cette table.
        </p>
      )}

      <Field label="Poser un code existant" hint={free.length === 0 ? 'Aucun code libre.' : undefined}>
        {(id) => (
          <div className="flex gap-2">
            <Select
              id={id}
              value={choice}
              disabled={free.length === 0}
              onChange={(event) => setChoice(event.target.value)}
            >
              <option value="">Choisir un code libre…</option>
              {free.map((point) => (
                <option key={point.id} value={point.id}>
                  {point.code} — {point.label}
                </option>
              ))}
            </Select>
            <Button
              disabled={choice === ''}
              loading={link.isPending && (link.variables as { accessPointId?: string })?.accessPointId === choice}
              onClick={() => link.mutate({ accessPointId: choice })}
            >
              Poser
            </Button>
          </div>
        )}
      </Field>

      <div className="mt-4">
        <Button
          variant="primary"
          loading={link.isPending && 'generate' in (link.variables ?? {})}
          onClick={() => link.mutate({ generate: true })}
        >
          {table.accessPoint ? 'Remplacer par un code neuf' : 'Générer un code neuf'}
        </Button>
      </div>
    </Modal>
  );
}
