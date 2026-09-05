import { useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Field, Input, Modal, Select, Spin, useToast } from '@evolyx/ui';
import { IMPLEMENTED_MODULES, MODULES, type RestaurantStatus } from '@evolyx/shared';
import { ApiRequestError, api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { slugify } from '../onboarding/StepIdentity';

/**
 * Espace plateforme.
 *
 * Le seul endroit où l'on voit plusieurs restaurants. On y crée un restaurant, on invite son
 * administrateur, on suspend, et on active des modules — la modularité se règle par une
 * liste, jamais par une branche de code.
 */

interface PlatformRestaurant {
  id: string;
  slug: string;
  name: string;
  status: RestaurantStatus;
  enabledModules: string[];
  onboardingCompletedAt: string | null;
  createdAt: string;
  _count: { users: number; menuItems: number; accessPoints: number };
}

const MODULE_LABELS: Record<string, string> = {
  [MODULES.CORE]: 'Socle',
  [MODULES.MENU_QR]: 'Menu QR',
  [MODULES.ORDERING]: 'Commande',
  [MODULES.KITCHEN]: 'Cuisine',
  [MODULES.CASHIER]: 'Caisse',
  [MODULES.DELIVERY]: 'Livraison',
  [MODULES.LOYALTY]: 'Fidélité',
  [MODULES.INVOICING]: 'Factures',
};

const STATUS_TONES: Record<RestaurantStatus, 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  TRIAL: 'warning',
  SUSPENDED: 'danger',
};

const STATUS_LABELS: Record<RestaurantStatus, string> = {
  ACTIVE: 'Actif',
  TRIAL: 'Essai',
  SUSPENDED: 'Suspendu',
};

export function PlatformPage(): JSX.Element {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [invitation, setInvitation] = useState<{ email: string; url: string } | null>(null);

  const restaurants = useQuery({
    queryKey: ['platform-restaurants'],
    queryFn: () => api.get<PlatformRestaurant[]>('/platform/restaurants'),
  });

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/platform/restaurants/${id}`, body),
    onSuccess: async () => {
      toast.success('Restaurant mis à jour.');
      await queryClient.invalidateQueries({ queryKey: ['platform-restaurants'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : 'Modification impossible.'),
  });

  if (restaurants.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spin />
      </div>
    );
  }

  const list = restaurants.data ?? [];

  return (
    <>
      <PageHeader
        title="Restaurants"
        lede={`${list.length} restaurant${list.length > 1 ? 's' : ''} sur la plateforme.`}
        actions={
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            Nouveau restaurant
          </Button>
        }
      />

      <div className="page">
        <div className="grid gap-3">
          {list.map((restaurant) => (
            <article key={restaurant.id} className="evx-card">
              <div className="evx-card__body flex items-center gap-5 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-3">
                    <h2 className="text-[16px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                      {restaurant.name}
                    </h2>
                    <Badge tone={STATUS_TONES[restaurant.status]}>
                      {STATUS_LABELS[restaurant.status]}
                    </Badge>
                    {restaurant.onboardingCompletedAt === null ? (
                      <Badge tone="neutral">Mise en service en cours</Badge>
                    ) : null}
                  </div>
                  <p className="m-0 mt-1 text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
                    /{restaurant.slug} · {restaurant._count.menuItems} plats ·{' '}
                    {restaurant._count.accessPoints} codes · {restaurant._count.users} comptes
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {IMPLEMENTED_MODULES.map((module) => {
                    const enabled = restaurant.enabledModules.includes(module);
                    const isCore = module === MODULES.CORE;
                    return (
                      <button
                        key={module}
                        type="button"
                        disabled={isCore}
                        className={`evx-btn evx-btn--sm ${enabled ? 'evx-btn--secondary' : 'evx-btn--ghost'}`}
                        aria-pressed={enabled}
                        onClick={() =>
                          patch.mutate({
                            id: restaurant.id,
                            body: {
                              enabledModules: enabled
                                ? restaurant.enabledModules.filter((entry) => entry !== module)
                                : [...restaurant.enabledModules, module],
                            },
                          })
                        }
                      >
                        {enabled ? '✓ ' : ''}
                        {MODULE_LABELS[module] ?? module}
                      </button>
                    );
                  })}
                </div>

                <Select
                  className="!w-[150px]"
                  value={restaurant.status}
                  aria-label={`Statut de ${restaurant.name}`}
                  onChange={(event) =>
                    patch.mutate({ id: restaurant.id, body: { status: event.target.value } })
                  }
                >
                  <option value="TRIAL">Essai</option>
                  <option value="ACTIVE">Actif</option>
                  <option value="SUSPENDED">Suspendu</option>
                </Select>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-6 text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
          Les modules Commande, Cuisine, Caisse, Livraison, Fidélité et Factures sont prévus mais
          pas encore livrés : la plateforme refuse de les activer tant qu’ils n’existent pas.
        </p>
      </div>

      {creating ? (
        <CreateRestaurantModal
          onClose={() => setCreating(false)}
          onCreated={async (result) => {
            setCreating(false);
            setInvitation(result);
            await queryClient.invalidateQueries({ queryKey: ['platform-restaurants'] });
          }}
        />
      ) : null}

      {invitation ? (
        <Modal
          open
          onClose={() => setInvitation(null)}
          title="Restaurant créé"
          description="Transmettez ce lien à l’administrateur : il choisira son mot de passe et lancera sa mise en service."
          footer={<Button variant="primary" onClick={() => setInvitation(null)}>J’ai copié le lien</Button>}
        >
          <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
            Pour <b>{invitation.email}</b> :
          </p>
          <div className="flex gap-2 mt-3">
            <Input readOnly value={invitation.url} onFocus={(event) => event.target.select()} />
            <Button onClick={() => void navigator.clipboard.writeText(invitation.url)}>Copier</Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function CreateRestaurantModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (invitation: { email: string; url: string }) => Promise<void>;
}): JSX.Element {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.post<{ invitation: { email: string; url: string } }>('/platform/restaurants', {
        name,
        slug,
        adminFullName,
        adminEmail,
      }),
    onSuccess: (result) => void onCreated(result.invitation),
    onError: (cause) =>
      setError(cause instanceof ApiRequestError ? cause.message : 'Création impossible.'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Nouveau restaurant"
      description="Il démarrera en période d’essai, avec le socle et le module Menu QR."
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={create.isPending} onClick={() => create.mutate()}>
            Créer et inviter
          </Button>
        </>
      }
    >
      <Field label="Nom du restaurant" required>
        {(id) => (
          <Input
            id={id}
            autoFocus
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
          />
        )}
      </Field>

      <Field label="Adresse web" required hint="Elle sera encodée dans les codes QR.">
        {(id) => (
          <Input
            id={id}
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
          />
        )}
      </Field>

      <Field label="Nom de l’administrateur" required>
        {(id) => (
          <Input
            id={id}
            value={adminFullName}
            onChange={(event) => setAdminFullName(event.target.value)}
          />
        )}
      </Field>

      <Field label="Son adresse e-mail" required hint="Il recevra un lien pour prendre la main.">
        {(id) => (
          <Input
            id={id}
            type="email"
            value={adminEmail}
            onChange={(event) => setAdminEmail(event.target.value)}
          />
        )}
      </Field>

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
