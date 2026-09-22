import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "DocuCore 360 — Your document workspace", template: "%s | DocuCore 360" },
  description:
    "A privacy-focused PDF, image and document workspace with multilingual OCR, editable drafts, private file versions and personal profiles.",
  openGraph: {
    title: "DocuCore 360",
    description: "Less paperwork. More possibility.",
    type: "website",
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
