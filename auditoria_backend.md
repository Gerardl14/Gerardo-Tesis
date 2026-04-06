# Auditoría y Plan Backend — Plataforma Colaborativa UNERG

## Estado Actual del Sistema

### ✅ Lo que está COMPLETADO y FUNCIONAL

#### Base de Datos (Supabase PostgreSQL)
| Tabla | Estado | Descripción |
|---|---|---|
| `profiles` | ✅ Activa + RLS | Perfiles de usuario con roles (`student`, `teacher`, `superadmin`). Conectada a `auth.users`. |
| `repositories` | ✅ Activa + RLS | Repositorios de código. CRUD completo por propietario. |
| `forum_threads` | ✅ Activa + RLS + Realtime | Hilos del foro. Categorías. Eliminación por autor, docente o admin. |
| `forum_messages` | ✅ Activa + RLS + Realtime | Mensajes del foro con soporte de fragmentos de código. |

#### Autenticación
- ✅ Supabase Auth con email/contraseña
- ✅ Confirmación por correo (SMTP integrado de Supabase en desarrollo)
- ✅ Trigger automático que asigna rol `student` a nuevos registros públicos
- ✅ Edge Function `admin-create-user` para gestión de usuarios por superadmin

#### Políticas de Seguridad (RLS)
- ✅ Lectura pública en todas las tablas (for SELECT)
- ✅ Inserción/actualización solo por propietario en repos, threads, messages
- ✅ Superadmin tiene acceso total (CRUD) en todas las tablas
- ✅ Docentes pueden moderar (eliminar) hilos y mensajes del foro
- ✅ Usuarios pueden eliminar su propio contenido

#### Frontend (Next.js + pnpm)
| Ruta | Funcionalidad |
|---|---|
| `/login` | Inicio de sesión para todos los roles. Sin selector de rol. |
| `/register` | Registro exclusivo para estudiantes. Asigna `student` automáticamente. |
| `/dashboard` | Panel principal con estadísticas y accesos rápidos. Diferenciado por rol. |
| `/repos` | CRUD completo de repositorios. Crear, listar, eliminar. |
| `/forum` | Foro con categorías, hilos, mensajes en tiempo real, modo código. |
| `/profile` | Edición de perfil personal. |
| `/admin` | Panel CRUD de usuarios (solo visible para superadmin). Crear docentes, editar roles, eliminar usuarios. |

---

## 🔧 PASOS INMEDIATOS PARA EL USUARIO

### 1. Crear el primer Super Administrador
El sistema necesita un superadmin inicial. Hay dos opciones:

**Opción A — Registro + SQL (Recomendada):**
1. Abre la app (`pnpm run dev` en la carpeta `frontend/`)
2. Ve a `/register` y regístrate con tu correo personal
3. Confirma tu correo (Supabase te enviará un email)
4. Ve al panel de Supabase → SQL Editor y ejecuta:
```sql
UPDATE public.profiles 
SET role = 'superadmin' 
WHERE id = (SELECT id FROM auth.users WHERE email = 'TU_CORREO@ejemplo.com');
```
5. Cierra sesión y vuelve a iniciar — ahora tendrás acceso al panel `/admin`

**Opción B — Desde Supabase Dashboard:**
Ve a Authentication → Users → Crea un usuario manualmente, luego actualiza su rol con el SQL anterior.

---

## 📋 TAREAS PENDIENTES PARA EL BACKEND

Las siguientes funcionalidades requieren desarrollo backend adicional (Edge Functions, lógica servidor, o un servidor Node.js externo):

### Prioridad Alta

#### 1. Sistema de Colaboradores en Repositorios
- **Tabla necesaria:** `repository_collaborators` (pivote: user_id + repo_id + role)
- **Lógica:** Invitar estudiantes a un repositorio, aceptar/rechazar invitación
- **RLS:** Solo el dueño del repo puede invitar. Colaboradores pueden leer/escribir.

