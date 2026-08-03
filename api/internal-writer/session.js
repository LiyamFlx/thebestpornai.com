import { getCredentials, isAuthed, noStore } from "./_shared.js";

export default function handler(req, res) {
  noStore(res);
  const { password } = getCredentials(process.env);
  res.status(200).json({
    authenticated: isAuthed(req),
    passwordRequired: Boolean(password),
  });
}
