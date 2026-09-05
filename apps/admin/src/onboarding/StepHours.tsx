import { type FormEvent, type JSX } from 'react';
import { Field, Input, Switch } from '@evolyx/ui';
import { dayName } from '@evolyx/shared';
import { DEFAULT_WEEK, type OpeningHourDraft, type StepProps } from './types';

/**
 * Étape 3 — coordonnées et horaires.
 *
 * Le tableau des horaires accepte les services qui passent minuit sans rien demander : quand
 * la fermeture précède l'ouverture, on l'annonce simplement d'un « le lendemain ». C'est le
 * vendredi soir normal d'un grill, pas une erreur à corriger.
 */
export function StepHours({ draft, onChange, onNext }: StepProps): JSX.Element {
  const hours = draft.openingHours.length > 0 ? draft.openingHours : DEFAULT_WEEK;
  const ordered = [1, 2, 3, 4, 5, 6, 0].map(
    (day) =>
      hours.find((row) => row.dayOfWeek === day) ?? {
        dayOfWeek: day,
        isOpen: false,
        openTime: '11:00',
        closeTime: '22:00',
      },
  );

  const setDay = (dayOfWeek: number, patch: Partial<OpeningHourDraft>): void => {
    onChange({
      ...draft,
      openingHours: ordered.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)),
    });
  };

  const copyToAll = (source: OpeningHourDraft): void => {
    onChange({
      ...draft,
      openingHours: ordered.map((row) => ({
        ...row,
        openTime: source.openTime,
        closeTime: source.closeTime,
        isOpen: source.isOpen,
      })),
    });
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    void onNext({
      address: draft.address,
      phone: draft.phone,
      whatsapp: draft.whatsapp,
      openingHours: ordered,
    });
  };

  return (
    <form id="step-hours" onSubmit={submit}>
      <span className="eyebrow">Infos &amp; horaires</span>
      <h1 className="page-title">Où vous trouver, et quand.</h1>
      <p className="page-lede">
        Ces informations apparaissent en bas du menu, avec des boutons pour vous appeler ou
        lancer un itinéraire.
      </p>

      <Field label="Adresse" hint="Telle qu’un client la donnerait à un taxi.">
        {(id) => (
          <Input
            id={id}
            maxLength={240}
            value={draft.address ?? ''}
            onChange={(event) => onChange({ ...draft, address: event.target.value || null })}
            placeholder="Carrefour Bonamoussadi, face à la pharmacie — Douala"
          />
        )}
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Téléphone">
          {(id) => (
            <Input
              id={id}
              type="tel"
              value={draft.phone ?? ''}
              onChange={(event) => onChange({ ...draft, phone: event.target.value || null })}
              placeholder="+237 6 99 12 34 56"
            />
          )}
        </Field>

        <Field label="WhatsApp" hint="Laissez vide si c’est le même numéro.">
          {(id) => (
            <Input
              id={id}
              type="tel"
              value={draft.whatsapp ?? ''}
              onChange={(event) => onChange({ ...draft, whatsapp: event.target.value || null })}
              placeholder="+237 6 99 12 34 56"
            />
          )}
        </Field>
      </div>

      <Field
        label="Horaires d’ouverture"
        hint="Une fermeture avant l’ouverture signifie que le service passe minuit — c’est prévu."
      >
        {() => (
          <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: 'var(--rule)' }}>
            {ordered.map((row, index) => (
              <div
                key={row.dayOfWeek}
                className="flex items-center gap-3 px-4 py-[10px]"
                style={{
                  borderTop: index === 0 ? undefined : '1px solid var(--rule-2)',
                  background: row.isOpen ? 'var(--card)' : '#fbfaf7',
                }}
              >
                <div className="w-[92px] shrink-0 text-[13px] font-medium">
                  {dayName(row.dayOfWeek)}
                </div>

                <Switch
                  checked={row.isOpen}
                  label={`Ouvert le ${dayName(row.dayOfWeek).toLowerCase()}`}
                  onChange={(isOpen) => setDay(row.dayOfWeek, { isOpen })}
                />

                {row.isOpen ? (
                  <>
                    <input
                      type="time"
                      className="evx-input !w-[112px] !min-h-[34px] !py-1"
                      value={row.openTime}
                      onChange={(event) => setDay(row.dayOfWeek, { openTime: event.target.value })}
                      aria-label={`Ouverture ${dayName(row.dayOfWeek)}`}
                    />
                    <span style={{ color: 'var(--ink-3)' }}>→</span>
                    <input
                      type="time"
                      className="evx-input !w-[112px] !min-h-[34px] !py-1"
                      value={row.closeTime}
                      onChange={(event) => setDay(row.dayOfWeek, { closeTime: event.target.value })}
                      aria-label={`Fermeture ${dayName(row.dayOfWeek)}`}
                    />
                    {row.closeTime <= row.openTime ? (
                      <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                        le lendemain
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
                    Fermé
                  </span>
                )}

                <button
                  type="button"
                  className="evx-btn evx-btn--ghost evx-btn--sm ml-auto"
                  onClick={() => copyToAll(row)}
                >
                  Appliquer à tous
                </button>
              </div>
            ))}
          </div>
        )}
      </Field>
    </form>
  );
}
