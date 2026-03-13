import "./globals.css";

// Root layout: html/body are provided by app/[lang]/layout.tsx
// so the lang attribute can be set dynamically per locale.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
