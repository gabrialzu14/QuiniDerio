# Widgets de QuiniDerio

Dos widgets independientes: **Jornada completa** y **Partido a partido**. Cada usuario puede añadir uno, el otro o ambos. La PWA del navegador sigue funcionando; los widgets requieren instalar la aplicación nativa que los contiene.

## Datos y privacidad

`GET /api/widgets` sigue `quini_app_settings.active_round`. El parámetro opcional `round=1..60` permite abrir un partido histórico publicado, nunca una jornada futura. Reutiliza `quini_live_matches`, sus `fixture_details`, los descansos y las mismas fichas publicadas que la web. No infiere goles, minutos, descanso ni finales según la hora. Los marcadores permanecen en orden local–visitante. Solo devuelve campos de partidos, sin perfiles, tarjetas de personas, pronósticos, claves ni sesiones. Usa exclusivamente el cliente anónimo y las políticas de lectura ya existentes; no se cambia Supabase.

La caché compartida del servidor dura 30 segundos y la CDN otros 30 segundos, con hasta 30 segundos adicionales de stale-while-revalidate. Una consulta/actualización manual no obliga a consultar Supabase nuevamente si la caché sigue vigente. `fetchedAt` es cuándo se consultó el origen; `sourceUpdatedAt` identifica la última modificación de los partidos. «Consultado» no significa que alguien haya actualizado el marcador en ese momento. Los escudos tienen una caché PNG independiente de 24 horas y rutas restringidas al almacenamiento de escudos del club.

## Elección dentro de la app

En la aplicación nativa, **Mi cuenta → Widget de jornada** abre `/widgets`. El selector conserva la elección en ese dispositivo y muestra datos reales, no ejemplos. En Android solicita fijar el proveedor elegido; iOS guarda la elección y explica cómo añadir cada formato desde la galería. La galería mantiene disponibles los dos tipos. No se muestra el acceso en el perfil de la PWA, donde la función no existe. La ruta se puede consultar desde un navegador como vista previa, con una advertencia explícita y sin botón de instalación ficticio.

Android no comparte cookies/sesión con la PWA de Chrome. El usuario iniciará sesión en el nuevo contenedor web. Los widgets consultan exclusivamente resultados públicos y siguen funcionando sin una sesión web abierta. La versión nativa no incorpora las notificaciones Web Push del navegador: deben seguir usándose en la PWA hasta implementar notificaciones nativas.

## Android

Requisitos: JDK 17, Gradle 8.11.1, Android SDK 35. `cd native/android && gradle :app:assembleDebug :app:lintDebug`. El workflow **Widgets Check** compila un APK de prueba. Android Studio puede abrir el proyecto directamente. Para distribución final, configurar firma privada y producir el APK/AAB de release; no se incluye ninguna clave de firma.

Los proveedores son `CompactWidget` (un partido, flechas con selección independiente por instancia) y `FullRoundWidget` (3/5/7 filas según la altura disponible, con páginas para acceder al resto). Al cambiar la jornada se reinician las selecciones; una actualización dentro de la misma jornada conserva el partido por identificador, aunque cambie el orden. Al eliminar la última instancia se cancela el trabajo periódico. Los botones de navegación usan la caché local y no generan peticiones. Los escudos se descargan fuera del hilo de interfaz.

Un único JobScheduler periódico solicita actualizar todos los widgets cada 15 minutos, con permiso del sistema y sin alarmas exactas. Una pulsación en ↻ solicita una actualización inmediata; no existe garantía de ejecución inmediata si Android la aplaza. El último snapshot persiste y se identifica como «Sin conexión» tras un fallo. Sin un primer snapshot se muestra «Pulsa ↻ para consultar», sin marcadores inventados.

## iPhone

Requisitos: macOS, Xcode con SDK iOS 17 o posterior y XcodeGen. `cd native/ios && xcodegen generate`, abrir `QuiniDerio.xcodeproj` y configurar equipo de firma. Registrar **App Group** `group.com.quiniderio.widgets` en la aplicación y la extensión (o sustituirlo coherentemente en `project.yml` y `WidgetData.swift`). El workflow compila para simulador sin firma; eso no crea un paquete instalable en un iPhone.

La app debe distribuirse mediante un canal Apple válido, por ejemplo TestFlight/App Store. La revisión de tienda, el alta de identificadores, las credenciales y la firma no se realizan automáticamente. `QuiniDerioCompact` permite un partido con flechas en tamaño pequeño/mediano; `QuiniDerioFull` ofrece 2 partidos por página en mediano y hasta 7 en grande. Las instancias del mismo tipo comparten selección en esta versión; los dos tipos mantienen selecciones independientes. Los enlaces abren el contenedor nativo mediante el esquema `quiniderio`, validando el destino HTTPS de QuiniDerio.

WidgetKit solicita una nueva timeline tras 15 minutos; el sistema puede retrasarla según su presupuesto y batería. Los App Intents permiten pasar partidos y solicitar actualización. La selección utiliza App Group y el snapshot persiste cuando la app está cerrada. No hay carrusel automático continuo ni promesa de gol instantáneo. No se han implementado APNs ni Live Activities.

## Validación antes de distribuir

1. Desplegar la API y probar ambos tamaños con los datos de producción.
2. Instalar la app nativa, iniciar sesión y comprobar Mi cuenta, selección y fijación de ambos widgets.
3. Con dos partidos en juego, recorrer todos, corregir un marcador en Admin y verificarlo al refrescar. La fuente sigue siendo el panel actual; el widget no obtiene goles por su cuenta.
4. Probar Android con dos compactos diferentes, cambio de tamaño, reinicio, borrado de la última instancia y nombres largos; iPhone en pequeños/medianos/grandes con ambos tipos.
5. Modo avión: conservar resultados y hora consultada; recuperar red y refrescar. Probar también sin una primera descarga.
6. Avanzar jornada en Admin, comprobar reinicio de selección y abrir enlaces de la jornada anterior.
7. Verificar contraste, tamaño de texto aumentado, lectores de pantalla y toque en enlaces y controles reales.

Las pruebas Node verifican la transformación de datos. La compilación CI verifica los proyectos nativos; la interacción con el launcher, la actualización real en segundo plano y la batería necesitan dispositivos/simuladores y no deben declararse verificadas solo porque compile.