#### 2. Sistema de Archivos / Versiones de Código
- **Tabla necesaria:** `repository_files` (repo_id, path, content, version)
- **Lógica:** Subir archivos, ver historial de versiones, diff entre versiones
- **Storage:** Supabase Storage para archivos pesados

#### 3. Comentarios en Código (Code Review)
- **Tabla necesaria:** `code_comments` (file_id, line_number, author_id, content)
- **Lógica:** Docentes dejan feedback línea por línea
- **Realtime:** Suscripción para ver comentarios nuevos en vivo

#### 4. Sistema de Notificaciones
- **Tabla necesaria:** `notifications` (user_id, type, content, read, created_at)
- **Tipos:** Nuevo comentario en tu código, respuesta en foro, invitación a repo
- **Edge Function:** Para generar notificaciones automáticas en eventos

### Prioridad Media

#### 5. Sistema de Calificaciones
- **Tabla necesaria:** `grades` (teacher_id, student_id, repo_id, score, feedback)
- **Vista:** Panel docente para asignar notas a entregas

#### 6. Búsqueda Avanzada
- **PostgreSQL Full Text Search** en hilos del foro, repositorios, y perfiles
- **Edge Function** para búsqueda unificada

#### 7. Integración con GitHub Real
- **OAuth:** Conectar cuenta GitHub del estudiante
- **API:** Sincronizar repositorios, mostrar commits reales
- **Edge Function:** Webhook para recibir push events

### Prioridad Baja

#### 8. Compilación/Ejecución de Código en la Nube
- Sandbox de ejecución para lenguajes básicos (Python, JS)
- Contenedor Docker seguro o API externa (Judge0, Piston)

#### 9. Exportación de Datos
- Edge Function para generar reportes PDF/CSV de calificaciones
- Estadísticas de participación por estudiante

#### 10. Servidor SMTP Propio
- Reemplazar el SMTP de desarrollo de Supabase con un servicio real (SendGrid, Resend, Mailgun)
- Personalizar plantillas de correo con la marca UNERG

---

## 🏗️ Arquitectura Recomendada para el Backend

```
Frontend (Next.js) ──→ Supabase Client SDK
                          │
                          ├── Auth (email/password)
                          ├── Database (PostgreSQL + RLS)
                          ├── Realtime (foro en vivo)
                          ├── Storage (archivos de código)
                          └── Edge Functions (lógica servidor)
                               ├── admin-create-user ✅ (desplegada)
                               ├── notify-user (pendiente)
                               ├── grade-submission (pendiente)
                               └── github-sync (pendiente)
```

## 📁 Estructura de Archivos del Proyecto

```
tesistigre/
├── frontend/
│   ├── .env.local                 # Variables de entorno Supabase
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx         # Layout raíz con AuthProvider
│   │   │   ├── page.tsx           # Redirección según auth
│   │   │   ├── globals.css        # Sistema de diseño glassmorphism
│   │   │   ├── login/page.tsx     # Inicio de sesión
│   │   │   ├── register/page.tsx  # Registro de estudiantes
│   │   │   ├── dashboard/page.tsx # Panel principal
│   │   │   ├── repos/page.tsx     # Repositorios
│   │   │   ├── forum/page.tsx     # Foro en tiempo real
│   │   │   ├── profile/page.tsx   # Perfil de usuario
│   │   │   └── admin/page.tsx     # Panel superadmin CRUD
│   │   ├── components/
│   │   │   ├── AuthProvider.tsx   # Inicializador de auth
│   │   │   └── Sidebar.tsx        # Navegación lateral
│   │   └── lib/
│   │       ├── supabase.ts        # Cliente Supabase
│   │       └── store.ts           # Estado global (Zustand)
│   └── package.json
├── frontend_arquitectura.md
└── backend_arquitectura.md
```

---

*Documento generado el 1 de abril de 2026. Para la próxima fase de desarrollo, una IA o desarrollador debe enfocarse en las tareas de Prioridad Alta listadas arriba.*
