import { supabase } from "./client";

/**
 * Invoke an edge function with the signed-in user's JWT.
 * Fails closed if there is no session — do not fall back to the anon/publishable key.
 */
export async function invokeAuthedFunction(name: string, body: unknown) {
  const { data, error: sessionError } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (sessionError || !accessToken) {
    return {
      data: null,
      error: { message: "You must be signed in to run this research step." },
    };
  }

  return supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
