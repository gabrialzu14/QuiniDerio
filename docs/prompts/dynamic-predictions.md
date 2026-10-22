# PROMPT — Pronósticos y clasificación con movimiento | QuiniDerio

Aplica las siguientes mejoras en QuiniDerio. Revisa primero los componentes, estilos y navegación existentes para mantener la identidad visual y la lógica actual de jornadas, resultados y privacidad.

## 1. Pronósticos que aparecen al hacer scroll

Haz que los partidos se presenten progresivamente cuando entren en la pantalla, siguiendo la sensación de la barra de tendencias actual. Anima el recuadro, los equipos con sus escudos y las filas de participantes mediante un desplazamiento vertical corto y un fundido suave. Usa pequeños desfases para dar continuidad al listado.

Aplica también entradas suaves a las tarjetas de predicciones iniciales y al detalle de un participante. Evita que toda una lista larga se anime de golpe al abrir la pantalla. Cada elemento debe mostrarse una vez por visita, cuando llegue a su zona visible, sin cambiar su tamaño ni provocar saltos de contenido.

## 2. Vistas iniciales y salto a la jornada actual

Al abrir Clasificación, selecciona General. Al abrir Pronósticos, selecciona Predicciones iniciales.

Justo encima de cada barra de jornadas, añade «Avanzar a jornada actual →». Al pulsarlo, la flecha debe despegar hacia la derecha y la barra desplazarse con aceleración y frenado suaves, como un tren que llega a su estación. Incluye una señal visual que recorra la barra hasta la jornada de destino.

Selecciona la jornada correspondiente al finalizar el movimiento, usando la lógica existente de jornada actual. No cargues datos de cada jornada intermedia. Evita animaciones simultáneas y permite que una selección manual interrumpa el recorrido sin acabar abriendo otra jornada después. Mantén accesibles los botones y desactivadas las jornadas no disponibles.

## 3. Detalle de pronósticos desde Clasificación

Al pulsar un jugador, conserva su detalle por jornada y simplifica las tarjetas de partido. Elimina las palabras «Acierto» y «Fallo», el tick y la X de resultado. Señala el acierto en verde y el fallo en rojo mediante un borde o acento discreto. Mantén el pronóstico 1/X/2 en blanco sobre un fondo legible.

Conserva los estados necesarios de partidos pendientes o suspendidos y los marcadores disponibles. No marques como fallados los partidos sin resultado definitivo. Mantén una descripción accesible del resultado para lectores de pantalla y respeta la privacidad de los pronósticos antes del comienzo de la jornada.

## 4. Tarjetas y contadores

Corrige el fondo azul y el borde de «Mi pronóstico» en Predicciones iniciales: una superficie continua, esquinas coherentes y contenido dentro del recuadro, tanto en modo claro como oscuro.

Añade transiciones de contador a posiciones y puntuaciones de la clasificación, importes del bote, resumen de estadísticas y cantidades de tarjetas. Deben llegar exactamente al valor real, conservar unidades y formatos y partir del valor anterior cuando cambien los datos. Las animaciones no deben modificar la ordenación ni los valores usados para los cálculos.

## 5. Notificaciones

Retira de Mi cuenta el botón «Enviar notificación de prueba». Conserva el interruptor de activación y el registro funcional de notificaciones.

## 6. Calidad y verificación

Usa animaciones breves, fluidas y discretas, sin efectos excesivos ni dependencias pesadas innecesarias. Respeta «Reducir movimiento», conserva controles por teclado y etiquetas accesibles, y libera observadores y animaciones al salir de cada vista.

Comprueba scroll, listas largas, cambio de jornada, interrupción del salto, estados pendientes/finalizados/suspendidos, nombres largos, contadores, modo claro/oscuro y pantalla estrecha. Ejecuta las pruebas existentes y la compilación. Verifica la interacción en navegador y distingue expresamente esa comprobación de una prueba en un iPhone o Android físico.

Entrega los cambios aplicados, el resultado de las comprobaciones y cualquier validación pendiente.
