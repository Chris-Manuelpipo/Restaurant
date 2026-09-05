import { useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Field, Input, Modal, Select, Spin, useToast } from '@evolyx/ui';
import { ApiRequestError, api } from '../lib/api';
import { useSession } from '../lib/session';
import { PageHeader } from '../components/PageHeader';
import { roleLabel } from '../components/AppShell';

/**
 * L'équipe.
 *
 * Un compte ne se supprime pas : il se désactive. Ses actions restent attribuées dans le
 * journal — c'est précisément ce à quoi sert un journal.
 */

interface TeamMember {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_HINTS: Record<TeamMember['role'], string> = {
  ADMIN: 'Tout, y compris la charte et les comptes.',
  MANAGER: 'La carte, les règles et les codes QR.',
  STAFF: 'Lecture, et marquer un plat épuisé.',
};

export function TeamPage(): JSX.Element {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const [creating, setCreating] = useState(false);
  const [invitation, setInvitation] = useState<{ email: string; url: string } | null>(null);

  const team = useQuery({ queryKey: ['users'], queryFn: () => api.get<TeamMember[]>('/users') });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/users/${id}`, { isActive }),
    onSuccess: async (_data, { isActive }) => {
      toast.success(isActive ? 'Compte réactivé.' : 'Compte désactivé.');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : 'Modification impossible.'),
  });

  if (team.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spin />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="L’équipe"
        lede="Qui peut faire quoi dans votre back-office."
        actions={
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            Inviter quelqu’un
          </Button>
        }
      />

      <div className="page max-w-[820px]">
        <div className="evx-card">
          {(team.data ?? []).map((member) => (
            <div key={member.id} className="row">
              <div
                className="w-9 h-9 rounded-full grid place-items-center shrink-0 font-semibold text-[12px]"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                aria-hidden
              >
                {member.fullName
                  .split(' ')
                  .map((part) => part.charAt(0))
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="m-0 font-semibold truncate">
                  {member.fullName}
                  {member.id === session?.user.id ? (
                    <span className="ml-2 text-[11.5px] font-normal" style={{ color: 'var(--ink-3)' }}>
                      (vous)
                    </span>
                  ) : null}
                </p>
                <p className="m-0 text-[12px] truncate" style={{ color: 'var(--ink-3)' }}>
                  {member.email}
                </p>
              </div>

              <Badge tone={member.role === 'ADMIN' ? 'accent' : 'neutral'}>
                {roleLabel(member.role)}
              </Badge>

              {!member.isActive ? <Badge tone="danger">Désactivé</Badge> : null}

              <span className="text-[12px] w-32 text-right shrink-0" style={{ color: 'var(--ink-3)' }}>
                {member.lastLoginAt
                  ? `vu le ${new Date(member.lastLoginAt).toLocaleDateString('fr')}`
                  : 'jamais connecté'}
              </span>

              {member.id !== session?.user.id ? (
                <Button
                  size="sm"
                  variant={member.isActive ? 'ghost' : 'secondary'}
                  onClick={() => toggle.mutate({ id: member.id, isActive: !member.isActive })}
                >
                  {member.isActive ? 'Désactiver' : 'Réactiver'}
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-6 grid sm:grid-cols-3 gap-3">
          {(Object.keys(ROLE_HINTS) as TeamMember['role'][]).map((role) => (
            <div
              key={role}
              className="p-4 rounded-[12px] border"
              style={{ borderColor: 'var(--rule)', background: 'var(--card)' }}
            >
              <b className="text-[13px]">{roleLabel(role)}</b>
              <p className="mt-1 mb-0 text-[12.5px] leading-[1.5]" style={{ color: 'var(--ink-3)' }}>
                {ROLE_HINTS[role]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {creating ? (
        <InviteModal
          onClose={() => setCreating(false)}
          onInvited={async (result) => {
            setCreating(false);
            setInvitation(result);
            await queryClient.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      ) : null}

      {invitation ? (
        <Modal
          open
          onClose={() => setInvitation(null)}
          title="Lien d’invitation"
          description="Transmettez-le à la personne concernée : il ne sera plus affiché."
          footer={<Button variant="primary" onClick={() => setInvitation(null)}>J’ai copié le lien</Button>}
        >
          <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
            Pour <b>{invitation.email}</b> :
          </p>
          <div className="flex gap-2 mt-3">
            <Input readOnly value={invitation.url} onFocus={(event) => event.target.select()} />
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(invitation.url);
              }}
            >
              Copier
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function InviteModal({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (result: { email: string; url: string }) => Promise<void>;
}): JSX.Element {
  const toast = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamMember['role']>('STAFF');
  const [mode, setMode] = useState<'invite' | 'password'>('invite');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.post<{ user: TeamMember | null; invitation: { email: string; url: string } | null }>(
        '/users',
        {
          fullName,
          email,
          role,
          ...(mode === 'password' ? { password } : {}),
        },
      ),
    onSuccess: async (result) => {
      if (result.invitation) {
        await onInvited(result.invitation);
      } else {
        toast.success('Compte créé.');
        onClose();
      }
    },
    onError: (cause) =>
      setError(cause instanceof ApiRequestError ? cause.message : 'Création impossible.'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Ajouter quelqu’un à l’équipe"
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={create.isPending} onClick={() => create.mutate()}>
            {mode === 'invite' ? 'Envoyer l’invitation' : 'Créer le compte'}
          </Button>
        </>
      }
    >
      <Field label="Nom complet" required>
        {(id) => (
          <Input id={id} autoFocus value={fullName} onChange={(event) => setFullName(event.target.value)} />
        )}
      </Field>

      <Field label="Adresse e-mail" required>
        {(id) => (
          <Input id={id} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        )}
      </Field>

      <Field label="Rôle" required hint={ROLE_HINTS[role]}>
        {(id) => (
          <Select
            id={id}
            value={role}
            onChange={(event) => setRole(event.target.value as TeamMember['role'])}
          >
            <option value="STAFF">Salle</option>
            <option value="MANAGER">Gérant</option>
            <option value="ADMIN">Administrateur</option>
          </Select>
        )}
      </Field>

      <Field
        label="Mot de passe"
        hint="Par invitation, la personne choisit elle-même son mot de passe — c’est plus sûr."
      >
        {() => (
          <>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                className={`evx-btn evx-btn--sm ${mode === 'invite' ? 'evx-btn--secondary' : 'evx-btn--ghost'}`}
                onClick={() => setMode('invite')}
              >
                Par invitation
              </button>
              <button
                type="button"
                className={`evx-btn evx-btn--sm ${mode === 'password' ? 'evx-btn--secondary' : 'evx-btn--ghost'}`}
                onClick={() => setMode('password')}
              >
                Je définis le mot de passe
              </button>
            </div>
            {mode === 'password' ? (
              <Input
                type="text"
                minLength={12}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Douze caractères minimum"
                aria-label="Mot de passe"
              />
            ) : null}
          </>
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
