import "./globals.css";

export const metadata = { title: "7Math Arena", description: "A multiplication mastery arena" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
