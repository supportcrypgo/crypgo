import "./globals.css";
import ClientLayout from "./ClientLayout";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Crypgo",
  description: "Custodial crypto platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}