import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import Sidebar from "./components/Sidebar";
import { SidebarProvider } from "./context/SidebarContext";
import MobileHeader from "./components/MobileHeader";
import { headers } from "next/headers";
import { Noto_Sans } from "next/font/google";

export const metadata: Metadata = {
  title: "Fibeger",
  description: "Share your moments with Fibeger",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  const isAuthPage = pathname.startsWith("/auth");

  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#313338" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
      </head>
      <body
        className={`noto-sans-regular antialiased`}
        style={{ backgroundColor: '#313338' }}
      >
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Providers>
          {isAuthPage ? (
            <main id="main-content" role="main" style={{ backgroundColor: '#313338' }}>
              {children}
            </main>
          ) : (
            <SidebarProvider>
              <MobileHeader />
              <Sidebar />
              <main id="main-content" role="main" className="ml-0 lg:ml-60 transition-all duration-300" style={{ backgroundColor: '#313338' }}>
                {children}
              </main>
            </SidebarProvider>
          )}
        </Providers>
      </body>
    </html>
  );
}
