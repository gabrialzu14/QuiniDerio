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

**Estado (9/11/2026):** desde los servidores de Supabase ambas federaciones devuelven páginas vacías o cierran
la conexión, aunque la sesión se crea bien: bloquean el tráfico de centros de datos. Para activar la
sincronización automática hace falta que la federación permita el acceso del servidor de QuiniDerio (por
ejemplo, admitiendo el agente anterior) o que facilite otra vía (exportación o API). No se debe sortear ese
bloqueo. La función está desplegada pero **no programada**; se puede probar sin escribir datos con
`?dry=1&round=N`.
