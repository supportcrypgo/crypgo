'use client';

import { useState, useRef } from 'react';
import { ShieldCheck, Upload, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import type { UnifiedUser } from '@/types/unified';

interface KYCDocument {
  id: string;
  type: 'id_card' | 'passport' | 'drivers_license' | 'selfie';
  name: string;
  status: 'pending' | 'approved' | 'rejected' | 'not_submitted';
  file?: File;
  preview?: string;
  uploadedAt?: string;
  rejectionReason?: string;
}

const DOCUMENT_TYPES: { type: KYCDocument['type']; name: string; icon: React.ReactNode; description: string }[] = [
  { type: 'id_card', name: 'Government ID', icon: <FileText className="w-5 h-5" />, description: 'National ID card or residence permit' },
  { type: 'passport', name: 'Passport', icon: <ShieldCheck className="w-5 h-5" />, description: 'Valid international passport' },
  { type: 'drivers_license', name: 'Driver\'s License', icon: <FileText className="w-5 h-5" />, description: 'Valid driving license with photo' },
  { type: 'selfie', name: 'Selfie Verification', icon: <Upload className="w-5 h-5" />, description: 'Selfie holding your ID document' },
];

export function IDVerificationContent({ user }: { user: UnifiedUser }) {
  const [documents, setDocuments] = useState<KYCDocument[]>([
    { id: '1', type: 'id_card', name: 'Government ID', status: 'not_submitted' },
    { id: '2', type: 'passport', name: 'Passport', status: 'not_submitted' },
    { id: '3', type: 'drivers_license', name: 'Driver\'s License', status: 'not_submitted' },
    { id: '4', type: 'selfie', name: 'Selfie Verification', status: 'not_submitted' },
  ]);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement>>({});

  const handleFileSelect = (docType: KYCDocument['type'], e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only JPG, PNG, WebP, and PDF files are allowed');
      return;
    }

    setUploading(docType);
    const reader = new FileReader();
    reader.onloadend = () => {
      setDocuments(prev => prev.map(doc => 
        doc.type === docType 
          ? { ...doc, status: 'pending' as const, file, preview: reader.result as string, uploadedAt: new Date().toISOString() }
          : doc
      ));
      setUploading(null);
    };
    reader.readAsDataURL(file);
  };

  const getStatusIcon = (status: KYCDocument['status']) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
      default:
        return <Upload className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: KYCDocument['status']) => {
    switch (status) {
      case 'approved': return 'Verified';
      case 'rejected': return 'Rejected';
      case 'pending': return 'Under Review';
      default: return 'Not Submitted';
    }
  };

  const getStatusColor = (status: KYCDocument['status']) => {
    switch (status) {
      case 'approved': return 'bg-green-500/10 text-green-500';
      case 'rejected': return 'bg-red-500/10 text-red-500';
      case 'pending': return 'bg-yellow-500/10 text-yellow-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const allVerified = documents.every(d => d.status === 'approved');
  const anyPending = documents.some(d => d.status === 'pending');
  const anyRejected = documents.some(d => d.status === 'rejected');

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">Identity Verification</h2>
        <p className="mt-2 text-muted-foreground">
          Complete identity verification to unlock higher limits and access all features.
        </p>
      </div>

      {/* Status Badge */}
      <div className="hidden md:block p-4 rounded-xl bg-muted/20 border border-white/5">
        <div className="flex items-center gap-3">
          <ShieldCheck className={`w-6 h-6 ${allVerified ? 'text-green-500' : anyPending ? 'text-yellow-500' : anyRejected ? 'text-red-500' : 'text-muted-foreground'}`} />
          <div>
            <p className="font-medium">
              {allVerified ? 'Fully Verified' : anyPending ? 'Verification Pending' : anyRejected ? 'Verification Rejected' : 'Not Verified'}
            </p>
            <p className="text-sm text-muted-foreground">
              {allVerified 
                ? 'All documents verified. You have full access to all features.'
                : anyPending 
                  ? 'Your documents are under review. This typically takes 24-48 hours.'
                  : anyRejected
                    ? 'One or more documents were rejected. Please review and resubmit.'
                    : 'Submit your documents to start verification.'}
            </p>
          </div>
        </div>
      </div>

      {/* Document List */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Required Documents</h3>
        {DOCUMENT_TYPES.map(({ type, name, icon, description }) => {
          const doc = documents.find(d => d.type === type);
          const isUploading = uploading === type;
          
          return (
            <div key={type} className="p-0 bg-transparent md:p-4 md:rounded-xl md:bg-muted/20 md:border md:border-white/5">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{name}</h4>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                    <span className={`hidden md:inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(doc?.status || 'not_submitted')}`}>
                      {getStatusIcon(doc?.status || 'not_submitted')}
                      <span className="ml-1.5">{getStatusLabel(doc?.status || 'not_submitted')}</span>
                    </span>
                  </div>
                  
                  {doc?.preview && (
                    <div className="mt-3 flex items-center gap-3">
                      {doc.preview.startsWith('data:image') ? (
                        <img src={doc.preview} alt={name} className="w-16 h-16 rounded-lg object-cover" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                          <FileText className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.file?.name || 'Document uploaded'}</p>
                        <p className="text-xs text-muted-foreground">Uploaded {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'just now'}</p>
                      </div>
                    </div>
                  )}

                  {doc?.rejectionReason && (
                    <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-sm text-red-500">
                        <AlertCircle className="w-4 h-4 inline mr-1" />
                        Rejection reason: {doc.rejectionReason}
                      </p>
                    </div>
                  )}

                  {(!doc || doc.status === 'not_submitted' || doc.status === 'rejected') && (
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[type]?.click()}
                      disabled={isUploading}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      {isUploading ? 'Uploading...' : doc?.status === 'rejected' ? 'Resubmit Document' : 'Upload Document'}
                    </button>
                  )}

                  <input
                    ref={el => { if (el) fileInputRefs.current[type] = el; }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => handleFileSelect(type, e)}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* Additional info */}
        <div className="hidden md:block p-4 rounded-xl bg-muted/20 border border-white/5">
          <h4 className="font-medium mb-2">Verification Guidelines</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> Documents must be valid and not expired</li>
            <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> All four corners of the document must be visible</li>
            <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> Selfie must clearly show your face and the document</li>
            <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> Maximum file size: 5MB per document</li>
            <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> Accepted formats: JPG, PNG, WebP, PDF</li>
          </ul>
        </div>
      </div>

      {/* Verification Benefits */}
      <div className="p-0 rounded-none bg-transparent border-0 md:p-6 md:rounded-xl md:bg-gradient-to-br md:from-primary/10 md:to-primary/5 md:border md:border-primary/20">
        <h3 className="text-lg font-semibold mb-4">Why Verify Your Identity?</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Higher Limits</p>
              <p className="text-sm text-muted-foreground">Increase deposit, withdrawal, and trading limits</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Fiat Support</p>
              <p className="text-sm text-muted-foreground">Enable fiat deposits and withdrawals</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Enhanced Security</p>
              <p className="text-sm text-muted-foreground">Additional protection for your account</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
