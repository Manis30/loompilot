import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, CheckCircle2, Layers } from 'lucide-react';
import type { AdminUser } from '../../types';
import { INITIAL_ADMIN_USER } from '../../data/mockData';

interface AdminLoginProps {
  onLogin: (user: AdminUser) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('admin@loompilot.com');
  const [password, setPassword] = useState('••••••••••••');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide an authorized administrator email.');
      return;
    }
    setError(null);
    onLogin({
      ...INITIAL_ADMIN_USER,
      email: email.trim()
    });
  };

  const handleFillDemo = () => {
    setEmail('admin@loompilot.com');
    setPassword('admin2026!secure');
    setError(null);
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#edf1f5',
      padding: 16
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 32,
        padding: '36px 32px',
        maxWidth: 440,
        width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
        border: '1px solid #e5e9ee',
        display: 'flex',
        flexDirection: 'column',
        gap: 18
      }}>
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#1B1918',
            color: '#79B4B7',
            border: '1.5px solid rgba(215, 171, 106, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 14
          }}>
            <Layers size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: '#18191B', letterSpacing: '-0.4px', margin: 0 }}>
              LOOMPILOT
            </h1>
            <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>
              Textile Operations Admin Portal
            </p>
          </div>
        </div>

        {/* Security Alert Badge */}
        <div style={{
          background: '#FAF4EA',
          border: '1.5px solid #79B4B7',
          borderRadius: 20,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 11,
          color: '#1B1918'
        }}>
          <Shield size={18} style={{ flexShrink: 0, color: '#18191B' }} />
          <div>
            <strong>Restricted Access:</strong> Managing Director & Floor Administration portal. Role-based isolation strictly enforced.
          </div>
        </div>

        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fecdd3',
            borderRadius: 16,
            padding: '10px 14px',
            fontSize: 11,
            color: '#dc2626'
          }}>
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
              Admin Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                className="admin-form-input"
                style={{ width: '100%', paddingLeft: 36 }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@loompilot.com"
                required
              />
              <Mail size={15} style={{ position: 'absolute', left: 14, top: 11, color: '#94a3b8' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#0a0d10', display: 'block', marginBottom: 4 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="admin-form-input"
                style={{ width: '100%', paddingLeft: 36 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin credentials"
                required
              />
              <Lock size={15} style={{ position: 'absolute', left: 14, top: 11, color: '#94a3b8' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#475569' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: '#79B4B7', cursor: 'pointer' }}
              />
              <span>Keep admin session active</span>
            </label>
            <span style={{ color: '#18191B', fontWeight: 600, cursor: 'pointer' }}>Forgot Password?</span>
          </div>

          <button type="submit" className="admin-btn-primary" style={{ width: '100%', padding: '10px 16px', justifyContent: 'center' }}>
            <span>Sign In to Admin Dashboard</span>
            <ArrowRight size={15} />
          </button>
        </form>

        {/* Demo Credentials Pill */}
        <div
          onClick={handleFillDemo}
          title="Click to autofill demo credentials"
          style={{
            background: '#FAF4EA',
            border: '1px solid #E8DEC8',
            borderRadius: 20,
            padding: '12px 14px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#18191B', fontSize: 11 }}>
            <CheckCircle2 size={13} />
            <span>Click to Autofill Demo Credentials</span>
          </div>
          <div style={{ color: '#64748b', fontSize: 10 }}>
            User: <strong>admin@loompilot.com</strong> &bull; Role: Managing Director (John Doe)
          </div>
        </div>
      </div>
    </div>
  );
};
