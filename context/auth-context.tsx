"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SessionUser } from "@/lib/supabase/types";

export type { SessionUser };

type AuthContextValue = {
  user: SessionUser;
  playAsGuest: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  initialUser = null,
  children,
}: {
  initialUser?: SessionUser;
  children: ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser>(initialUser);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user;

      if (!authUser) {
        setSessionUser(null);
        return;
      }

      // No se puede llamar a supabase dentro del callback (bloquea el cliente):
      // se difiere a un tick posterior.
      setTimeout(async () => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", authUser.id)
          .single();

        setSessionUser({
          kind: "supabase",
          id: authUser.id,
          username:
            profile?.username ??
            (authUser.email?.split("@")[0] ?? "JUGADOR").toUpperCase().slice(0, 10),
          email: authUser.email ?? "",
        });
        // Una sesión real siempre gana sobre el modo invitado.
        setGuest(false);
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const playAsGuest = () => setGuest(true);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSessionUser(null);
    setGuest(false);
    router.refresh();
  };

  const user: SessionUser =
    sessionUser ?? (guest ? { kind: "guest", username: "INVITADO" } : null);

  return (
    <AuthContext.Provider value={{ user, playAsGuest, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
}
