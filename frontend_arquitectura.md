# Arquitectura del Frontend: Plataforma de Aprendizaje Colaborativo UNERG

## 1. Tecnologías Principales
* **Framework Core:** Next.js (React). Ideal para aplicaciones robustas, permite Server-Side Rendering (SSR) y optimización de rutas, lo cual es útil si la plataforma crece y requiere buen rendimiento.
* **Estilos:** Vanilla CSS / CSS Modules. Se utilizará un diseño moderno, incorporando animaciones suaves (micro-interacciones), modo oscuro (Dark Mode) por defecto, y una paleta de colores institucional pero moderna (inspirada en herramientas premium para desarrolladores).
* **Gestión de Estado:** Zustand o React Context para manejar el usuario activo, su rol y el estado global de la aplicación.
* **Iconografía y UI:** Lucide React o similar para iconos consistentes y ligeros.

## 2. Estructura de Vistas (Páginas)

### A. Autenticación y Perfil
* **Login/Registro:** Vista atractiva con colores vibrantes y de aspecto futurista. Distinción visual clara desde el inicio.
* **Perfil:** Configuración de credenciales de usuario (Estudiante, Docente, Preparador) y enlace a sus repositorios o foros participados.

### B. Módulo de Docentes / Preparadores
* **Dashboard:** Resumen de repositorios de las secciones que administran, métricas de estudiantes, preguntas recientes en el foro.
* **Gestión de Entregas:** Panel para revisar el código colaborativo de los estudiantes, dejar comentarios en líneas de código y calificar.

### C. Módulo de Estudiantes
* **Dashboard de Estudiante:** Acceso rápido a repositorios activos, notificaciones de cambios y tareas pendientes.
* **Flujo Colaborativo:** Interfaz tipo "GitHub" para visualizar ramas, commits, solicitar revisiones (Pull Requests adaptados al aprendizaje) y fusionar código.

### D. Interfaz de Código (Code Viewer)
* Visor de código fuente interactivo con resaltado de sintaxis (Syntax Highlighting).
* Integración para dejar comentarios directamente sobre el código (feedback en tiempo real).

### E. Foro de Preguntas y Respuestas (Tiempo Real)
* Interfaz dividida por categorías/materias.
* Chat/Hilos estilo Discord o StackOverflow, con actualización instantánea mediante conexiones WebSocket. Soporte para fragmentos de código (Markdown) en las preguntas.

## 3. Conexión con el Backend (Patrón de Datos)
* Todo el consumo de datos se hará mediante el SDK de Supabase cliente (`@supabase/supabase-js`).
* Suscripciones en tiempo real para el Foro y notificaciones de repositorios usando `supabase.channel()`.

## 4. Filosofía de Diseño UI/UX
* **Colores y Tipografía:** Uso de tipografías legibles para código (ej. Fira Code, JetBrains Mono) combinadas con tipografías limpias para la interfaz (Inter, Roboto).
* **"Wow Factor":** Transiciones fluidas al cambiar de sección, efectos Glassmorphism (cristal) sutiles, y feedback visual inmediato al realizar acciones (como hacer push a un repositorio o enviar una duda).
