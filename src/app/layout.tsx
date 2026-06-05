import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PortfolioProvider } from "@/context/PortfolioContext";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Portfolio Manager",
  description: "A minimalist portfolio manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen flex flex-col md:flex-row`}>
        <PortfolioProvider>
          <Sidebar />
          <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full">
            <div className="max-w-6xl mx-auto w-full">
              {children}
            </div>
          </main>
        </PortfolioProvider>
      </body>
    </html>
  );
}
