import React from 'react';
import type { Metadata } from 'next';
import DashboardAuthGuard from '@/components/Auth/DashboardAuthGuard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard - Crypgo',
  description: 'Cryptocurrency portfolio dashboard',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardAuthGuard>{children}</DashboardAuthGuard>;
}
