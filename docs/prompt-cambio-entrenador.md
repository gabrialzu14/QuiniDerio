# Prompt: aviso visual de entrenador en dos pasos

Actualiza QuiniDerio en `gabrialzu14/QuiniDerio`, Vercel `quiniderio` y el proyecto Supabase `QuiniDerio`. Mantén el cambio ya aplicado de Nando Alonso a Aner Blanco, sus fotografías y las predicciones migradas. Mejora la transición del aviso y simplifica la segunda pantalla con tarjetas de fútbol, menos texto y nombres destacados. Publica en `main` al terminar las comprobaciones.

## Primer paso

Conserva la composición aprobada: antetítulo «DERIO A», título «Cambio de entrenador», fotos de Nando Alonso y Aner Blanco, sus nombres y la explicación de continuidad de las predicciones. Reutiliza los WebP transparentes existentes, con sus variantes de resolución y sus animaciones.

El primer botón «Entendido» debe avanzar al segundo paso sin cerrar el modal y sin guardar una confirmación.

## Transición continua

Usa un único fondo y una única ventana para ambos pasos. El modal y el botón deben conservar su posición y dimensiones al avanzar. Mantén ambas pantallas montadas dentro de un contenedor estable y realiza un fundido con un desplazamiento horizontal corto. Coordina la salida de la primera pantalla y la entrada de la segunda durante unos 350–380 ms, sin fotogramas vacíos ni saltos de altura.

Carga los participantes durante la primera parte para que la segunda pueda entrar completa. Mantén el contenido del paso inactivo fuera del foco y de la lectura accesible mediante `inert` y `aria-hidden`. El botón permanece bloqueado mientras dura la transición. Con movimiento reducido, cambia de pantalla de forma inmediata conservando el mismo recorrido.

## Segundo paso: información visual

Usa únicamente:

- Antetítulo: «DERIO A».
- Título: «Predicciones actualizadas».
- Una sola línea de cambio, compartida por todos: «Nando Alonso → Aner Blanco», con **Aner Blanco** en negrita.
- Una fila compacta por participante, con avatar, **nombre en negrita**, categoría breve y la tarjeta de fútbol correspondiente.
- Nota breve: «Puntos intactos.».
- Botón final: «Entendido».

Correspondencia obligatoria de las tarjetas:

| Campo | Predicción | Texto breve | Tarjeta |
| --- | --- | --- | --- |
| `firstCoach` | Primer entrenador expulsado | Primer expulsado | Roja |
| `coachCards` | Entrenador con más tarjetas | Más tarjetas | Amarilla |

Dibuja las tarjetas con SVG o CSS: forma vertical, esquinas ligeramente redondeadas, color vivo y un reflejo discreto. No uses emojis como sustituto. El texto de la categoría debe acompañar al color para que el significado sea accesible.

Obtén los participantes de `quini_public_profiles`, leyendo solo `user_id`, `username`, `season` y `has_profile_pic`. Filtra las dos elecciones de entrenador que ya señalan a Aner, admitiendo Nando como nombre anterior. Conserva el orden alfabético y agrupa ambas categorías cuando una persona tenga las dos. Los nombres deben proceder de los datos reales y no escribirse en el código. Usa el avatar actual o una inicial si no carga; destaca «TÚ» en la fila del usuario que está leyendo el aviso.

Presenta todos los afectados de forma legible en móvil y escritorio. Las filas deben ser compactas para que los cinco participantes actuales se vean sin un bloque extenso de texto. En ventanas muy bajas, permite desplazamiento dentro de la lista y conserva el botón accesible.

Introduce las filas con un escalonado breve y anima la aparición de las tarjetas con un movimiento suave de entrada. Anima también la flecha de Nando a Aner. Evita repetir en cada fila los nombres de ambos entrenadores, las etiquetas «ANTES» y «AHORA», párrafos explicativos o contadores que añadan ruido. Mantén los colores de QuiniDerio, tipografía Inter, contraste adecuado y adaptación al modo claro.

## Confirmación y nueva publicación

Solo la segunda pulsación de «Entendido», con los datos cargados correctamente, guarda la confirmación. Comprueba la sesión real y resiste dobles pulsaciones. Si falla la carga o el guardado, muestra un error breve y permite reintentar; conserva el aviso pendiente.

Utiliza el identificador `derio-a-aner-blanco-2026-11-07-v3` en `quini_announcement_acknowledgements` para que todos vuelvan a recibir esta versión. Conserva las confirmaciones anteriores y la separación por usuario y dispositivo. Espera a que terminen la pantalla de carga y otros diálogos antes de mostrarlo.

Esta actualización es informativa: conserva predicciones, participantes, resultados, tarjetas históricas y puntos.

## Comprobaciones

Verifica que las cuatro elecciones actuales de primer expulsado usan tarjeta roja y la elección de más tarjetas usa tarjeta amarilla, sin confundir las categorías ni incluir otras elecciones. Prueba los dos pasos, la precarga, la recarga intermedia, el guardado final, los errores recuperables y la separación entre cuentas.

Mide la posición y el tamaño del modal antes y después de avanzar: deben mantenerse. Revisa las cinco filas en móvil de 320 y 375 píxeles y en escritorio, ambos temas y el recorrido con teclado. Ejecuta las pruebas y el build, publica el commit correcto y comprueba el despliegue de producción.
