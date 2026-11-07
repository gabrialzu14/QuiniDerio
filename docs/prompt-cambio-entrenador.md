# Prompt: aviso del cambio de entrenador en dos partes

Conecta con el repositorio `gabrialzu14/QuiniDerio`, el proyecto Vercel `quiniderio` y su proyecto Supabase `QuiniDerio`. Actualiza el aviso ya publicado del relevo de Nando Alonso por Aner Blanco. Divídelo en dos pantallas consecutivas, anima todo el recorrido y vuelve a mostrarlo a todos los usuarios, incluidos quienes confirmaron la versión anterior. Publica en `main` al terminar las comprobaciones.

## Continuidad de las predicciones

El entrenador y sus referencias ya están actualizados. Inspecciona el código y los datos actuales y conserva las tarjetas de equipo, formularios, predicciones, panel de administración e identidad del Derio A.

Las elecciones de «Primer entrenador expulsado» y «Entrenador con más tarjetas» ya han pasado de Nando Alonso a Aner Blanco. Conserva esa migración y la normalización existente de borradores locales y perfiles antiguos. La segunda parte del aviso debe consultar y explicar el cambio ya realizado, sin reescribir elecciones.

Conserva las posiciones pronosticadas, el resto de elecciones, los estados de bloqueo, participantes, quinielas, resultados, aciertos y puntos. La actualización no debe modificar las tarjetas históricas ni atribuir a Aner acciones ocurridas con Nando. No confundas a Aner Blanco con Aner Taranilla. Comprueba las cantidades y las huellas de los datos que deben permanecer intactos antes y después.

## Fotografías existentes

Reutiliza los retratos transparentes de Nando y Aner ya publicados. Conserva su encuadre, identidad, ropa, contornos y fidelidad, así como las variantes WebP de Aner de 384 y 768 píxeles.

Mantén las URL versionadas, el canal alfa y la selección de resolución según el dispositivo. La primera parte debe conservar la composición ya aprobada con ambos entrenadores.

## Primera parte: cambio de entrenador

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
- Nota: «A continuación, los participantes afectados.».

Mantén ambas fotos visibles al mismo tiempo. Anima el fondo y la apertura del modal; introduce las tarjetas desde lados opuestos con un escalonado suave, un pequeño asentamiento de los retratos, una flecha que conecte el relevo y la aparición del indicador del nuevo entrenador. Introduce después la explicación y el botón. Usa movimientos cortos, naturales y fluidos con `transform` y `opacity`, sin animar medidas que provoquen saltos de diseño. Añade salida animada e interacción discreta del botón. Respeta `prefers-reduced-motion`.

Al pulsar «Entendido», realiza una transición de salida y entrada hacia la segunda parte dentro del mismo modal. Esta primera pulsación no cierra el aviso ni guarda una confirmación. Muestra un indicador discreto de progreso «1 / 2» y después «2 / 2». Conserva el antetítulo «DERIO A», sin añadir «Nueva etapa».

## Segunda parte: predicciones afectadas

Título: «Predicciones actualizadas». Introducción: «Estos son los participantes afectados y lo que cambia en sus elecciones.».

Consulta `quini_public_profiles` y utiliza solo `user_id`, `username`, `season` y `has_profile_pic`. Obtén los participantes cuyas elecciones `firstCoach` o `coachCards` señalan a Aner Blanco, admitiendo también Nando Alonso si algún cliente conserva datos antiguos. La información de los participantes debe proceder de Supabase; no escribas sus nombres en el código ni inventes afectados.

Presenta una tarjeta por participante, ordenada por nombre. Incluye su avatar con alternativa de inicial, su nombre de usuario y la etiqueta «TÚ» cuando corresponda al usuario actual. Cada elección afectada debe indicar su categoría exacta y un antes y un después claramente diferenciados: «ANTES · Nando Alonso» → «AHORA · Aner Blanco». Traduce `firstCoach` como «Primer entrenador expulsado» y `coachCards` como «Entrenador con más tarjetas». Si una persona tiene ambas elecciones, agrúpalas en su misma tarjeta.

Añade contadores animados de participantes y predicciones. Introduce las tarjetas de forma escalonada y anima la flecha y la aparición de Aner después de Nando. Mantén legibles todos los nombres y evita movimientos continuos que dificulten la lectura. Incluye el texto «Se conservan los puntos y el resto de predicciones.».

El listado debe poder desplazarse dentro del modal cuando no quepa, manteniendo accesible el botón final «Entendido». Incluye carga animada, mensaje de error y botón «Reintentar». No permitas confirmar hasta que la consulta haya terminado correctamente. La segunda pantalla solo informa de la actualización ya realizada: no vuelve a modificar las predicciones ni los puntos.

El modal debe ser cómodo en móvil vertical y escritorio. Cuida márgenes de seguridad de iPhone, pantallas estrechas y ventanas bajas; permite desplazamiento interno si hace falta. Evita contenido cortado, texto desbordado y retratos deformados.

## Comportamiento por usuario

Muestra el aviso al entrar con sesión válida. Espera a que termine la pantalla de carga y a que se cierren otros diálogos. No lo superpongas a los avisos existentes. Usa un identificador nuevo de comunicación, `derio-a-aner-blanco-2026-11-07-v2`, para volver a mostrar el recorrido completo a todos los usuarios. Conserva las confirmaciones de la versión anterior. Guarda la nueva confirmación en `quini_announcement_acknowledgements` únicamente después de pulsar «Entendido» en la segunda parte. Tras confirmar no debe repetirse en otro dispositivo. Si se recarga la app después de la primera parte, el aviso sigue pendiente y vuelve a empezar. Al cambiar de cuenta, cada usuario conserva su propio estado.

El guardado debe comprobar la sesión, resistir dobles pulsaciones y permitir reintentar si falla la conexión. No marques el aviso como leído cuando el servidor no haya guardado la confirmación. Protege el foco del teclado, el bloqueo del desplazamiento, los nombres accesibles y la restauración del foco al cerrar. Cancela solicitudes y temporizadores al desmontar el componente o cambiar de usuario.

## Validación y publicación

Ejecuta las pruebas existentes y verifica TypeScript y el build. Comprueba la clasificación de afectados, una o dos elecciones por persona, exclusión de elecciones de otros entrenadores, ausencia de mutaciones al leer y nueva identidad del aviso. Prueba la primera pulsación sin confirmación, recarga intermedia, transición animada, lista real, reintento de carga, confirmación final, fallo de guardado, doble pulsación y aislamiento entre cuentas. Revisa ambas partes a 320 y 375 píxeles, en escritorio y en los dos temas. Comprueba que el foco no abandone el modal, que Escape no permita saltarse una parte y que los usuarios con movimiento reducido puedan completar el mismo recorrido. Publica el commit verificado y comprueba que producción corresponde a él. Informa del resultado real y de cualquier comprobación que no se haya podido completar.
