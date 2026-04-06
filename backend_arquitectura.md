# Arquitectura del Backend: Plataforma de Aprendizaje Colaborativo UNERG

## 1. Infraestructura Base
El backend estará sustentado íntegramente en **Supabase**, utilizando su ecosistema para cubrir la base de datos, autenticación, almacenamiento y tiempo real, eliminando la necesidad de gestionar servidores propios.

## 2. Base de Datos (PostgreSQL)
Se diseñará un esquema relacional optimizado. 

### Tablas Principales Propuestas:
* **users:** Almacena la información de perfil y su rol (`student`, `teacher`, `assistant`).
* **projects / repositories:** Información de los proyectos creados (nombre, descripción, dueño).
* **repository_collaborators:** Tabla pivote para dar acceso a estudiantes, profesores y preparadores a un repositorio específico (control de acceso).
* **commits / file_versions:** Almacena las versiones del código o el estado de los archivos, referenciado al repositorio. 
* **forum_threads:** Preguntas principales en el foro de dudas.
* **forum_messages:** Respuestas o comentarios a un hilo específico.
* **code_comments:** Comentarios hechos directamente por un profesor/preparador a una línea de código específica.

## 3. Autenticación y Autorización (Supabase Auth)
* Uso de autenticación por email/contraseña. 
* Implementación estricta de **Row Level Security (RLS)** en la base de datos de PostgreSQL. Esto asegura que:
  * Un estudiante solo pueda ver el código de los repositorios a los que fue invitado.
  * Un profesor pueda ver todos los repositorios de su clase.
  * Solo los autores o profesores puedan borrar preguntas del foro.

## 4. Almacenamiento (Supabase Storage)
* Se usará un 'Bucket' en Supabase para almacenar:
  * Avatares de los usuarios.
  * Archivos adjuntos pesados que los estudiantes necesiten subir al foro de preguntas (imágenes, PDFs de enunciados).
  * *Opcional:* Almacenar archivos de código fuente directo en Storage en lugar de la base de datos si los archivos son excesivamente grandes.

## 5. Tiempo Real (Supabase Realtime)
Activaremos Broadcast y Postgres Changes para ciertas tablas:
* `forum_messages`: Para que los usuarios vean las nuevas respuestas en vivo sin recargar la página.
* `code_comments`: Si un profesor corrige código mientras el estudiante está en la plataforma, le llegará una notificación.
* `commits`: Actualizaciones en la vista de repositorios si un compañero hace un aporte.

## 6. Funciones Edge (Supabase Edge Functions)
Se utilizarán funciones serverless (Deno/TypeScript) para lógicas que no deben ir en el cliente por seguridad, por ejemplo:
* Procesamiento de invitaciones a repositorios mediante enlaces.
* Integración con APIs externas (ej. si se desea compilar código básico en la nube o analizar sintaxis estructurada).
* Envío de correos de notificación complejos.

## 7. Flujo de Trabajo Futuro
Cuando se solicite hacer la conexión, aplicaremos migraciones SQL directamente usando la herramienta MCP de Supabase para construir este esquema y probar las políticas de RLS antes de integrarlas al código Front-End.
