# Auditoría completa de NEXORA

Fecha: 2026-10-23

## 1. Alcance y método

Esta revisión se hizo sobre el repositorio local
`/home/lordyeiner/Descargas/NEXORA`, la base MariaDB del volumen Compose y los
contenedores en ejecución. Se inspeccionaron Git, Docker, rutas, controladores,
modelos, políticas, migraciones, pruebas, cliente API, páginas y estilos.

No se leyeron ni divulgaron secretos de `.env`. No se accedió a conversaciones de
ChatGPT, a Figma ni a paneles externos. Las conclusiones se limitan a evidencia
verificable en el repositorio y en el runtime local.

## 2. Estado ejecutivo

NEXORA es un producto funcional en local, no una maqueta:

- API Laravel 12 con Sanctum, SPA React 18/TypeScript/Vite y MariaDB 11.4.
- Autenticación, perfil, amistades, grupos, invitaciones, proyectos, tareas,
  notificaciones, retos con XP y dashboard están conectados de extremo a extremo.
- Los tres contenedores están sanos y la migración `xp_total` está aplicada.
- Las pruebas backend y frontend pasan y el build de producción compila.
- La deuda principal ya no es funcional: es decidir Discord, aportar Figma si se
  desea replicar el diseño y confirmar el despliegue público.
- El trabajo sigue sin commit; hay 79 entradas en `git status --short`, incluidas
  herramientas de agentes que no deben versionarse.

## 3. Inventario técnico

| Capa | Estado real |
|---|---|
| Backend | Laravel 12, PHP 8.2+ en la imagen, Sanctum 4, políticas Laravel |
| Frontend | React 18, TypeScript 5.6, Vite 6, React Router 7, lucide-react |
| Base de datos | MariaDB 11.4, volumen nombrado `mysql_data` |
| Servidor | Apache/PHP para Laravel y NGINX para SPA + proxy `/api` y `/up` |
| Autenticación | Bearer token en `Authorization`, token y usuario en `sessionStorage` |
| Pruebas backend | PHPUnit 11.5, SQLite `:memory:`, 64 pruebas / 381 aserciones |
| Pruebas frontend | Node test runner + type stripping, 8 pruebas |
| Build frontend | `tsc && vite build`, salida en `frontend/dist` |
| Estado Docker | `backend` healthy, `frontend` healthy en `127.0.0.1:8080`, `mysql` healthy |

## 4. Flujos verificados contra MariaDB

Se ejecutó un flujo real con dos cuentas QA desechables y datos temporales. Todas las
comprobaciones usaron `Accept: application/json` y se limpiaron al finalizar.

| Flujo | Resultado |
|---|---|
| Registro de dos usuarios | `201` en ambos |
| Búsqueda de usuarios y solicitud de amistad | Correcta |
| Aceptación de amistad y listado | Correcta |
| Creación de grupo e invitación | Correcta |
| Aceptación de invitación | Correcta |
| Proyecto de grupo, archivo y restauración | Correcto |
| Borrado físico de proyecto | Bloqueado con `409`, como se diseñó |
| Tarea asignada y completada por el otro usuario | Correcta |
| Reto creado, unido y completado | Correcto |
| XP tras completar el reto | `50`, persistido y devuelto por el perfil |
| Identificador público estable | Verificado |
| Notificaciones generadas | `2` |
| Dashboard, búsqueda y health | Correctos |
| Limpieza de cuentas y datos QA | Correcta |

La base local conserva únicamente las dos cuentas reales previas. No se ejecutó
`DemoSeeder`, `migrate:fresh`, `db:wipe` ni ningún borrado de volumen.

## 5. Migraciones y Docker

`php artisan migrate:status` confirma `000015` a `000018` en estado `Ran`. La imagen
del backend y la del frontend se reconstruyeron después de los cambios de código.

Comprobaciones realizadas:

```sh
docker compose ps
docker compose exec backend php artisan migrate:status
curl --fail http://127.0.0.1:8080/api/health
```

Resultados: tres servicios `healthy`, `/api/health` con `200` y migración `000018`
aplicada sobre MariaDB.

## 6. Correcciones y mejoras de esta revisión

### Funcionalidad y contrato

- `AuthController::register` refresca el usuario antes de responder. Antes, la
  respuesta de registro podía devolver `xp_total: null` aunque la base ya tuviera `0`.
- `AuthTest` cubre ahora ese contrato con una aserción de respuesta y otra de base de
  datos.

### Interfaz

