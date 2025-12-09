export async function POST({ cookies, redirect }) {
  cookies.delete("auth-token");
  return redirect("/login");
}
