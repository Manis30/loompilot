import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import {
  Building,
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  RotateCcw,
  LogOut,
  Save,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const { addToast, resetDemoData } = useApp();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    company: user?.company || '',
    contactPerson: user?.contactPerson || '',
    designation: user?.designation || '',
    email: user?.email || '',
    phone: user?.phone || '',
    shippingPlant: user?.shippingPlant || '',
    billingAddress: user?.billingAddress || '',
    gstin: user?.gstin || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(formData);
    addToast('Client mill entity profile updated successfully!', 'success');
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      addToast('New passwords do not match.', 'error');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      addToast('Password must be at least 6 characters.', 'error');
      return;
    }
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    addToast('Corporate security password updated.', 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-charcoal tracking-tight">
            Client Account & Mill Settings
          </h1>
          <p className="text-sm text-muted mt-1">
            Configure your enterprise procurement entity, delivery plant destinations, and commercial communication preferences.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Enterprise Entity & Addresses (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <form onSubmit={handleProfileSubmit} className="bg-white rounded-2xl border border-muted-border shadow-card p-6 lg:p-8 space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-charcoal">Enterprise Client Entity</h3>
              <p className="text-xs text-muted">Official tax entity registered for fabric manufacturing contracts</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Company Legal Entity
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Client Code
                </label>
                <input
                  type="text"
                  value={user?.clientCode || 'RAY-IND-8842'}
                  readOnly
                  className="w-full p-2.5 text-xs rounded-xl border border-muted-border bg-ivory font-mono text-muted cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  GSTIN / Tax ID
                </label>
                <input
                  type="text"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Account Tier
                </label>
                <input
                  type="text"
                  value={user?.accountTier || 'Enterprise Tier 1'}
                  readOnly
                  className="w-full p-2.5 text-xs rounded-xl border border-muted-border bg-ivory text-muted cursor-not-allowed"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-muted-border">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-charcoal mb-3">
                Authorized Signatory / Procurement Lead
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                    Work Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-muted-border space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-charcoal">
                Mill Warehousing & Billing Logistics
              </h4>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Default Shipping Plant / Mill Address
                </label>
                <textarea
                  rows={2}
                  value={formData.shippingPlant}
                  onChange={(e) => setFormData({ ...formData, shippingPlant: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Registered Corporate Billing Address
                </label>
                <textarea
                  rows={2}
                  value={formData.billingAddress}
                  onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-vermilion text-white text-xs font-bold shadow-vermilion hover:bg-vermilion-hover transition-colors"
              >
                <Save size={16} />
                <span>Save Profile Changes</span>
              </button>
            </div>
          </form>

          {/* Password Form */}
          <form onSubmit={handlePasswordSubmit} className="bg-white rounded-2xl border border-muted-border shadow-card p-6 lg:p-8 space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-charcoal">Security & Credentials</h3>
              <p className="text-xs text-muted">Update your portal authentication credentials</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full p-2.5 text-xs rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full p-2.5 text-xs rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full p-2.5 text-xs rounded-xl border border-muted-border bg-ivory focus:bg-white focus:border-vermilion focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl border border-muted-border text-xs font-bold text-charcoal hover:bg-ivory"
              >
                Update Password
              </button>
            </div>
          </form>
        </div>

        {/* Right: Preferences, Manager & Reset (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Notification Preferences */}
          <div className="bg-white rounded-2xl border border-muted-border shadow-card p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-charcoal">Real-Time Alert Preferences</h3>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="font-bold text-charcoal block">WhatsApp Production Alerts</span>
                  <span className="text-[11px] text-muted">Daily loom picks and inspection passes</span>
                </div>
                <input type="checkbox" defaultChecked className="accent-vermilion w-4 h-4" />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="font-bold text-charcoal block">Email Quotation Approvals</span>
                  <span className="text-[11px] text-muted">Instant alert when Admin approves counter-offer</span>
                </div>
                <input type="checkbox" defaultChecked className="accent-vermilion w-4 h-4" />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="font-bold text-charcoal block">Payment Due Reminders</span>
                  <span className="text-[11px] text-muted">48 hours prior to milestone deadline</span>
                </div>
                <input type="checkbox" defaultChecked className="accent-vermilion w-4 h-4" />
              </label>
            </div>
          </div>

          {/* Assigned Merchandiser Card */}
          <div className="bg-white rounded-2xl border border-muted-border shadow-card p-6 space-y-3 bg-gradient-to-br from-white to-ivory">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Assigned Production Merchandiser</span>
            <h4 className="text-base font-extrabold text-charcoal">
              {user?.relationshipManager || 'Anil Sharma (Senior VP Merchandising)'}
            </h4>
            <p className="text-xs text-muted">Direct Desk: +91 (22) 6749-8800 (Ext: 442)</p>

            <button
              onClick={() => navigate('/client/messages')}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-charcoal text-white text-xs font-bold hover:bg-charcoal-light transition-colors"
            >
              <MessageSquare size={14} />
              <span>Open Merchandiser Chat</span>
            </button>
          </div>

          {/* Prototype Reset Card */}
          <div className="bg-white rounded-2xl border border-dashed border-muted-border p-6 space-y-3">
            <h3 className="text-sm font-extrabold text-charcoal">Prototype Data Management</h3>
            <p className="text-xs text-muted leading-relaxed">
              Reset all newly created orders, negotiation messages, and Razorpay payment states back to factory demo defaults.
            </p>
            <button
              onClick={() => {
                if (confirm('Reset all portal state to factory demo values?')) {
                  resetDemoData();
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-warning/40 text-warning bg-warning/5 text-xs font-bold hover:bg-warning/10 transition-colors"
            >
              <RotateCcw size={14} />
              <span>Reset Prototype Data</span>
            </button>
          </div>

          {/* Sign Out */}
          <button
            onClick={() => {
              logout();
              navigate('/client/login');
              addToast('Logged out of demo session.', 'info');
            }}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-vermilion/30 text-vermilion bg-vermilion/5 text-xs font-bold hover:bg-vermilion/10 transition-colors"
          >
            <LogOut size={14} />
            <span>Sign Out of Portal</span>
          </button>
        </div>
      </div>
    </div>
  );
};

