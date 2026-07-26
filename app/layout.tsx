import type { Metadata } from "next";
import { Press_Start_2P, Courier_Prime, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/context/auth-context";
import { Nav } from "@/components/nav";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/supabase/types";
import "./globals.css";

const pressStart2P = Press_Start_2P({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
});

const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arcade Vault",
  description: "Juega en linea y compite por el puntaje mas alto.",
};

// Resuelve la sesión en el servidor para que el Nav no parpadee al cargar.
async function getInitialUser(): Promise<SessionUser> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", claims.sub)
    .single();

  return {
    kind: "supabase",
    id: claims.sub,
    username:
      profile?.username ??
      (claims.email?.split("@")[0] ?? "JUGADOR").toUpperCase().slice(0, 10),
    email: claims.email ?? "",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialUser = await getInitialUser();

  return (
    <html
      lang="en"
      className={`${pressStart2P.variable} ${courierPrime.variable} ${jetBrainsMono.variable} h-full`}
    >
      <body>
        <div className="av-bg" />
        <div className="av-noise" />
        <div id="root">
          <AuthProvider initialUser={initialUser}>
            <Nav />
            <main className="av-main">{children}</main>
            <footer
              style={{
                borderTop: "1px solid var(--line)",
                padding: "20px 32px",
                textAlign: "center",
                color: "var(--ink-faint)",
                fontFamily: "var(--mono)",
                fontSize: 11,
                letterSpacing: "0.16em",
              }}
            >
              © 2026 ARCADE VAULT · v2.6.0
            </footer>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
