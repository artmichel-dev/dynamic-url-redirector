export default {
  async fetch(request, env, ctx) {
    // Configuración - Obtener desde variables de entorno de Cloudflare
    const SPREADSHEET_ID = env.SPREADSHEET_ID; // ID de tu Google Sheet
    
    // Intentar diferentes nombres de hoja comunes
    const possibleRanges = [
      'tap_content!A:G',   // Cambia por el nombre de tu hoja
      'A:G',               // Sin especificar hoja (usa la primera)
      'Sheet1!A:G',        // Inglés
      'Hoja1!A:G',         // Sin espacio
      "'Hoja 1'!A:G",      // Con espacio y comillas
      'tap!A:G',           // Nombre personalizado
      "'tap - tap_content'!A:G"  // Nombre con guiones
    ];
    
    let sheetsData = null;
    let accessToken = null;
    let workingRange = null;
    
    // Función para obtener access token de Google
    async function getGoogleAccessToken() {
      const privateKey = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
      const clientEmail = env.GOOGLE_CLIENT_EMAIL;
      
      const header = {
        alg: 'RS256',
        typ: 'JWT'
      };
      
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: clientEmail,
        scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
      };
      
      // Crear JWT
      const jwt = await createJWT(header, payload, privateKey);
      
      // Intercambiar JWT por access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
      });
      
      const tokenData = await tokenResponse.json();
      return tokenData.access_token;
    }
    
    // Función para crear JWT (simplificada para Cloudflare Workers)
    async function createJWT(header, payload, privateKey) {
      const encoder = new TextEncoder();
      
      // Encode header and payload
      const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      
      const data = `${encodedHeader}.${encodedPayload}`;
      
      // Import private key
      const key = await crypto.subtle.importKey(
        'pkcs8',
        str2ab(atob(privateKey.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s/g, ''))),
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256'
        },
        false,
        ['sign']
      );
      
      // Sign
      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        encoder.encode(data)
      );
      
      const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      
      return `${data}.${encodedSignature}`;
    }
    
    function str2ab(str) {
      const buf = new ArrayBuffer(str.length);
      const bufView = new Uint8Array(buf);
      for (let i = 0; i < str.length; i++) {
        bufView[i] = str.charCodeAt(i);
      }
      return buf;
    }

    // Obtener la hora actual en zona horaria específica
    // Cambia 'America/Denver' por tu zona horaria
    function getNowInTimezone() {
      const now = new Date();
      const localTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Denver" }));
      return localTime;
    }

    // Convertir fecha/hora del CSV a objeto Date
    function parseDateTime(fecha, hora) {
      const [year, month, day] = fecha.trim().split('-');
      const [h, m] = hora.trim().split(':');
      
      const date = new Date(Number(year), Number(month) - 1, Number(day), Number(h), Number(m));
      return date;
    }

    // Formatear fecha para mostrar en el log
    function formatDate(date) {
      return date.toLocaleString("es-MX", { 
        timeZone: "America/Denver", // Cambia por tu zona horaria
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    }

    try {
      // Debug: Verificar variables de entorno
      let log = `🔍 DEBUG INICIAL:\n`;
      log += `SPREADSHEET_ID: ${SPREADSHEET_ID}\n`;
      log += `GOOGLE_CLIENT_EMAIL: ${env.GOOGLE_CLIENT_EMAIL ? 'Configurado' : 'NO CONFIGURADO'}\n`;
      log += `GOOGLE_PRIVATE_KEY: ${env.GOOGLE_PRIVATE_KEY ? 'Configurado' : 'NO CONFIGURADO'}\n`;
      log += `Rangos a probar: ${possibleRanges.join(', ')}\n\n`;
      
      if (!env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_PRIVATE_KEY || !SPREADSHEET_ID) {
        return new Response(log + "❌ Error: Variables de entorno no configuradas", {
          status: 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
      
      // Obtener access token
      log += `🔑 Obteniendo access token...\n`;
      accessToken = await getGoogleAccessToken();
      log += `✅ Access token obtenido\n\n`;
      
      // Probar diferentes rangos hasta encontrar uno que funcione
      log += `🔍 Probando diferentes nombres de hoja:\n`;
      
      for (const range of possibleRanges) {
        try {
          const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
          log += `📡 Probando: ${range} → ${apiUrl}\n`;
          
          const sheetsResponse = await fetch(apiUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          log += `   Status: ${sheetsResponse.status}\n`;
          
          if (sheetsResponse.ok) {
            const testData = await sheetsResponse.json();
            if (testData.values && testData.values.length > 0) {
              sheetsData = testData;
              workingRange = range;
              log += `   ✅ ¡Funciona! Datos encontrados (${testData.values.length} filas)\n`;
              break;
            } else {
              log += `   ❌ Sin datos\n`;
            }
          } else {
            const errorData = await sheetsResponse.json();
            log += `   ❌ Error: ${errorData.error?.message || 'Error desconocido'}\n`;
          }
        } catch (err) {
          log += `   ❌ Excepción: ${err.message}\n`;
        }
      }
      
      if (!sheetsData) {
        log += `\n❌ No se pudo acceder a ninguna hoja. Verifica:\n`;
        log += `1. Que la cuenta de servicio tenga acceso\n`;
        log += `2. URL de la hoja: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit\n`;
        log += `3. Que la hoja tenga datos\n`;
        
        return new Response(log, {
          status: 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
      
      log += `\n✅ Usando rango: ${workingRange}\n`;
      
      // Procesar datos (saltar header si existe)
      const rows = sheetsData.values.slice(1); // Asumiendo que la primera fila es header
      
      const now = getNowInTimezone();
      log += `🕓 Fecha y hora actuales: ${formatDate(now)}\n`;
      log += `🕓 Timestamp actual: ${now.getTime()}\n`;
      log += `📊 Datos obtenidos via Google Sheets API (${rows.length} filas)\n\n`;

      let defaultUrl = null;
      let selectedUrl = null;
      let reason = 'No match';

      const specific = [];
      const dynamics = [];

      // Procesar todas las filas
      for (let row of rows) {
        if (row.length < 6) continue; // Saltar filas incompletas
        
        const [tipo, fecha_inicio, hora_inicio, fecha_fin, hora_fin, url, description] = row;
        const tipoClean = tipo.trim();
        const urlClean = url.trim();

        if (tipoClean === 'default') {
          defaultUrl = urlClean;
          log += `🔹 DEFAULT: ${defaultUrl}\n`;
        } else if (tipoClean === 'specific' || tipoClean === 'dynamics') {
          const start = parseDateTime(fecha_inicio, hora_inicio);
          const end = parseDateTime(fecha_fin, hora_fin);
          
          const formattedStart = formatDate(start);
          const formattedEnd = formatDate(end);
          const formattedRange = `(${formattedStart} → ${formattedEnd})`;

          const obj = { 
            url: urlClean, 
            start, 
            end,
            startTimestamp: start.getTime(),
            endTimestamp: end.getTime()
          };

          if (tipoClean === 'specific') {
            specific.push(obj);
            log += `🔶 SPECIFIC: ${obj.url} ${formattedRange}\n`;
            log += `   Timestamps: ${obj.startTimestamp} → ${obj.endTimestamp}\n`;
          } else if (tipoClean === 'dynamics') {
            dynamics.push(obj);
            log += `🔸 DYNAMICS: ${obj.url} ${formattedRange}\n`;
            log += `   Timestamps: ${obj.startTimestamp} → ${obj.endTimestamp}\n`;
          }
        }
      }

      const nowTimestamp = now.getTime();
      log += `\n🔍 Buscando coincidencias (timestamp actual: ${nowTimestamp}):\n`;

      // Buscar en specific primero (mayor prioridad)
      for (const s of specific) {
        const isActive = nowTimestamp >= s.startTimestamp && nowTimestamp <= s.endTimestamp;
        log += `   SPECIFIC ${s.url}: ${isActive ? '✅ ACTIVO' : '❌ Inactivo'} (${s.startTimestamp} <= ${nowTimestamp} <= ${s.endTimestamp})\n`;
        
        if (isActive) {
          selectedUrl = s.url;
          reason = 'Matched SPECIFIC';
          break;
        }
      }

      // Si no hay specific activo, buscar en dynamics
      if (!selectedUrl) {
        for (const d of dynamics) {
          const isActive = nowTimestamp >= d.startTimestamp && nowTimestamp <= d.endTimestamp;
          log += `   DYNAMICS ${d.url}: ${isActive ? '✅ ACTIVO' : '❌ Inactivo'} (${d.startTimestamp} <= ${nowTimestamp} <= ${d.endTimestamp})\n`;
          
          if (isActive) {
            selectedUrl = d.url;
            reason = 'Matched DYNAMICS';
            break;
          }
        }
      }

      // Si no hay ninguna activa, usar default
      if (!selectedUrl && defaultUrl) {
        selectedUrl = defaultUrl;
        reason = 'Used DEFAULT';
      }

      log += `\n✅ Resultado: ${selectedUrl || 'No URL found'}\n`;
      log += `✅ Motivo: ${reason}`;

      const headers = {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      };

      const url = new URL(request.url);
      if (url.searchParams.get("debug") === "1") {
        return new Response(log, {
          status: 200,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers }
        });
      }

      if (selectedUrl) {
        return Response.redirect(selectedUrl, 302, {
          headers: headers
        });
      } else {
        return new Response("❌ Error: No URL disponible", { 
          status: 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers }
        });
      }
    } catch (err) {
      return new Response("❌ Error: " + err.message, { 
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }
}