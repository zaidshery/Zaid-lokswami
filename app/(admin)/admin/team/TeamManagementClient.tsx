'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, ShieldCheck, ShieldOff, Trash2, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { ADMIN_ROLES, formatUserRoleLabel, type AdminRole } from '@/lib/auth/roles';
import { formatUiDateTime } from '@/lib/utils/dateFormat';

type TeamMember = {
  id: string;
  name: string;
  email: string;
  image: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
};

const ADMIN_ROLE_OPTIONS = ADMIN_ROLES.map((role) => ({
  value: role,
  label: formatUserRoleLabel(role),
}));

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Never';
  }

  return formatUiDateTime(value, 'Never');
}

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }

  return (parts[0]?.slice(0, 2) || 'TM').toUpperCase();
}

export default function TeamManagementClient() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('editor');
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    void fetchMembers();
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(''), 2400);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  async function fetchMembers() {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/team', { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load team members');
      }

      setMembers(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInvite() {
    setIsInviting(true);
    setError('');

    try {
      const response = await fetch('/api/admin/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, role }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to invite member');
      }

      setName('');
      setEmail('');
      setRole('editor');
      setToastMessage('सदस्य जोड़ा गया ✓');
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite member');
    } finally {
      setIsInviting(false);
    }
  }

  async function updateMember(id: string, updates: Partial<Pick<TeamMember, 'role' | 'isActive' | 'name'>>) {
    setActiveMemberId(id);
    setError('');

    try {
      const response = await fetch(`/api/admin/team/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update member');
      }

      setToastMessage('Member updated');
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update member');
    } finally {
      setActiveMemberId(null);
    }
  }

  async function demoteMember(id: string) {
    setActiveMemberId(id);
    setError('');

    try {
      const response = await fetch(`/api/admin/team/${id}`, {
        method: 'DELETE',
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to remove member');
      }

      setToastMessage('Member moved to reader');
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setActiveMemberId(null);
    }
  }

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.email.localeCompare(b.email)),
    [members]
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-600 dark:text-red-400">
              Team Access
            </p>
            <h1 className="mt-2 text-3xl font-black text-zinc-900 dark:text-zinc-100">
              सदस्य आमंत्रित करें
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              Create or promote team accounts, manage access levels, and deactivate members when needed.
            </p>
          </div>

          <div className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            <ShieldCheck className="mr-2 h-4 w-4" />
            <span>Super Admin Only</span>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_220px_auto]">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="नाम (optional)"
            className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-red-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@example.com"
            className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-red-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as AdminRole)}
            className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-red-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {ADMIN_ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleInvite()}
            disabled={isInviting}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            <span>{isInviting ? 'Adding...' : 'सदस्य आमंत्रित करें'}</span>
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center rounded-3xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <Loader2 className="h-6 w-6 animate-spin text-red-500" />
          </div>
        ) : sortedMembers.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            No team members found yet.
          </div>
        ) : (
          sortedMembers.map((member, index) => {
            const isBusy = activeMemberId === member.id;

            return (
              <motion.article
                key={member.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-start gap-4">
                  <div className="relative inline-flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-full bg-red-100 text-sm font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                    {member.image ? (
                      <Image
                        src={member.image}
                        alt={member.name || member.email}
                        fill
                        sizes="48px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      getInitials(member.name, member.email)
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {member.name || member.email.split('@')[0]}
                    </p>
                    <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                      {member.email}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                        {formatUserRoleLabel(member.role)}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          member.isActive
                            ? 'border border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                        }`}
                      >
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-zinc-400" />
                    <span>Last login: {formatDateTime(member.lastLoginAt)}</span>
                  </div>
                  <div>Joined: {formatDateTime(member.createdAt)}</div>
                </div>

                <div className="mt-5 space-y-3">
                  <select
                    value={member.role}
                    onChange={(event) =>
                      void updateMember(member.id, { role: event.target.value as AdminRole })
                    }
                    disabled={isBusy}
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-red-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    {ADMIN_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void updateMember(member.id, { isActive: !member.isActive })}
                      disabled={isBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : member.isActive ? (
                        <ShieldOff className="h-4 w-4" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      <span>{member.isActive ? 'Deactivate' : 'Reactivate'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void demoteMember(member.id)}
                      disabled={isBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10"
                    >
                      {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </motion.article>
            );
          })
        )}
      </div>

      {toastMessage ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-lg dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}
