'use client';

import { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import type { UnifiedUser } from '@/types/unified';

export function ChangePasswordContent({ user }: { user: UnifiedUser }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordRequirements = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(newPassword) },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(newPassword) },
    { label: 'Contains a number', met: /[0-9]/.test(newPassword) },
    { label: 'Contains a special character', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!currentPassword) {
      setError('Current password is required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (!passwordRequirements.every(r => r.met)) {
      setError('Please meet all password requirements');
      return;
    }

    setSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    setSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setSuccess(false), 3000);
  };

  const InputField = ({ 
    label, 
    value, 
    onChange, 
    show, 
    toggleShow,
    placeholder 
  }: { 
    label: string; 
    value: string; 
    onChange: (v: string) => void; 
    show: boolean; 
    toggleShow: () => void;
    placeholder: string;
  }) => (
    <div>
      <label className="block text-sm font-medium text-muted-foreground mb-2">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 pr-12 bg-background border border-white/5 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-foreground"
        />
        <button
          type="button"
          onClick={toggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold flex items-center gap-3">
          <Lock className="w-6 h-6" />
          Change Password
        </h2>
        <p className="mt-2 text-muted-foreground">
          Update your password to keep your account secure. Choose a strong password you don't use elsewhere.
        </p>
      </div>

      {/* Password Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <InputField
          label="Current Password"
          value={currentPassword}
          onChange={setCurrentPassword}
          show={showCurrent}
          toggleShow={() => setShowCurrent(!showCurrent)}
          placeholder="Enter current password"
        />

        <InputField
          label="New Password"
          value={newPassword}
          onChange={setNewPassword}
          show={showNew}
          toggleShow={() => setShowNew(!showNew)}
          placeholder="Enter new password"
        />

        <InputField
          label="Confirm New Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          show={showConfirm}
          toggleShow={() => setShowConfirm(!showConfirm)}
          placeholder="Confirm new password"
        />

        {/* Password Requirements */}
        <div className="p-0 rounded-none bg-transparent border-0 space-y-2 md:p-4 md:rounded-xl md:bg-muted/20 md:border md:border-white/5">
          <p className="text-sm font-medium">Password Requirements:</p>
          {passwordRequirements.map((req, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              {req.met ? (
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
              <span className={req.met ? 'text-green-500' : 'text-muted-foreground'}>
                {req.label}
              </span>
            </div>
          ))}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Password changed successfully!
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Lock className="w-4 h-4" />
          {saving ? 'Updating Password...' : 'Update Password'}
        </button>
      </form>

      {/* Security Tips */}
      <div className="p-0 rounded-none bg-transparent border-0 md:p-6 md:rounded-xl md:bg-muted/20 md:border md:border-white/5">
        <h3 className="font-semibold mb-3">Password Tips</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> Use a unique password that you don't use for other websites or apps</li>
          <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> Avoid using personal information that can be easily guessed or found online</li>
          <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> Consider using a password manager to generate and store strong passwords</li>
          <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> Change your password immediately if you suspect your account has been compromised</li>
        </ul>
      </div>
    </div>
  );
}
