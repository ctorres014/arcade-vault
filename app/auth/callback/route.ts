import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Cierra el flujo de confirmación de correo: intercambia el code por una
// sesión y deja al jugador dentro.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=callback`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/auth?error=callback`);
  }

  return NextResponse.redirect(`${origin}/games`);
}
