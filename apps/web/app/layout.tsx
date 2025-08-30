import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "Open World Kids Game",
  description: "Simple 2D multiplayer world for kids"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#111", color: "#eee" }}>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
