export type Profile = {
  id: string;
  username: string;
  created_at: string;
};

export type SessionUser =
  | { kind: "supabase"; id: string; username: string; email: string }
  | { kind: "guest"; username: "INVITADO" }
  | null;