- Nuevo `UserAvatar`: usa `avatar_url` real, con respaldo a iniciales y `onError`.
- Integrado en el layout y en las tarjetas de amistades.
- Amistades usa `hasSearched`: ya no muestra “No se encontraron personas” antes de
  buscar.
- Amistades y Grupos comparten cabecera `.welcome`, paneles `.panel`,
  `.section-title`, contadores y cuerpos de sección.
- Notificaciones, Ajustes y Tareas usan la misma cabecera `.welcome`.
- Se eliminaron los estilos inline de Ajustes, Login y Registro.
- El identificador público se muestra truncado en tarjetas sociales y completo,
  copiable, en Ajustes.
- Se elevó la legibilidad: navegación 12 px, párrafos 12 px, títulos de sección
  14 px, tablas 11 px y botones con altura mínima de 38 px.
- Se añadieron estilos para avatares con imagen, estadísticas de cabecera,
  contadores, buscador, ID público y ayudas de autenticación.

### Validación visual

Se inspeccionaron las páginas con Chromium headless a 1440 × 1000 y 390 × 844:

- sin desbordamiento horizontal en Amistades, Grupos, Notificaciones, Ajustes,
  Tareas, Login y Registro;
- navegación móvil a 9 px con etiquetas ocultas, sin recortes;
- botón “Buscar” móvil estabilizado en 38 px de alto;
- estados vacíos correctos y sin mensajes prematuros;
- auditoría axe-core 4.10.2 en 12 vistas a 1440 px y 390 px: 0 violaciones tras
  corregir contraste, landmarks de autenticación y el nombre accesible del botón
  Crear en móvil.

## 7. Pruebas y build

| Comprobación | Resultado |
|---|---|
| `php -d extension=/usr/lib/php/modules/pdo_sqlite.so vendor/bin/phpunit` | 64/64, 381 aserciones |
| `npm test` | 8/8 |
| `npm run build` | Correcto, 1609 módulos transformados |
| `docker compose config --quiet` | Correcto |
| `docker compose build backend frontend` | Correcto |
| Health HTTP | `200` |

Nota: `artisan test` no está definido en este proyecto; la ejecución válida es
`vendor/bin/phpunit` con la extensión `pdo_sqlite` cargada para el proceso CLI.

## 8. Seguridad y configuración

Puntos fuertes observados:

- `.env` fuera de Git y del contexto Docker; no se expusieron valores.
- Sanctum con tokens revocables; cambio de contraseña revoca tokens.
- Políticas para grupos, proyectos, tareas y solicitudes de amistad.
- Tareas solo asignables a personas con acceso al proyecto.
- Borrado físico de proyectos deshabilitado con `409`.
- Rate limiting en login, registro y cambio de contraseña.
- Health check con consulta real a la base.
- NGINX sobrescribe `X-Forwarded-For`; el backend no está publicado al host.
- `DemoSeeder` se niega a ejecutarse en producción.

Riesgos o pendientes:

- No se auditó el despliegue público ni un proveedor externo.
- No hay configuración SMTP real verificada.
- El token en `sessionStorage` es aceptable para esta SPA, pero cualquier XSS lo
  expondría; mantener CSP y sanitización como parte del despliegue.
- `frontend/package-lock.json` sigue sin versionar; el build Docker usa `npm ci` y
  necesita ese archivo en un checkout limpio.
- Las pruebas usan SQLite; la compatibilidad de migraciones sobre MariaDB se verificó
  solo en la base local actual, no en todas las formas históricas de datos.

## 9. Integraciones y decisiones externas

### Discord

Solo existen la ruta `/discord`, el ítem de navegación y `PendingModulePage`. No hay
controlador, tabla, variables de entorno ni especificación recuperable. Implementar
OAuth, vinculación, webhooks o bot sin confirmación sería inventar producto.

### Figma

No hay archivo, capturas ni tokens de diseño en el repositorio. Solo hay una URL de
servidor MCP en `.vscode/mcp.json`. El sistema visual actual es la única referencia
verificable.

### Despliegue

No se identificó proveedor, dominio, HTTPS, base persistente ni gestor de secretos.
No se afirma que Vercel o Railway estén configurados.

## 10. Conclusión

El producto está listo para una revisión humana del trabajo y un commit selectivo. No
está listo para producción hasta resolver las decisiones externas y ejecutar el
despliegue con secretos, HTTPS y respaldos reales.

Prioridad inmediata: versionar el trabajo revisado sin incluir `.agents/`, respaldos
de configuración, secretos ni artefactos de build. Después, confirmar Discord, Figma
y el proveedor de despliegue.
