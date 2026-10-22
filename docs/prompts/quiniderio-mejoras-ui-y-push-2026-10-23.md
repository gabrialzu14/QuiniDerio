# PROMPT CONSOLIDADO — QuiniDerio | Animaciones, clasificaciones, pronósticos y recordatorios

Fecha: 23/10/2026. Referencia visual: captura aportada por el usuario de las tarjetas horizontales de jornada (J7).

## 1. Inicio
- Contadores numéricos suaves con easing natural, de 750 a 1.100 ms y dígitos tabulares.
- Entradas progresivas de tarjetas, evitando cambios repentinos y reproducciones repetidas en scroll.

## 2. Clasificaciones
- La posición (#1, #2, etc.) aparece directamente, sin contador animado.
- Las filas conservan transiciones de entrada discretas.
- El selector de jornadas debe permitir arrastre horizontal táctil en móvil y trackpad/rueda horizontal en escritorio.
- Mantener visibles suficientes opciones para que exista desplazamiento horizontal incluso cuando se hayan publicado pocas jornadas; las futuras se muestran deshabilitadas, sin datos ficticios.
- El selector activo, incluyendo J7 cuando corresponda, **azul** y no verde.

## 3. Detalle de un participante desde Clasificaciones
- Modal Liquid Glass con entrada fluida y fondo oscurecido, encabezado visible, cierre claro y scroll vertical interno.
- Selector de jornadas horizontal y fluido; acceso solo a jornadas permitidas y sin mostrar información privada antes de tiempo.
- Al cambiar de jornada, animación breve con dirección coherente y caché segura por usuario/observador, con caducidad.
- **Diseño horizontal compacto, como la captura de referencia:** equipo local (nombre y escudo), marcador central, escudo y nombre visitante, separación vertical y **único pronóstico 1/X/2 al extremo derecho**, sin fila auxiliar «TU PRONÓSTICO».
- Escudos normalizados visualmente, proporciones originales, sin deformar ni recortar elementos del dibujo.
- Pronóstico antes del resultado final: **1 azul; X gris; 2 rojo**; texto blanco.
- Tras resultado final verificable: **acierto verde; error rojo más suave**, independientemente del valor 1/X/2. Sin pronóstico o partido no finalizado: estado neutro/predeterminado.
- Mantener el fondo de las filas azul oscuro y los bordes sutiles, sin saturar de color toda la tarjeta.
- Compatible con pantallas de 320 px, iOS y Android; áreas seguras y modo de movimiento reducido.

## 4. Todos los Pronósticos
- Misma navegación horizontal por jornadas que en Clasificaciones, con las futuras deshabilitadas y sin simular pronósticos.
- Preservar «Ir a jornada actual» y su animación, selección, filtros y seguridad.

## 5. Panel de Administración — Recordatorios push
- Envío individual y colectivo a participantes pendientes con bloqueos anti-repetición.
- Informe por destinatario: aceptado por el proveedor, fallo real, sin suscripción o estado desconocido; motivo cuando se conoce.
- **No** llamar «entregada» a una notificación aceptada por web-push.
- Historial persistente en Supabase solo accesible por la ruta del administrador autorizado y con RLS.
- No emitir notificaciones durante pruebas de compilación.

## 6. Validación y publicación
- No modificar resultados, clasificaciones, pronósticos ni puntos.
- Verificar compilación TypeScript, pruebas automatizadas, accesibilidad y respuesta de dispositivos.
- Desplegar a previsualización y publicar solo tras comprobar el resultado y la aprobación del usuario.
