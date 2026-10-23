# Continuidad histórica de NEXORA

Fecha de esta revisión: 2026-10-23

Este documento reconstruye el estado real del proyecto a partir de lo que existe en el
repositorio local, Git, Docker y la documentación versionada. No se ha tenido acceso a
conversaciones privadas de ChatGPT ni a historiales de otros agentes que no estén
guardados en el repositorio. Por tanto, ninguna decisión se atribuye a una conversación
que no pueda verificarse aquí.

## 1. Recursos comprobados

| Recurso | Estado real |
|---|---|
| Ruta | `/home/lordyeiner/Descargas/NEXORA` |
| Rama actual | `feature/nexora-figma-implementation` |
| HEAD | `b26bacd Implement Figma agents and skills for NEXORA project` |
| Remoto | `origin` = `https://github.com/Yeinerlxrd/NEXORA.git` |
| `origin/main` | `5c8ceb9 fix: validate Apache MPM at container startup` |
| Worktrees | `NEXORA` (rama feature), `NEXORA.worktrees/0-recuperacio-n-obligatoria-del-trabajo-previo-d` y `NEXORA.worktrees/prompt-maestro-nexora-full-project-completion-1`, ambos en `5c8ceb9` |
| Rama de respaldo | `backup/nexora-antes-de-corregir-autor` en `72e0596` |
| Stash | Vacío |
| Cambios sin commit | 44 archivos modificados y ~25 archivos nuevos |
| Docker | `backend`, `frontend` y `mysql` (MariaDB 11.4) activos y sanos |
| Frontend | React 18, TypeScript, Vite 6, React Router 7, lucide-react |
| Backend | Laravel 12, Sanctum 4, PHP 8.2+ |
| Pruebas | PHPUnit 64/64 y frontend 8/8 en la línea base |

## 2. Decisiones históricas verificadas

Estas decisiones están respaldadas por archivos versionados o por configuración
ejecutable, no por conversaciones.

1. **Arquitectura.** API Laravel separada de SPA React, servida en el mismo origen
   mediante NGINX (`/api` y `/up` proxyficados).
2. **Base de datos.** MariaDB 11.4 en Compose, con volumen nombrado `mysql_data`.
3. **Autenticación.** Sanctum con personal access tokens en
   `Authorization: Bearer`; el frontend guarda token y usuario en `sessionStorage`.
   No se usa autenticación por cookies/CSRF.
4. **Autorización.** Políticas Laravel para `Group`, `Project`, `Task` y
   `FriendRequest`; las tareas solo se asignan a usuarios con acceso al proyecto.
5. **Proyectos.** El borrado físico de proyectos está deshabilitado (`409`); se usa
   archivado y restauración reversibles.
6. **Fechas.** Las fechas límite son fechas de calendario y se serializan sin
   desplazamiento de zona horaria.
7. **Amigos.** Solicitudes con estados `pending`, `accepted`, `rejected` y `canceled`,
   amistad como par ordenado único, y notificaciones al recibir/aceptar.
8. **Grupos.** Invitaciones con vencimiento opcional, roles `Owner`, `Admin` y
   `Member`, y notificación al cancelar una invitación.
9. **Gamificación.** Retos propios de NEXORA con progreso autorreportado y XP
   persistido en `users.xp_total`; no hay integración con bibliotecas de juegos.
10. **Aislamiento de pruebas.** PHPUnit fuerza SQLite en memoria, caché de array y
    configuración de testing, incluso si el contenedor padre usa MariaDB.
11. **Seguridad de despliegue.** `.env` está ignorado; las pruebas no dependen de
    secretos reales; NGINX limita el origen y reescribe `X-Forwarded-For`.
12. **Figma.** No hay archivos de diseño, capturas ni especificaciones de Figma en el
    repositorio. Solo existe la URL del servidor MCP de Figma en `.vscode/mcp.json`.

## 3. Cambios confirmados en el código

- Migraciones `000015` a `000017` añaden identificador público a usuarios, solicitudes
  de amistad y amistades.
- `000018` añade `xp_total` a usuarios. En la revisión inicial **no estaba incluida en
  la imagen Docker en ejecución**, aunque sí existía en el árbol de trabajo.
- Controladores nuevos: `FriendshipController`, `GroupInvitationController`,
  `GroupMemberController`, `NotificationController` y `QuestController`.
