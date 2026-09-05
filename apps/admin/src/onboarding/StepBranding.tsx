import { useMemo, type FormEvent, type JSX } from 'react';
import { Field, Input } from '@evolyx/ui';
import { DISPLAY_FONTS, deriveTheme, type DisplayFontKey, type ThemeInput } from '@evolyx/shared';
import type { StepProps } from './types';

/**
 * Étape 2 — la charte.
 *
 * Deux couleurs suffisent : tout le reste s'en déduit par `deriveTheme()`. Le contraste est
 * affiché en continu, et l'interface **avertit sans bloquer** — la charte appartient au
 * restaurant, pas à nous. On dit ce qu'on voit, le gérant tranche.
 */

const PRIMARY_SWATCHES = [
  '#FF6A2C',
  '#C2410C',
  '#B91C1C',
  '#15803D',
  '#0F3D2E',
  '#1F3FBF',
  '#7C3AED',
  '#B8791A',
];

const BACKGROUND_SWATCHES = [
  '#17130F',
  '#111827',
  '#1C1917',
  '#0B1F1A',
  '#FFFFFF',
  '#F3F5FA',
  '#FBF8F3',
  '#F6F4EF',
];

export function StepBranding({ draft, onChange, onNext }: StepProps): JSX.Element {
  const theme = draft.theme;
  const derived = useMemo(() => deriveTheme(theme), [theme]);

  const set = (patch: Partial<ThemeInput>): void => {
    onChange({ ...draft, theme: { ...theme, ...patch } });
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    void onNext({ theme });
  };

  const contrast = derived.contrast.textOnBackground;
  const ok = contrast >= 4.5;

  return (
    <form id="step-branding" onSubmit={submit}>
      <span className="eyebrow">Charte</span>
      <h1 className="page-title">Vos couleurs, votre menu.</h1>
      <p className="page-lede">
        Deux couleurs suffisent : tout le reste s’en déduit — surfaces, textes, séparateurs.
        L’aperçu à droite se met à jour à chaque frappe.
      </p>

      <Field
        label="Couleurs"
        hint="La couleur principale sert aux titres, aux prix et aux codes QR. Le fond donne le ton général."
      >
        {() => (
          <div className="grid sm:grid-cols-2 gap-4">
            <ColorPicker
              label="Principale"
              value={theme.primary}
              swatches={PRIMARY_SWATCHES}
              onChange={(primary) => set({ primary })}
            />
            <ColorPicker
              label="Fond"
              value={theme.background}
              swatches={BACKGROUND_SWATCHES}
              onChange={(background) => set({ background })}
            />
          </div>
        )}
      </Field>

      <div
        className="mt-4 flex items-center gap-[14px] p-[13px_15px] rounded-[12px] border"
        style={{
          background: ok ? 'var(--accent-soft)' : 'var(--amber-soft)',
          borderColor: ok ? 'var(--accent-line)' : 'var(--amber-line)',
        }}
      >
        <div
          className="gauge"
          style={{
            background: `conic-gradient(${ok ? 'var(--accent)' : 'var(--amber)'} 0 ${Math.min(
              100,
              (contrast / 21) * 100 * 2,
            )}%, ${ok ? '#D5E2DB' : '#EEDFC2'} 0)`,
            color: ok ? 'var(--accent)' : 'var(--amber)',
          }}
        >
          <span style={{ background: ok ? 'var(--accent-soft)' : 'var(--amber-soft)' }}>
            {contrast.toFixed(1)}
          </span>
        </div>
        <p className="text-[12.5px] leading-[1.45] m-0" style={{ color: 'var(--ink-2)' }}>
          <b className="block text-[13px] mb-[2px]" style={{ color: 'var(--ink)' }}>
            {ok
              ? `Contraste confortable — ${contrast.toFixed(1)}:1`
              : `Contraste faible — ${contrast.toFixed(1)}:1`}
          </b>
          {ok
            ? 'Vos textes resteront lisibles en plein soleil comme en salle sombre.'
            : 'Vos clients auront du mal à lire en plein soleil. Vous pouvez continuer, mais un fond plus contrasté aiderait.'}
        </p>
      </div>

      {derived.warnings
        .filter((warning) => warning.code !== 'LOW_TEXT_CONTRAST')
        .map((warning) => (
          <p
            key={warning.code}
            className="mt-3 p-3 rounded-[10px] text-[12.5px] leading-[1.45]"
            style={{ background: 'var(--amber-soft)', color: 'var(--ink-2)' }}
          >
            {warning.message}
          </p>
        ))}

      <Field
        label="Police des titres"
        hint="Le corps du texte reste en Inter, choisi pour sa lisibilité sur petits écrans."
      >
        {() => (
          <div className="grid gap-[10px]" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))' }}>
            {DISPLAY_FONTS.map((font) => (
              <button
                key={font.key}
                type="button"
                className="font-card"
                aria-pressed={theme.fontDisplay === font.key}
                onClick={() => set({ fontDisplay: font.key as DisplayFontKey })}
              >
                <div className="font-card__spec" style={{ fontFamily: font.stack }}>
                  Ndolè
                </div>
                <div className="font-card__name">
                  {font.label} · {font.note.toLowerCase()}
                </div>
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field
        label="Angles"
        hint="Des angles vifs pour une carte sobre, arrondis pour un ton chaleureux."
      >
        {(id) => (
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              {[0, 10, 20].map((radius) => (
                <span
                  key={radius}
                  className="w-[34px] h-[34px] block"
                  style={{
                    borderRadius: radius,
                    border: `1.5px solid ${
                      Math.abs(theme.cornerRadius - radius) < 6 ? 'var(--accent)' : 'var(--rule)'
                    }`,
                    background: 'var(--card)',
                  }}
                />
              ))}
            </div>
            <input
              id={id}
              type="range"
              min={0}
              max={24}
              step={2}
              value={theme.cornerRadius}
              onChange={(event) => set({ cornerRadius: Number(event.target.value) })}
              className="flex-1"
              style={{ accentColor: 'var(--accent)' }}
              aria-label="Rayon des angles"
            />
            <code className="text-[12px] tabular-nums" style={{ color: 'var(--ink-2)' }}>
              {theme.cornerRadius} px
            </code>
          </div>
        )}
      </Field>
    </form>
  );
}

function ColorPicker({
  label,
  value,
  swatches,
  onChange,
}: {
  label: string;
  value: string;
  swatches: string[];
  onChange: (color: string) => void;
}): JSX.Element {
  return (
    <div className="p-[14px] rounded-[12px] border" style={{ borderColor: 'var(--rule)', background: 'var(--card)' }}>
      <div className="flex items-center justify-between mb-[11px]">
        <b className="text-[12.5px] font-semibold">{label}</b>
        <label className="flex items-center gap-2">
          <span className="sr-only">Code hexadécimal — {label}</span>
          <Input
            value={value.toUpperCase()}
            onChange={(event) => {
              const next = event.target.value.trim();
              if (/^#?[0-9a-f]{0,6}$/i.test(next)) {
                onChange(next.startsWith('#') ? next : `#${next}`);
              }
            }}
            className="!w-[92px] !min-h-[28px] !py-1 !px-2 font-mono !text-[11.5px]"
            style={{ background: 'var(--paper)' }}
          />
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            className="w-7 h-7 rounded-md border-0 cursor-pointer bg-transparent p-0"
            aria-label={`Sélecteur de couleur — ${label}`}
          />
        </label>
      </div>
      <div className="swatch-grid">
        {swatches.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className="swatch"
            style={{
              background: swatch,
              borderColor: swatch === '#FFFFFF' ? 'var(--rule)' : undefined,
            }}
            aria-pressed={value.toUpperCase() === swatch}
            aria-label={swatch}
            onClick={() => onChange(swatch)}
          />
        ))}
      </div>
    </div>
  );
}
