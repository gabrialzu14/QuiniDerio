# Acceso a los datos de la federación

**Autorización.** El administrador de QuiniDerio (Gabri Alzueta) declara el 9 de noviembre de 2026 que la
Federación Vasca de Fútbol (euskadifutbol.eus) y la Federación Vizcaína de Fútbol (fvf-bff.eus) autorizan
el acceso a sus páginas públicas **solo para obtener los datos del juego**.

**Qué se lee** (`supabase/functions/federation-sync`):
- Calendario de la jornada (`NFG_CmpJornada`): rival, local o visitante, fecha, hora y campo.
- Clasificación (`NFG_VisClasificacion`): posición, puntos y forma de los últimos partidos.

**Qué no se lee:** los marcadores. Las páginas los protegen expresamente y no hacen falta: los resultados se
introducen en administración.

**Cómo:** con el agente `QuiniDerio/1.0 (+https://quiniderio.vercel.app; datos autorizados para el juego)`,
pausas entre peticiones, como máximo una ejecución cada 10 minutos y solo para los partidos aún no jugados
(unas 12 páginas por ejecución).

**Servidores (9/11/2026):** desde Supabase y desde Vercel ambas federaciones abren la sesión pero devuelven las
páginas vacías (0 bytes) o cierran la conexión: no sirven datos a servidores. No se debe sortear ese bloqueo.
La función `federation-sync` queda desplegada pero **sin programar** (prueba sin escribir: `?dry=1&round=N`).

**Cómo se cargan los datos: botón "Cargar jornada"** (`app/lib/federation-import.ts`). Es un favorito del
navegador del administrador. Pulsado en euskadifutbol.eus o fvf-bff.eus, consulta en QuiniDerio la jornada
federativa pendiente de cada equipo de esa web, lee en ese mismo navegador su calendario y su clasificación
(dos páginas por equipo), guarda solo el partido del Derio y las filas del Derio y su rival, y abre
`/admin#fed=…`. Allí se revisan los cambios y se guardan con "Guardar todo". Lo pulsa el administrador
cuando quiere (por ejemplo, cada domingo); no hay ejecuciones automáticas.

**Carga semanal (desde el 9/11/2026):** cada domingo a las 20:36 (Europe/Madrid) una sesión de Claude Code ejecuta
`node --experimental-strip-types --no-warnings scripts/federation-load.mjs --sql /tmp/federation.sql` y aplica el SQL
en Supabase. Solo actualiza los partidos con estado `scheduled` de la jornada pendiente de cada equipo (fecha, hora,
campo, posiciones, puntos y forma). Si la fecha de un equipo no cae en el mismo fin de semana que el resto de su
jornada, no se escribe y se avisa: suele indicar una jornada federativa mal anotada. Cada ejecución deja un registro
en `quini_federation_sync_runs` (`source: weekly-claude`). Prueba sin escribir: `--round N --dry`.
