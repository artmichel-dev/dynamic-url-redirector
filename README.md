
# Dynamic URL Redirector - Cloudflare Worker

Un **Cloudflare Worker** que permite redireccionar dinámicamente URLs basándose en fechas y horas configuradas en una hoja de cálculo de Google Sheets.

## 🚀 Características

- ✅ **Redirección dinámica** basada en fecha y hora
- ✅ **Actualización en tiempo real** desde Google Sheets
- ✅ **Sistema de prioridades** (specific > dynamics > default)
- ✅ **Soporte para zonas horarias**
- ✅ **Modo debug** para troubleshooting
- ✅ **Sin problemas de caché**

## 🏗️ Arquitectura

```
Usuario → Cloudflare Worker → Google Sheets API → Redirección dinámica
```

## 📋 Formato de Google Sheets

Tu hoja de cálculo debe tener la siguiente estructura:

| tipo     | fecha_inicio | hora_inicio | fecha_fin  | hora_fin | url                    | description |
|----------|-------------|-------------|------------|----------|------------------------|-------------|
| default  |             |             |            |          | https://ejemplo.com/home | Página por defecto |
| dynamics | 2025-07-09  | 03:31       | 2025-07-09 | 07:00    | https://ejemplo.com/morning | Página matutina |
| specific | 2025-07-10  | 10:00       | 2025-07-10 | 12:00    | https://ejemplo.com/event | Evento especial |

### Tipos de redirección:

- **`default`**: URL por defecto cuando no hay ninguna activa
- **`dynamics`**: URL activa en un rango de fechas (prioridad media)
- **`specific`**: URL activa en un rango de fechas (prioridad alta)

## 🔧 Configuración

### 1. Crear proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto
3. Habilita la **Google Sheets API**
4. Crea una **cuenta de servicio**
5. Descarga el archivo JSON con las credenciales

### 2. Configurar Google Sheets

1. Crea una nueva hoja de cálculo
2. Estructura los datos según el formato mostrado arriba
3. Comparte la hoja con el email de la cuenta de servicio (permisos de lectura)

### 3. Configurar variables en Cloudflare

En tu dashboard de Cloudflare Workers → Settings → Variables:

```bash
SPREADSHEET_ID = "tu_spreadsheet_id_aqui"
GOOGLE_CLIENT_EMAIL = "tu-servicio@proyecto.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nTU_CLAVE_PRIVADA\n-----END PRIVATE KEY-----\n"
```

### 4. Personalizar el código

En `worker.js`, actualiza estas secciones según tus necesidades:

```javascript
// Cambia los nombres de hoja según tu configuración
const possibleRanges = [
  'mi_hoja!A:G',       // Cambia por el nombre de tu hoja
  'A:G',               // Sin especificar hoja (usa la primera)
  'Sheet1!A:G',        // Inglés
  // ... más opciones
];

// Cambia la zona horaria
function getNowInTimezone() {
  const now = new Date();
  const localTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Denver" })); // Cambia aquí
  return localTime;
}
```

## 🔍 Uso

### Redirección normal:
```
https://tu-dominio.com/tu-ruta
```

### Modo debug:
```
https://tu-dominio.com/tu-ruta?debug=1
```

El modo debug te mostrará:
- Variables de entorno configuradas
- Datos obtenidos de Google Sheets
- Reglas activas/inactivas
- Decisión final de redirección

## 📝 Ejemplo de configuración completa

### Google Sheets:
```
tipo     | fecha_inicio | hora_inicio | fecha_fin  | hora_fin | url                    | description
default  |              |             |            |          | https://misite.com/home | Página principal
dynamics | 2025-07-09   | 06:00       | 2025-07-09 | 18:00    | https://misite.com/day  | Horario diurno
specific | 2025-07-10   | 20:00       | 2025-07-10 | 22:00    | https://misite.com/event| Evento especial
```

### Comportamiento:
- **Fuera de horarios**: Redirige a `/home` (default)
- **9 jul 06:00-18:00**: Redirige a `/day` (dynamics)
- **10 jul 20:00-22:00**: Redirige a `/event` (specific - mayor prioridad)

## 🔄 Lógica de prioridad

1. **SPECIFIC** (máxima prioridad)
2. **DYNAMICS** (prioridad media)
3. **DEFAULT** (cuando no hay ninguna activa)

## 🛠️ Troubleshooting

### Error: "Variables de entorno no configuradas"
- Verifica que las 3 variables estén configuradas en Cloudflare
- Asegúrate de que la clave privada incluya los headers `-----BEGIN/END PRIVATE KEY-----`

### Error: "No se encontraron datos en la hoja"
- Verifica que la hoja esté compartida con la cuenta de servicio
- Confirma que el nombre de la hoja coincida con los `possibleRanges`
- Usa el modo debug para ver qué está pasando

### Error: "Unable to parse range"
- El nombre de la hoja contiene caracteres especiales
- Usa comillas simples: `'Mi Hoja'!A:G`

## 🌍 Zonas horarias soportadas

Puedes usar cualquier zona horaria válida de la [base de datos tz](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones):

```javascript
// Ejemplos:
"America/Denver"      // Mountain Time (El Paso, TX)
"America/New_York"    // Eastern Time
"Europe/Madrid"       // Central European Time
"Asia/Tokyo"          // Japan Standard Time
```

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Siéntete libre de usarlo y modificarlo según tus necesidades.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Haz fork del proyecto
2. Crea una rama para tu feature
3. Commitea tus cambios
4. Haz push a la rama
5. Abre un Pull Request

## 📞 Soporte

Si tienes problemas o preguntas:

1. Revisa la sección de **Troubleshooting**
2. Usa el **modo debug** para diagnóstico
3. Abre un issue en GitHub

---

⭐ Si este proyecto te fue útil, ¡no olvides darle una estrella!
