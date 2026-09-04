import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://williamjblodgett.github.io/Apartment4Bella/"),
  title: "Bella's Home Base | Apartments near Sixes Elementary",
  description: "A daily-reviewed shortlist of 1–2 bedroom apartments within 40 minutes of Sixes Elementary in Canton, Georgia.",
  openGraph: {
    title: "Bella's Home Base",
    description: "Apartments near Sixes Elementary—compared by drive, price, perks, reviews, and area context.",
    type: "website",
    images: [{ url: "/og.png", width: 1728, height: 909, alt: "Bella's Home Base apartment finder" }],
  },
  twitter: { card: "summary_large_image", title: "Bella's Home Base", description: "A practical apartment shortlist near Sixes Elementary.", images: ["/og.png"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
