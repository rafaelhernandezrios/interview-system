// Script para generar hash de contraseña para crear usuario admin manualmente
// Uso: node scripts/generatePasswordHash.js "tu_contraseña"

import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);

