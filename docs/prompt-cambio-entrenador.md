# Prompt: cambio de entrenador del Derio A en QuiniDerio

Conecta con el repositorio `gabrialzu14/QuiniDerio`, el proyecto Vercel `quiniderio` y su proyecto Supabase `QuiniDerio`. Implementa y publica el relevo de Nando Alonso por Aner Blanco como entrenador del Derio A. Usa la fotografía adjunta de Aner y la foto de Nando ya existente en la aplicación.

## Continuidad de las predicciones

Primero inspecciona el código, las tablas y las referencias reales. Actualiza el entrenador en las tarjetas de equipo, formularios, predicciones propias y de otros participantes, panel de administración y datos de los equipos. Conserva la identidad del equipo Derio A.

Las elecciones de «Primer entrenador expulsado» y «Entrenador con más tarjetas» que señalan a Nando Alonso deben pasar a Aner Blanco. Realiza una actualización idempotente de los campos concretos en Supabase. Normaliza también los borradores locales, datos de sesión y perfiles leídos por el cliente para que una caché anterior no vuelva a mostrar la selección antigua.

Conserva las posiciones pronosticadas, el resto de elecciones, los estados de bloqueo, participantes, quinielas, resultados, aciertos y puntos. La actualización no debe modificar las tarjetas históricas ni atribuir a Aner acciones ocurridas con Nando. No confundas a Aner Blanco con Aner Taranilla. Comprueba las cantidades y las huellas de los datos que deben permanecer intactos antes y después.

## Fotografía de Aner

Extrae únicamente a Aner del cartel adjunto. Elimina el fondo, textos, panel azul y decoraciones. Conserva su identidad, expresión, pelo, piel, postura, brazos cruzados, polo y escudos bordados. Usa transparencia real, contornos naturales y un encuadre ajustado a la figura, sin halos ni recortes en la cabeza o brazos.

Prepara WebP de 384 px y 768 px de ancho, manteniendo proporción y canal alfa. Utiliza compresión sin pérdida después del redimensionado y verifica que no añade diferencias en los píxeles visibles ni en el alfa. Sirve la variante adecuada según el tamaño de pantalla, con URL versionada. Comprueba el encuadre real en todas las tarjetas donde se muestra el entrenador.

## Aviso de cambio de entrenador

Diseña un modal acorde al estilo de QuiniDerio: tipografía Inter, fondo azul profundo, texto de alto contraste y acentos azules. Adapta expresamente los colores al modo claro.

Contenido exacto:

- Antetítulo: «DERIO A».
- Título: «Cambio de entrenador».
- Introducción: «Aner Blanco toma el relevo de Nando Alonso.».
- Foto de Nando con nombre y etiqueta «HASTA AHORA».
- Foto de Aner con nombre y etiqueta «NUEVO ENTRENADOR».
- Bloque destacado: «Tus predicciones siguen en juego».
- Explicación: «Las predicciones de Nando pasan a ser las de Aner. Se conservan tus elecciones y puntos.».
- Botón principal: «Entendido», sin flecha.
- Nota: «No tienes que hacer ningún cambio.».

Mantén ambas fotos visibles al mismo tiempo. Anima el fondo y la apertura del modal; introduce las tarjetas desde lados opuestos con un escalonado suave, un pequeño asentamiento de los retratos, una flecha que conecte el relevo y la aparición del indicador del nuevo entrenador. Introduce después la explicación y el botón. Usa movimientos cortos, naturales y fluidos con `transform` y `opacity`, sin animar medidas que provoquen saltos de diseño. Añade salida animada e interacción discreta del botón. Respeta `prefers-reduced-motion`.

El modal debe ser cómodo en móvil vertical y escritorio. Cuida márgenes de seguridad de iPhone, pantallas estrechas y ventanas bajas; permite desplazamiento interno si hace falta. Evita contenido cortado, texto desbordado y retratos deformados.

## Comportamiento por usuario

Muestra el aviso al entrar con sesión válida. Espera a que termine la pantalla de carga y a que se cierren otros diálogos. No lo superpongas a los avisos existentes. Guarda la confirmación en `quini_announcement_acknowledgements` con un identificador único de esta comunicación. Tras confirmar no debe repetirse en otro dispositivo. Al cambiar de cuenta, cada usuario conserva su propio estado.

El guardado debe comprobar la sesión, resistir dobles pulsaciones y permitir reintentar si falla la conexión. No marques el aviso como leído cuando el servidor no haya guardado la confirmación. Protege el foco del teclado, el bloqueo del desplazamiento, los nombres accesibles y la restauración del foco al cerrar. Cancela solicitudes y temporizadores al desmontar el componente o cambiar de usuario.

## Validación y publicación

Ejecuta las pruebas existentes, añade regresiones relevantes de continuidad de las predicciones y verifica TypeScript y el build. Comprueba los permisos de lectura e inserción de confirmaciones propias, el rechazo entre usuarios y la ausencia de filas de prueba. Revisa visualmente el aviso y el botón de confirmación, los dos temas y la adaptación móvil. Publica el commit verificado en el proyecto Vercel correcto y comprueba que la versión de producción corresponde a ese commit. Informa del resultado real y de cualquier comprobación que no se haya podido completar.
