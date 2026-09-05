import { useEffect, useMemo, useState, type JSX } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Spin, useToast } from '@evolyx/ui';
import { DEFAULT_THEME, type ThemeInput } from '@evolyx/shared';
import { ApiRequestError, api } from '../lib/api';
import { useSession } from '../lib/session';
import { MenuPreview, previewMoments } from '../components/MenuPreview';
import { StepIdentity } from '../onboarding/StepIdentity';
import { StepBranding } from '../onboarding/StepBranding';
import { StepHours } from '../onboarding/StepHours';
import { StepMenu } from '../onboarding/StepMenu';
import { StepAccessPoints } from '../onboarding/StepAccessPoints';
import type { RestaurantDraft } from '../onboarding/types';

/**
 * Mise en service, en cinq étapes.
 *
 * Trois colonnes, comme la maquette : les étapes à gauche, le formulaire au centre, l'aperçu
 * client à droite. L'aperçu suit chaque frappe et interroge le vrai endpoint public — ce
 * n'est pas une imitation du menu, c'est le menu.
 *
 * Chaque étape enregistre en passant à la suivante : un gérant interrompu par un service ne
 * perd rien, et reprend là où il s'était arrêté.
 */

const STEPS = [
  { key: 'identity', title: 'Identité', hint: 'Nom, logo, adresse web' },
  { key: 'branding', title: 'Charte', hint: 'Couleurs, police, angles' },
  { key: 'hours', title: 'Infos & horaires', hint: 'Contact, ouverture' },
  { key: 'menu', title: 'Menu', hint: 'Collez votre carte' },
  { key: 'access', title: 'Codes QR', hint: 'Tables et affiches' },
] as const;

export function OnboardingPage(): JSX.Element {
  const { session, refresh } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const restaurantId = session?.restaurant?.id;
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<RestaurantDraft | null>(null);
  const [previewAt, setPreviewAt] = useState<string | null>(null);

  const moments = useMemo(() => previewMoments(), []);

  const restaurant = useQuery({
    queryKey: ['restaurant'],
    queryFn: () => api.get<RestaurantDraft & { themePreview: unknown }>('/restaurant'),
    enabled: Boolean(restaurantId),
  });

  useEffect(() => {
    if (restaurant.data && !draft) {
      setDraft(restaurant.data);
      // On reprend là où le gérant s'était arrêté, sans jamais le renvoyer en arrière.
      setStep(Math.min(session?.restaurant?.onboardingStep ?? 0, STEPS.length - 1));
    }
  }, [restaurant.data, draft, session]);

  const save = useMutation({
    mutationFn: (patch: Partial<RestaurantDraft>) => api.patch<RestaurantDraft>('/restaurant', patch),
    onSuccess: (updated) => {
      setDraft((current) => ({ ...(current as RestaurantDraft), ...updated }));
      void queryClient.invalidateQueries({ queryKey: ['preview'] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiRequestError ? error.message : 'Enregistrement impossible.');
    },
  });

  const markStep = useMutation({
    mutationFn: (payload: { step: number; complete?: boolean }) =>
      api.post('/restaurant/onboarding', payload),
  });

  if (!draft || restaurant.isLoading) {
    return (
      <div className="grid place-items-center min-h-dvh">
        <Spin label="Préparation de votre espace…" />
      </div>
    );
  }

  const theme: ThemeInput = { ...DEFAULT_THEME, ...(draft.theme ?? {}) };

  const goNext = async (patch: Partial<RestaurantDraft> = {}): Promise<void> => {
    if (Object.keys(patch).length > 0) await save.mutateAsync(patch);
    const next = step + 1;

    if (next >= STEPS.length) {
      await markStep.mutateAsync({ step: STEPS.length, complete: true });
      await refresh();
      toast.success('Votre menu est en ligne.');
      void navigate({ to: '/carte' });
      return;
    }

    await markStep.mutateAsync({ step: next });
    setStep(next);
  };

  const current = STEPS[step]!;

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 392px' }}>
      <div className="min-w-0 flex flex-col min-h-dvh">
        <div className="topbar">
          <p className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
            Mise en service ·{' '}
            <b style={{ color: 'var(--ink)' }}>
              Étape {step + 1} sur {STEPS.length}
            </b>
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void markStep.mutateAsync({ step });
              void navigate({ to: '/carte' });
            }}
          >
            Enregistrer et quitter
          </Button>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '230px minmax(0,1fr)' }}>
          <aside className="px-5 py-7 border-r" style={{ borderColor: 'var(--rule)' }}>
            <p className="nav-kicker" style={{ margin: '0 0 14px' }}>
              Mise en service
            </p>
            <ol className="steps">
              {STEPS.map((entry, index) => (
                <li
                  key={entry.key}
                  className="step"
                  data-state={index < step ? 'done' : index === step ? 'now' : 'todo'}
                >
                  <button
                    type="button"
                    className="step__bullet"
                    // On peut revenir sur une étape franchie, jamais sauter en avant.
                    onClick={() => index < step && setStep(index)}
                    disabled={index >= step}
                    aria-label={`Étape ${index + 1} : ${entry.title}`}
                  >
                    {index < step ? '✓' : index + 1}
                  </button>
                  <span className="step__text">
                    <b>{entry.title}</b>
                    <small>{entry.hint}</small>
                  </span>
                </li>
              ))}
            </ol>

            <div
              className="mt-8 p-3 rounded-[10px] flex gap-[10px] text-[12px] leading-[1.45]"
              style={{ background: 'var(--paper)', color: 'var(--ink-2)' }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                className="shrink-0 mt-px"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              Tout reste modifiable après la mise en ligne. Les codes QR imprimés, eux, ne
              changent jamais.
            </div>
          </aside>

          <div className="min-w-0 flex flex-col">
            <div className="px-8 py-9 pb-28 max-w-[660px]">
              {current.key === 'identity' ? (
                <StepIdentity draft={draft} onChange={setDraft} onNext={goNext} busy={save.isPending} />
              ) : null}
              {current.key === 'branding' ? (
                <StepBranding draft={draft} onChange={setDraft} onNext={goNext} busy={save.isPending} />
              ) : null}
              {current.key === 'hours' ? (
                <StepHours draft={draft} onChange={setDraft} onNext={goNext} busy={save.isPending} />
              ) : null}
              {current.key === 'menu' ? <StepMenu onNext={goNext} /> : null}
              {current.key === 'access' ? <StepAccessPoints onNext={goNext} /> : null}
            </div>

            <div className="actionbar mt-auto">
              <div className="progress">
                <span className="progress__bar">
                  <span
                    className="progress__fill"
                    style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                  />
                </span>
                Étape {step + 1} sur {STEPS.length}
              </div>
              <div className="flex gap-[10px]">
                <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
                  Retour
                </Button>
                <Button
                  form={`step-${current.key}`}
                  type="submit"
                  variant="primary"
                  loading={save.isPending || markStep.isPending}
                >
                  {step === STEPS.length - 1 ? 'Publier mon menu' : 'Continuer'}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside className="preview-pane">
        <div className="w-full flex items-center justify-between">
          <b
            className="text-xs font-bold uppercase tracking-[0.1em]"
            style={{ color: 'var(--ink-3)' }}
          >
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
          slug={draft.slug}
          theme={theme}
          at={previewAt}
          overrides={{ name: draft.name, tagline: draft.tagline }}
        />

        <p
          className="text-[11.5px] text-center max-w-[26ch] leading-[1.45] m-0"
          style={{ color: 'var(--ink-3)' }}
        >
          C’est exactement ce que verront vos clients en scannant une table.
        </p>
      </aside>
    </div>
  );
}
