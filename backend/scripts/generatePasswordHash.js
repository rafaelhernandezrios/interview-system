// Script para generar hash de contraseña para crear usuario admin manualmente
// Uso: node scripts/generatePasswordHash.js "tu_contraseña"

import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
  console.error('❌ Error: Debes proporcionar una contraseña');
  console.log('Uso: node scripts/generatePasswordHash.js "tu_contraseña"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log('\n✅ Hash generado:');
console.log(hash);
console.log('\n📋 Copia este hash para usar en MongoDB Atlas al crear el usuario admin\n');

