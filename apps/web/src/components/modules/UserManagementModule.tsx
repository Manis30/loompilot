import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  Copy,
  Check,
  Shield,
  UserCheck,
  Building,
  Mail,
  ExternalLink,
  Lock,
  ArrowRight
} from 'lucide-react';
import type { AppUser, UserInvite, UserRole } from '../../types';
import { useGetClientsQuery } from '../../store/api/catalogApi';

interface UserManagementModuleProps {
  users: AppUser[];
  invites: UserInvite[];
  onAddInvite: (invite: Omit<UserInvite, 'id' | 'inviteToken' | 'inviteLink' | 'createdAt' | 'expiresAt' | 'status'>) => UserInvite;
  onCompleteRegistration: (inviteToken: string, name: string, email: string, role: UserRole, departmentOrCompany: string) => void;
}

export const UserManagementModule: React.FC<UserManagementModuleProps> = ({
  users,
  invites,
  onAddInvite,
  onCompleteRegistration
}) => {
  const [filterRole, setFilterRole] = useState<'all' | 'supervisor' | 'client' | 'admin' | 'pending'>('all');
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Invite Form State
  const [inviteName, setInviteName] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<UserRole>('supervisor');
  const [inviteDept, setInviteDept] = useState<string>('');
  const [generatedInvite, setGeneratedInvite] = useState<UserInvite | null>(null);

  // Registration Simulator Modal State
  const [activeRegisterInvite, setActiveRegisterInvite] = useState<UserInvite | null>(null);
  const [regPassword, setRegPassword] = useState<string>('textile2026!');
  const [regSuccessMsg, setRegSuccessMsg] = useState<string | null>(null);

  // 1. Fetch real client records from backend API
  const {
    data: clientsResponse,
    isLoading: isClientsLoading,
    isError: isClientsError,
    error: clientsError
  } = useGetClientsQuery({ limit: 100 });

  // 2. Map API clients to AppUser shape
  const clientUsers: AppUser[] = useMemo(() => {
    const rawList = clientsResponse?.data;
    if (!rawList || !Array.isArray(rawList)) return [];
    return rawList.map((c: any) => ({
      id: c._id || c.id,
      name: c.contactPerson || c.clientName || 'Client Contact',
      email: c.email || c.portalAccess?.email || '',
      role: 'client' as const,
      title: c.contactPerson ? `${c.clientName} (Contact)` : 'Procurement Partner',
      departmentOrCompany: c.clientName || c.customerType || 'Contract Client',
      status: (c.portalAccess?.status === 'invited' ? 'invited' : c.status === 'active' ? 'active' : 'suspended') as 'active' | 'invited' | 'suspended',
      joinedAt: c.createdAt ? String(c.createdAt).slice(0, 10) : '2026-06-01',
      avatar: '/assets/avatar.svg',
    }));
  }, [clientsResponse]);

  // 3. Combine staff users (admin, supervisor) with real client users, replacing mock client records
  const staffUsers = useMemo(() => users.filter((u) => u.role !== 'client'), [users]);
  const activeUsers = useMemo(() => {
    if (clientUsers.length > 0) {
      return [...staffUsers, ...clientUsers];
    }
    return isClientsLoading ? staffUsers : (isClientsError ? users : [...staffUsers, ...clientUsers]);
  }, [staffUsers, clientUsers, isClientsLoading, isClientsError, users]);

  const handleCreateInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    const newInv = onAddInvite({
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
      departmentOrCompany: inviteDept.trim() || (inviteRole === 'supervisor' ? 'Weaving Floor Shed A' : 'Contract Client')
    });

    setGeneratedInvite(newInv);
    setInviteName('');
    setInviteEmail('');
    setInviteDept('');
  };

  const handleCopyLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRegisterInvite) return;

    onCompleteRegistration(
      activeRegisterInvite.inviteToken,
      activeRegisterInvite.name,
      activeRegisterInvite.email,
      activeRegisterInvite.role,
      activeRegisterInvite.departmentOrCompany
    );

    setRegSuccessMsg(`Account for ${activeRegisterInvite.name} activated! The user can now log in as ${activeRegisterInvite.role.toUpperCase()}.`);
    setTimeout(() => {
      setRegSuccessMsg(null);
      setActiveRegisterInvite(null);
      setShowInviteModal(false);
      setGeneratedInvite(null);
    }, 2000);
  };

  // Filter logic
  const filteredUsers = activeUsers.filter((u) => {
    if (filterRole === 'all') return true;
    if (filterRole === 'pending') return false;
    return u.role === filterRole;
  });

  const pendingInvites = invites.filter((inv) => inv.status === 'pending');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', overflowY: 'auto', paddingRight: 4, background: '#ffffff' }}>
      {/* 1. Header Bar */}
      <div className="module-header-flat">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text-primary)' }}>
            User Management
          </h1>
        </div>

        <button
          className="admin-btn-primary"
          style={{ padding: '7px 18px', fontSize: 11.5 }}
          onClick={() => {
            setGeneratedInvite(null);
            setShowInviteModal(true);
          }}
        >
          <UserPlus size={14} />
          <span>Invite New User</span>
        </button>
      </div>

      {/* 2. Filter Pills */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: `All Active (${activeUsers.length})` },
            { key: 'supervisor', label: `Supervisors (${activeUsers.filter(u => u.role === 'supervisor').length})` },
            { key: 'client', label: isClientsLoading ? 'Clients (Loading...)' : `Clients (${clientUsers.length > 0 ? clientUsers.length : activeUsers.filter(u => u.role === 'client').length})` },
            { key: 'admin', label: `Admins (${activeUsers.filter(u => u.role === 'admin').length})` },
            { key: 'pending', label: `Pending Invites (${pendingInvites.length})` }
          ].map((pill) => {
            const isActive = filterRole === pill.key;
            return (
              <button
                key={pill.key}
                onClick={() => setFilterRole(pill.key as any)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 9999,
                  border: isActive ? '1px solid #c6e5db' : '1px solid #e2e8f0',
                  background: isActive ? '#F8F0DF' : '#ffffff',
                  color: isActive ? '#18191B' : '#64748b',
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Shield size={13} color="#111315" />
          <span>3 User Roles: Admin &bull; Supervisor &bull; Client</span>
        </div>
      </div>

      {/* 3. Main Directory Table */}
      <div style={{
        background: '#ffffff',
        borderRadius: 24,
        border: '1px solid #e5e9ee',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        flex: 1
      }}>
        {filterRole !== 'pending' ? (
          <>
            {/* Table Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1.3fr 100px 1.4fr 100px 80px',
              gap: 12,
              padding: '8px 6px',
              borderBottom: '1px solid #edf1f5',
              fontSize: 11,
              fontWeight: 700,
              color: '#64748b'
            }}>
              <span>User & Title</span>
              <span>Email Address</span>
              <span>Role</span>
              <span>Assigned Unit / Company</span>
              <span>Status</span>
              <span>Joined</span>
            </div>

            {/* Loading State for Clients */}
            {filterRole === 'client' && isClientsLoading ? (
              <div style={{
                padding: '48px 16px',
                textAlign: 'center',
                color: '#64748b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10
              }}>
                <div style={{
                  width: 24,
                  height: 24,
                  border: '2.5px solid #e2e8f0',
                  borderTopColor: '#18191B',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#18191B' }}>
                  Loading Client Records...
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  Fetching live client portfolio from LoomPilot database
                </span>
              </div>
            ) : filterRole === 'client' && isClientsError ? (
              /* Error State for Clients */
              <div style={{
                padding: '16px 20px',
                margin: '12px 0',
                borderRadius: 16,
                background: '#fef2f2',
                border: '1px solid #fecdd3',
                color: '#991b1b',
                fontSize: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                <strong style={{ fontSize: 13 }}>Failed to load clients</strong>
                <span>
                  {(clientsError as any)?.data?.error?.message ||
                   (clientsError as any)?.data?.message ||
                   (clientsError as any)?.error ||
                   'Could not retrieve clients from backend API.'}
                </span>
              </div>
            ) : filteredUsers.length === 0 ? (
              /* Empty State */
              <div style={{
                padding: '48px 16px',
                textAlign: 'center',
                color: '#64748b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0a0d10' }}>
                  No {filterRole === 'client' ? 'client' : filterRole === 'all' ? 'active' : filterRole} records found
                </div>
                <div style={{ fontSize: 11 }}>
                  {filterRole === 'client'
                    ? 'No registered clients found in the database.'
                    : 'Try switching filters or inviting a new user.'}
                </div>
              </div>
            ) : (
              /* Rows List */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.4fr 1.3fr 100px 1.4fr 100px 80px',
                      gap: 12,
                      padding: '10px 6px',
                      borderBottom: '1px solid #edf1f5',
                      alignItems: 'center',
                      fontSize: 11.5
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: u.role === 'admin' ? '#F8F0DF' : (u.role === 'supervisor' ? '#e0f2fe' : '#ede9fe'),
                        color: u.role === 'admin' ? '#18191B' : (u.role === 'supervisor' ? '#0369a1' : '#5b21b6'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 12
                      }}>
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0a0d10' }}>{u.name}</div>
                        {u.title && <div style={{ fontSize: 10, color: '#64748b' }}>{u.title}</div>}
                      </div>
                    </div>

                    <div style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Mail size={13} color="#94a3b8" />
                      <span>{u.email}</span>
                    </div>

                    <div>
                      <span style={{
                        background: u.role === 'admin' ? '#F8F0DF' : (u.role === 'supervisor' ? '#e0f2fe' : '#ede9fe'),
                        color: u.role === 'admin' ? '#18191B' : (u.role === 'supervisor' ? '#0369a1' : '#5b21b6'),
                        fontSize: 9,
                        padding: '3px 8px',
                        borderRadius: 9999,
                        fontWeight: 700
                      }}>
                        {u.role.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building size={13} color="#94a3b8" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.departmentOrCompany}
                      </span>
                    </div>

                    <div>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: u.status === 'active' ? '#16a34a' : '#94a3b8'
                      }}>
                        <span style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: u.status === 'active' ? '#16a34a' : '#94a3b8'
                        }} />
                        {u.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                      {u.joinedAt || '2026-10-15'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Pending Invites View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0a0d10' }}>
              Pending Registration Invites ({pendingInvites.length})
            </h4>

            {pendingInvites.length === 0 ? (
              <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 32 }}>
                No pending invites. All invited users have completed registration.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingInvites.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e5e9ee',
                      borderRadius: 18,
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11.5
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ color: '#0a0d10', fontSize: 12.5 }}>{inv.name}</strong>
                        <span style={{
                          background: inv.role === 'supervisor' ? '#e0f2fe' : (inv.role === 'client' ? '#ede9fe' : '#F8F0DF'),
                          color: inv.role === 'supervisor' ? '#0369a1' : (inv.role === 'client' ? '#5b21b6' : '#18191B'),
                          fontSize: 9,
                          padding: '2px 8px',
                          borderRadius: 9999,
                          fontWeight: 700
                        }}>
                          {inv.role.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 10, color: '#b45309', fontWeight: 700 }}>● Pending Registration</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                        {inv.email} &bull; {inv.departmentOrCompany} &bull; Expires: {inv.expiresAt}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 9999,
                          padding: '5px 12px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#0a0d10',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        onClick={() => handleCopyLink(inv.inviteLink, inv.id)}
                      >
                        {copiedToken === inv.id ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                        <span>{copiedToken === inv.id ? 'Copied Link!' : 'Copy Link'}</span>
                      </button>

                      <button
                        className="admin-btn-primary"
                        style={{ padding: '6px 14px', fontSize: 11 }}
                        onClick={() => setActiveRegisterInvite(inv)}
                      >
                        <ExternalLink size={13} />
                        <span>Register as User</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. MODAL: Create New User Invite */}
      {showInviteModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2 className="modal-title">Admin Invite: Add New User</h2>
              <button className="modal-close-btn" onClick={() => setShowInviteModal(false)}>✕</button>
            </div>

            {!generatedInvite ? (
              <form onSubmit={handleCreateInvite} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Full Name</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    placeholder="e.g. Ramesh Patel"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Email Address</label>
                  <input
                    type="email"
                    className="admin-form-input"
                    placeholder="user@loompilot.com or client@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Role to Assign</label>
                  <select
                    className="admin-form-input"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  >
                    <option value="supervisor">Supervisor (Floor & Production Master)</option>
                    <option value="client">Client (Customer / Procurement Partner)</option>
                    <option value="admin">Admin (Mill Operations Staff)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
                    {inviteRole === 'supervisor' ? 'Assigned Shed / Loom Line' : 'Company Name / Department'}
                  </label>
                  <input
                    type="text"
                    className="admin-form-input"
                    placeholder={inviteRole === 'supervisor' ? 'e.g. Airjet Loom Shed C' : 'e.g. ABC Garments'}
                    value={inviteDept}
                    onChange={(e) => setInviteDept(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="submit" className="admin-btn-primary">
                    <UserPlus size={14} />
                    <span>Generate Invite Link</span>
                  </button>
                  <button
                    type="button"
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 9999,
                      padding: '8px 16px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#64748b',
                      cursor: 'pointer'
                    }}
                    onClick={() => setShowInviteModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{
                  background: '#F8F0DF',
                  border: '1px solid #c6e5db',
                  borderRadius: 18,
                  padding: '14px 16px',
                  fontSize: 11.5
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#18191B', fontWeight: 800 }}>
                    <Check size={15} />
                    <span>Invite Link Generated Successfully!</span>
                  </div>
                  <p style={{ color: '#18191B', marginTop: 4, margin: '4px 0 0' }}>
                    Invite for <strong>{generatedInvite.name}</strong> ({generatedInvite.role.toUpperCase()}) is ready. Send this link to complete onboarding.
                  </p>
                </div>

                {/* Link Box */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e5e9ee',
                  borderRadius: 16,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  fontSize: 11
                }}>
                  <span style={{
                    fontFamily: 'monospace',
                    color: '#0a0d10',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {generatedInvite.inviteLink}
                  </span>

                  <button
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 9999,
                      padding: '4px 12px',
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: '#0a0d10',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0
                    }}
                    onClick={() => handleCopyLink(generatedInvite.inviteLink, 'gen')}
                  >
                    {copiedToken === 'gen' ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                    <span>{copiedToken === 'gen' ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    className="admin-btn-primary"
                    onClick={() => setActiveRegisterInvite(generatedInvite)}
                  >
                    <ExternalLink size={14} />
                    <span>Open Registration Screen (Test Sign-Up)</span>
                  </button>
                  <button
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 9999,
                      padding: '8px 16px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#64748b',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setShowInviteModal(false);
                      setGeneratedInvite(null);
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. MODAL: Invited User Registration Flow */}
      {activeRegisterInvite && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>LOOMPILOT</span>
                <span style={{
                  background: '#F8F0DF',
                  color: '#18191B',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 9999
                }}>
                  {activeRegisterInvite.role.toUpperCase()} ONBOARDING
                </span>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveRegisterInvite(null)}>✕</button>
            </div>

            {regSuccessMsg ? (
              <div style={{
                background: '#F8F0DF',
                border: '1px solid #c6e5db',
                borderRadius: 18,
                padding: '20px',
                textAlign: 'center',
                color: '#18191B',
                fontSize: 12,
                fontWeight: 700
              }}>
                <Check size={32} style={{ margin: '0 auto 8px auto', display: 'block' }} />
                {regSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Full Name</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={activeRegisterInvite.name}
                    disabled
                    style={{ background: '#f8fafc', color: '#64748b' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Invited Email Address</label>
                  <input
                    type="email"
                    className="admin-form-input"
                    value={activeRegisterInvite.email}
                    disabled
                    style={{ background: '#f8fafc', color: '#64748b' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>Create Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="password"
                      className="admin-form-input"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Enter a secure password"
                      required
                    />
                    <Lock size={14} style={{ position: 'absolute', right: 14, top: 12, color: '#94a3b8' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="submit" className="admin-btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                    <UserCheck size={14} />
                    <span>Complete & Activate</span>
                    <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 9999,
                      padding: '8px 16px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#64748b',
                      cursor: 'pointer'
                    }}
                    onClick={() => setActiveRegisterInvite(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
