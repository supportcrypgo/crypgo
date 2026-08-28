'use client';

import { useState, useRef } from 'react';
import { User, Camera, Save } from 'lucide-react';
import type { UnifiedUser } from '@/types/unified';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useUnified } from '@/context/UnifiedContext';

function toDateInputValue(value?: string) {
  if (!value) return '';
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

export function EditProfileContent({ user: initialUser }: { user: UnifiedUser }) {
  const { refreshUser } = useAuth();
  const { updateUserProfile, uploadProfilePhoto } = useUnified();
  const [form, setForm] = useState({
    firstName: initialUser.firstName,
    lastName: initialUser.lastName,
    dateOfBirth: toDateInputValue(initialUser.dateOfBirth),
    email: initialUser.email,
    phone: initialUser.phone,
    countryRegion: initialUser.country,
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      const file = fileInputRef.current?.files?.[0];
      if (file) {
        await uploadProfilePhoto(file);
      }

      const updatedUser = await updateUserProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth || undefined,
        phone: form.phone,
        country: form.countryRegion,
      });

      await refreshUser();
      setSuccess(true);
      toast.success('Profile updated successfully');
      if (updatedUser.email) {
        setForm(prev => ({ ...prev, email: updatedUser.email }));
      }
      if (updatedUser.dateOfBirth) {
        setForm(prev => ({ ...prev, dateOfBirth: toDateInputValue(updatedUser.dateOfBirth) }));
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-8">Edit Profile</h2>

      {/* Avatar Upload */}
      <div className="flex flex-col items-start gap-6 mb-8 p-0 bg-transparent sm:flex-row sm:items-center md:p-6 md:rounded-xl md:bg-muted/20">
        <div className="relative">
          <div className="w-[100px] h-[100px] rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-muted overflow-hidden">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-muted-foreground/50" />
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Camera className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
        <div>
          <p className="font-medium">Profile Photo</p>
          <p className="text-sm text-muted-foreground">JPG, PNG or GIF. 200x200 recommended.</p>
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">First Name</label>
            <input
              type="text"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-background border border-white/5 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Last Name</label>
            <input
              type="text"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-background border border-white/5 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-foreground"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Date of Birth</label>
          <input
            type="date"
            name="dateOfBirth"
            value={form.dateOfBirth}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-background border border-white/5 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-foreground"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-background border border-white/5 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-foreground"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Phone</label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-background border border-white/5 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-foreground"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Country / Region</label>
          <input
            type="text"
            name="countryRegion"
            value={form.countryRegion}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-background border border-white/5 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-foreground"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {success && (
            <span className="text-green-500 text-sm">Profile updated successfully!</span>
          )}
        </div>
      </form>
    </div>
  );
}
