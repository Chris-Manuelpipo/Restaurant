import { useEffect, useMemo, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Spin, useToast } from '@evolyx/ui';
import { ApiRequestError, api } from '../lib/api';
import { useSession } from '../lib/session';
import { PageHeader } from '../components/PageHeader';
import { MenuPreview, previewMoments } from '../components/MenuPreview';
import { StepIdentity } from '../onboarding/StepIdentity';
import { StepBranding } from '../onboarding/StepBranding';
import { StepHours } from '../onboarding/StepHours';
import type { RestaurantDraft } from '../onboarding/types';

/**
 * Identité, charte et horaires, après la mise en service.
 *
 * On réutilise **exactement** les mêmes formulaires que l'onboarding : le gérant retrouve
 * les écrans qu'il connaît déjà, et il n'y a qu'un seul endroit à corriger le jour où un
 * champ change.
 */

const TABS = [
  { key: 'identity', label: 'Identité' },
  { key: 'branding', label: 'Charte' },
  { key: 'hours', label: 'Infos & horaires' },
] as const;

export function BrandingPage(): JSX.Element {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { session } = useSession();

  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('identity');
  const [draft, setDraft] = useState<RestaurantDraft | null>(null);
  const [previewAt, setPreviewAt] = useState<string | null>(null);
  const moments = useMemo(() => previewMoments(), []);

  const restaurant = useQuery({
    queryKey: ['restaurant'],
    queryFn: () => api.get<RestaurantDraft>('/restaurant'),
  });

  useEffect(() => {
    if (restaurant.data) setDraft(restaurant.data);
  }, [restaurant.data]);

  const save = useMutation({
    mutationFn: (patch: Partial<RestaurantDraft>) => api.patch<RestaurantDraft>('/restaurant', patch),
    onSuccess: async (updated) => {
      setDraft((current) => ({ ...(current as RestaurantDraft), ...updated }));
      toast.success('Modifications enregistrées.');
      await queryClient.invalidateQueries({ queryKey: ['preview'] });
      await queryClient.invalidateQueries({ queryKey: ['session'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : 'Enregistrement impossible.'),
  });

  if (!draft) {
    return (
      <div className="grid place-items-center py-24">
        <Spin />
      </div>
    );
  }

  const apply = async (patch: Partial<RestaurantDraft> = {}): Promise<void> => {
    if (Object.keys(patch).length > 0) await save.mutateAsync(patch);
  };

  return (
    <>
      <PageHeader
        title="Identité et charte"
        lede="Ce que voient vos clients en haut du menu."
        actions={
          <Button
            form={`step-${tab}`}
            type="submit"
            size="sm"
            variant="primary"
            loading={save.isPending}
          >
            Enregistrer
          </Button>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
        <div className="page">
          <div className="flex gap-2 mb-7">
            {TABS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={`evx-btn evx-btn--sm ${tab === entry.key ? 'evx-btn--secondary' : 'evx-btn--ghost'}`}
                onClick={() => setTab(entry.key)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {tab === 'identity' ? (
            <StepIdentity draft={draft} onChange={setDraft} onNext={apply} busy={save.isPending} />
          ) : null}
          {tab === 'branding' ? (
            <StepBranding draft={draft} onChange={setDraft} onNext={apply} busy={save.isPending} />
          ) : null}
          {tab === 'hours' ? (
            <StepHours draft={draft} onChange={setDraft} onNext={apply} busy={save.isPending} />
          ) : null}
        </div>

        <aside className="preview-pane">
          <div className="w-full flex items-center justify-between">
            <b className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--ink-3)' }}>
              Aperçu client
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

          <MenuPreview
            slug={session?.restaurant?.slug ?? draft.slug}
            theme={draft.theme}
            at={previewAt}
            overrides={{ name: draft.name, tagline: draft.tagline }}
          />
        </aside>
      </div>
    </>
  );
}
