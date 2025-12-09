import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const USERS = [
  {
    id: 1,
    email: import.meta.env.USER1_EMAIL,
    password: await bcrypt.hash(import.meta.env.USER1_PASSWORD, 10),
    name: "Administrador",
  },
  {
    id: 2,
    email: import.meta.env.USER2_EMAIL,
    password: await bcrypt.hash(import.meta.env.USER2_PASSWORD, 10),
    name: "Usuario",
  },
];

export async function validateUser(email, password) {
  const user = USERS.find((u) => u.email === email);
  if (!user) return null;

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return null;

  return { id: user.id, email: user.email, name: user.name };
}

export function generateToken(user) {
  return jwt.sign(user, import.meta.env.JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, import.meta.env.JWT_SECRET);
  } catch {
    return null;
  }
}
