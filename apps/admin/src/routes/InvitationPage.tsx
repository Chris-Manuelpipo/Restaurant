import { useState, type FormEvent, type JSX } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button, Field, Input, Spin } from '@evolyx/ui';
import { ApiRequestError, api, setAccessToken } from '../lib/api';
import { useSession } from '../lib/session';

/**
 * Prise de possession d'un compte.
 *
 * Le platform-admin crée le restaurant, l'administrateur reçoit ce lien et choisit lui-même
 * son mot de passe : à aucun moment un mot de passe ne transite par un tiers. Le lien ne
 * sert qu'une fois.
 */
export function InvitationPage(): JSX.Element {
  const { token } = useParams({ from: '/invitation/$token' });
  const navigate = useNavigate();
  const { refresh } = useSession();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const invitation = useQuery({
    queryKey: ['invitation', token],
    queryFn: () =>
      api.get<{ email: string; fullName: string; restaurantName: string; role: string }>(
        `/auth/invite/${token}`,
      ),
    retry: false,
  });

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { accessToken } = await api.post<{ accessToken: string }>('/auth/invite/accept', {
        token,
        password,
      });
      setAccessToken(accessToken);
      await refresh();
      void navigate({ to: '/mise-en-service' });
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : 'Impossible de créer le compte.');
    } finally {
      setBusy(false);
    }
  };

  if (invitation.isLoading) {
    return (
      <div className="grid place-items-center min-h-dvh">
        <Spin label="Vérification de votre invitation…" />
      </div>
    );
  }

  if (invitation.isError) {
    return (
      <div className="grid place-items-center min-h-dvh p-8 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Ce lien n’est plus valable
          </h1>
          <p className="mt-3 text-sm" style={{ color: 'var(--ink-2)' }}>
            {invitation.error instanceof ApiRequestError
              ? invitation.error.message
              : 'Demandez une nouvelle invitation à Evolyx.'}
          </p>
          <Button className="mt-6" onClick={() => void navigate({ to: '/connexion' })}>
            Aller à la connexion
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid place-items-center min-h-dvh p-8">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="brand mb-8">
          <div className="brand__mark">E</div>
          <div>
            <b className="brand__name">Evolyx</b>
            <span className="brand__sub">{invitation.data?.restaurantName}</span>
          </div>
        </div>

        <h1 className="text-[26px] font-bold tracking-[-0.028em]" style={{ fontFamily: 'var(--font-display)' }}>
          Bienvenue, {invitation.data?.fullName.split(' ')[0]}.
        </h1>
        <p className="mt-2 mb-8 text-sm" style={{ color: 'var(--ink-2)' }}>
          Choisissez votre mot de passe pour prendre la main sur{' '}
          <b>{invitation.data?.restaurantName}</b>.
        </p>

        <Field label="Adresse e-mail">
          {(id) => <Input id={id} value={invitation.data?.email ?? ''} disabled />}
        </Field>

        <Field
          label="Mot de passe"
          required
          hint="Douze caractères minimum — une phrase courte fait très bien l’affaire."
        >
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>

        <Field label="Confirmation" required>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
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
          Créer mon compte
        </Button>
      </form>
    </div>
  );
}