- Recursos API nuevos: `GroupResource`, `NotificationResource`, `ProjectResource` y
  `TaskResource`.
- Páginas nuevas: `Daily`, `Friends`, `Gaming`, `Notifications` y `Settings`.
- El cliente API del frontend ya cubre autenticación, perfil, proyectos, tareas,
  grupos, invitaciones, amistades, notificaciones y retos.
- El commit `b26bacd` solo incorpora agentes y skills de `.github`; no cambia la
  aplicación.
- `.agents/`, `frontend/package-lock.json`, el respaldo `.vscode/mcp.json.bak.*` y
  varios archivos de prueba y controladores nuevos siguen sin versionar.
- Se añadió `frontend/src/components/UserAvatar.tsx` y se integró en el layout y en
  las tarjetas sociales, con `avatar_url` real y respaldo a iniciales.
- Las páginas Amistades, Grupos, Notificaciones, Ajustes y Tareas comparten ahora la
  cabecera `.welcome`; Amistades y Grupos usan paneles `.panel` con `.section-title`.
- Se eliminaron los estilos inline de Ajustes, Login y Registro y se añadieron clases
  equivalentes en `frontend/src/styles.css`.
- Se elevó la legibilidad base (navegación 12 px, párrafos 12 px, títulos de sección
  14 px, tablas 11 px) y se fijó una altura mínima de 38 px para botones.
- El registro ahora devuelve `xp_total` recién leído de la base de datos y una prueba
  de regresión cubre ese contrato.

## 4. Inferencias razonables

- El trabajo sin commitear es la continuación real del producto y debe conservarse:
  contiene las funcionalidades sociales, notificaciones, retos, perfil y la
  integración frontend-backend descritas en el README.
- La rama `feature/nexora-figma-implementation` pretendía implementar una referencia
  visual de Figma, pero el único rastro es el MCP y el sistema visual ya presente en
  `frontend/src/styles.css`. No puede reconstruirse el diseño original.
- El commit `b26bacd` se hizo después del trabajo funcional y probablemente fue una
  importación de herramientas de agentes, no una etapa de producto.
- La instalación de Vercel/Railway mencionada en el encargo no puede verificarse desde
  el repositorio; no hay configuración de esos proveedores ni URLs públicas.

## 5. Información no recuperable

- Conversaciones de ChatGPT, decisiones de producto y prompts que no se guardaron en
  el repositorio.
- Contenido exacto del diseño de Figma y sus tokens.
- Requisitos originales de Discord: no hay controlador, servicio, tabla, variable de
  entorno ni documentación de producto. Solo existen la ruta `/discord`, el ítem de
  navegación y una página de módulo pendiente.
- Estado real de los despliegues anteriores en Vercel y Railway.
- Credenciales, dominios y paneles de los proveedores externos.

## 6. Decisiones que necesitan confirmación humana

1. **Discord:** definir si se requiere OAuth de inicio de sesión, vinculación de cuenta,
   notificaciones por webhook/bot o invitaciones a servidores. No se implementará una
   opción inventada; hasta entonces el módulo se mantiene honestamente como pendiente.
2. **Figma:** aportar el archivo o capturas si se desea replicar un diseño concreto.
3. **Tipografía:** se elevó la base a 11–14 px para legibilidad sin rehacer la
   identidad visual. Si se desea otra escala, debe definirse antes de un rediseño
   mayor.
4. **Despliegue:** confirmar proveedor, dominio, HTTPS, base de datos persistente y
   gestor de secretos antes de publicar.

## 7. Estado de continuidad

El proyecto no necesita reconstrucción. Estado comprobado:

- el trabajo existente sigue íntegro y sin commit;
- las imágenes Docker de backend y frontend se reconstruyeron con el código actual;
- la migración `xp_total` está aplicada y el backend responde con salud `200`;
- los flujos reales contra MariaDB se verificaron de extremo a extremo;
- la arquitectura visual principal quedó unificada y se validó sin desbordamiento
  horizontal en escritorio (1440 px) y móvil (390 px);
- las pruebas siguen en verde: PHPUnit 64/64 y frontend 8/8.

Pendiente para cerrar el producto:

- decidir el alcance de Discord antes de implementarlo;
- aportar Figma si se desea replicar un diseño concreto;
- confirmar proveedor de despliegue, dominio, HTTPS y secretos;
- revisar y commitear de forma selectiva el trabajo actual.
