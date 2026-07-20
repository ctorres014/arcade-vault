import { NextResponse } from "next/server";
import { Resend } from "resend";

type ContactRequest = {
  name?: string;
  email?: string;
  msg?: string;
  company?: string; // honeypot: debe venir vacío
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: ContactRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido" },
      { status: 400 },
    );
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const msg = body.msg?.trim() ?? "";
  const company = body.company?.trim() ?? "";

  // Honeypot: si viene relleno, es un bot. Fingimos éxito sin enviar correo.
  if (company) {
    return NextResponse.json({ ok: true });
  }

  if (!name || !email || !msg) {
    return NextResponse.json(
      { ok: false, error: "Todos los campos son obligatorios" },
      { status: 400 },
    );
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "El email no tiene un formato válido" },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) {
    console.error("Faltan RESEND_API_KEY o CONTACT_TO_EMAIL en el entorno");
    return NextResponse.json(
      { ok: false, error: "El servicio de correo no está configurado" },
      { status: 502 },
    );
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: "Arcade Vault <onboarding@resend.dev>",
    to,
    replyTo: email,
    subject: `Nuevo mensaje de contacto — ${name}`,
    text: `Nombre: ${name}\nEmail: ${email}\n\n${msg}`,
  });

  if (error) {
    console.error("Error enviando el correo con Resend:", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo enviar el mensaje" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
