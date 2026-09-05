import { useState, type FormEvent, type JSX } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button, Field, Input } from '@evolyx/ui';
import { ApiRequestError, login } from '../lib/api';
import { useSession } from '../lib/session';

/**
 * Connexion.
 *
 * Un écran, deux champs. Le message d'erreur reste volontairement le même que l'adresse soit
 * inconnue ou le mot de passe faux — l'API n'en dit pas plus, l'interface non plus.
 */
export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const { refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await login(email, password);
      await refresh();
      const destination =
        session.restaurant && session.restaurant.onboardingCompletedAt === null
          ? '/mise-en-service'
          : session.user.role === 'PLATFORM_ADMIN'
            ? '/plateforme'
            : '/carte';
      void navigate({ to: destination });
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : 'Connexion impossible. Vérifiez votre réseau.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1fr_minmax(0,480px)]">
      {/* Panneau d'identité — présent sur grand écran seulement. */}
      <div
        className="hidden lg:flex flex-col justify-between p-12"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-[10px] grid place-items-center font-bold"
            style={{ background: 'rgb(255 255 255 / .15)', fontFamily: 'var(--font-display)' }}
          >
            E
          </div>
          <b style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>Evolyx</b>
        </div>

        <div className="max-w-md">
          <h1
            className="text-[38px] leading-[1.1] font-bold tracking-[-0.03em]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Votre carte, à jour,
            <br />
            dans la poche de vos clients.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed" style={{ color: 'rgb(255 255 255 / .75)' }}>
            Modifiez un prix, marquez un plat épuisé : le menu de la salle suit en moins d’une
            minute. Les codes QR collés sous vos tables, eux, ne bougent jamais.
          </p>
        </div>

        <p className="text-xs" style={{ color: 'rgb(255 255 255 / .5)' }}>
          Plateforme de gestion pour restaurants · Douala, Cameroun
        </p>
      </div>

      <div className="grid place-items-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm">
          <h2
            className="text-[26px] font-bold tracking-[-0.028em]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Connexion
          </h2>
          <p className="mt-2 mb-8 text-sm" style={{ color: 'var(--ink-2)' }}>
            Accédez à votre back-office.
          </p>

          <Field label="Adresse e-mail" required>
            {(id) => (
              <Input
                id={id}
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="vous@votre-restaurant.cm"
              />
            )}
          </Field>

          <Field label="Mot de passe" required>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </Field>

          {error ? (
            <p
              className="mt-5 p-3 rounded-[10px] text-[13px]"
              role="alert"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full mt-7">
            Se connecter
          </Button>
        </form>
      </div>
    </div>
  );
}
