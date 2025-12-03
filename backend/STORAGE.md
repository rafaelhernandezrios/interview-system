# 📁 Configuración de Almacenamiento de CVs

El sistema soporta dos tipos de almacenamiento para los CVs: **local** (carpeta en el servidor) y **AWS S3** (almacenamiento en la nube).

## 🔧 Configuración Actual

Por defecto, el sistema usa **almacenamiento local** si no se especifica otra cosa.

### Almacenamiento Local (Actual)

Los CVs se guardan en la carpeta `backend/uploads/cvs/` del servidor.

**Ventajas:**
- ✅ No requiere configuración adicional
- ✅ Gratis
- ✅ Funciona inmediatamente

**Desventajas:**
- ❌ Los archivos están en el servidor
- ❌ No escalable para producción
- ❌ Requiere backup manual

**Configuración en `.env`:**
```env
STORAGE_TYPE=local
```

Los archivos se guardan en: `backend/uploads/cvs/`
Y se acceden mediante: `http://localhost:20352/api/users/uploads/cvs/nombre_archivo.pdf`

## ☁️ Cambiar a AWS S3 (Cuando esté listo)

Cuando tengas configurado tu bucket de AWS S3, puedes cambiar fácilmente:

### Paso 1: Configurar variables de entorno

En tu archivo `.env`:

```env
# Cambiar el tipo de almacenamiento
STORAGE_TYPE=s3

# Configurar credenciales de AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=tu_access_key_id
AWS_SECRET_ACCESS_KEY=tu_secret_access_key
AWS_BUCKET_NAME=nombre_de_tu_bucket
```

### Paso 2: Configurar el bucket S3

1. **Crear el bucket** en AWS S3
2. **Configurar permisos**:
   - Habilitar "Public read" para los archivos (o usar signed URLs)
   - Configurar CORS si es necesario
3. **Configurar IAM**:
   - Crear un usuario IAM con permisos de S3
   - Obtener Access Key ID y Secret Access Key

### Paso 3: Reiniciar el servidor

```bash
npm start
```

El sistema automáticamente detectará `STORAGE_TYPE=s3` y usará AWS S3.

## 🔄 Migración de Archivos

Si ya tienes CVs almacenados localmente y quieres migrarlos a S3:

1. Sube los archivos manualmente a tu bucket S3
2. Actualiza los registros en MongoDB para que `cvPath` apunte a las URLs de S3
3. O simplemente deja que los usuarios suban sus CVs nuevamente

## 📝 Notas Importantes

- **No mezcles tipos**: Si cambias de `local` a `s3`, los CVs existentes con rutas locales no funcionarán hasta que se migren
- **Backup**: Con almacenamiento local, asegúrate de hacer backup de la carpeta `uploads/cvs/`
- **Producción**: Para producción, se recomienda usar S3 o un servicio similar
- **Seguridad**: Con almacenamiento local, los archivos son accesibles públicamente en `/api/users/uploads/cvs/`. Considera agregar autenticación si es necesario

## 🧪 Verificar la Configuración

Al subir un CV, la respuesta incluirá el tipo de almacenamiento usado:

```json
{
  "message": "CV subido correctamente",
  "filePath": "/api/users/uploads/cvs/1234567890_cv.pdf",
  "storageType": "local"
}
```

Si está usando S3:
```json
{
  "message": "CV subido correctamente",
  "filePath": "https://tu-bucket.s3.amazonaws.com/1234567890_cv.pdf",
  "storageType": "s3"
}
```

