import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "Open World Kids Game",
  description: "Simple 2D multiplayer world for kids"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontStack = `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol`;
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#111",
          color: "#eee",
          fontFamily: fontStack,
          WebkitFontSmoothing: "antialiased" as any,
          MozOsxFontSmoothing: "grayscale" as any,
        }}
      >
        <ClerkProvider
          appearance={{
            variables: { fontFamily: fontStack },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
