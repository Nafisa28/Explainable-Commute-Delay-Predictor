import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import Navbar from "@/components/Navbar";
import SmoothScroll from "@/components/SmoothScroll";
import CustomCursor from "@/components/CustomCursor";
import PageTransitionProvider from "@/components/PageTransitionProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CommuteDelay — Explainable Commute Delay Predictor",
  description:
    "Predict commute delays on Bengaluru routes and understand the why behind every prediction with SHAP-powered explanations.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SmoothScroll>
          <CustomCursor />
          <Navbar />
          <main className="flex-1 flex flex-col">
            <PageTransitionProvider>{children}</PageTransitionProvider>
          </main>
          <footer className="border-t border-border py-6">
            <div className="mx-auto max-w-[72rem] px-6 text-center text-sm text-text-secondary">
              © 2026 CommuteDelay · Built with Next.js, Flask &amp; SHAP
            </div>
          </footer>
        </SmoothScroll>
      </body>
    </html>
  );
}
