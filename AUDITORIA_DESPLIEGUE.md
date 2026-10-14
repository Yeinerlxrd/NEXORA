# Auditoría de despliegue NEXORA

Fecha: 2026-10-13

## Alcance y limitaciones

Se inspeccionaron los archivos de Docker/Compose, entorno, configuración Laravel, rutas, controladores, modelos, políticas, migraciones, seeders, pruebas y páginas principales del frontend.

El entorno de esta auditoría no tiene Docker, PHP, Composer, Node ni npm. No existe `backend/vendor`, `frontend/node_modules`, `backend/composer.lock` ni `frontend/package-lock.json`. El directorio no es un worktree Git. Existe un `.env` local; sus secretos no se leyeron ni divulgaron. Tras confirmarse que la APP_KEY previa se compartió en el chat, se generó una clave Laravel nueva de 32 bytes, se guardó sin imprimir en `.env` y se limitaron sus permisos a `0600`. No se detectó un volumen Compose `mysql_data` preexistente; al ejecutar el comando Laravel de generación de clave, Compose creó el volumen nombrado vacío y las redes, pero no inició servicios ni migró datos.

Por estas limitaciones no fue posible reproducir directamente el `composer install`, capturar la excepción original de `package:discover`, construir imágenes, iniciar servicios, conectarse a MariaDB, migrar, ejecutar pruebas PHP o compilar TypeScript/Vite.

## Hallazgos originales y causa

1. **Fallo reportado de `package:discover` (bloqueo de build).** El bootstrap Laravel 11 tipaba incorrectamente el callback de `withMiddleware`; se corrigió a `Configuration\Middleware`. Además, `config/app.php` reemplazaba los proveedores predeterminados de Laravel por solo tres; se restauró `ServiceProvider::defaultProviders()` conservando el `AuthServiceProvider` de NEXORA. El usuario compartió compilación exitosa: `package:discover` reportó Sanctum, Tinker, Carbon y Termwind como `DONE`, y Docker etiquetó `nexora-backend:latest`.
2. **Declaraciones TypeScript de Vite faltantes.** El build real de frontend ejecutó `tsc` y falló con `Property 'env' does not exist on type 'ImportMeta'` en `src/lib/api.ts`.
3. **Health checks superficiales y ruta `/up` no proxyficada.** Se reemplazaron por checks `/api/health` con consulta MariaDB. La comprobación HTTP del usuario mostró además que NGINX entregaba la SPA al solicitar `/up`; ahora proxyfica esa ruta exacta al backend.
4. **Datos fijos en operaciones frontend.** La pantalla de tareas asumía que el proyecto y la persona asignada tenían ID `1`; eso podía romper creación de tareas o asignarlas a una persona ajena al proyecto. Las pantallas de autenticación precargaban credenciales de demo.
5. **Asignación de tareas sin validación de pertenencia.** El backend validaba que `assignee_id` existiera, pero no que la persona asignada perteneciera al proyecto o grupo. Una asignación no autorizada podía otorgar acceso a datos de una tarea.
6. **Seed demo inseguro para producción.** El seeder crea cuentas con contraseñas de demostración conocidas y `DatabaseSeeder` lo invoca. La ejecución accidental en producción permitiría cuentas públicas predecibles.
7. **Protección incompleta de contexto Docker.** Se reforzó la exclusión de archivos `.env` anidados además de los del directorio raíz.
8. **Falta de lockfiles.** Composer y npm no cuentan con archivos de bloqueo, impidiendo builds de dependencias reproducibles.
9. **Pruebas backend incompatibles con la imagen.** PHPUnit configura SQLite en memoria, pero la imagen PHP no instalaba `pdo_sqlite`.
10. **Namespace de pruebas no autoloadable.** PHPUnit reportó `Class "Tests\TestCase" not found`; faltaba mapear `Tests\\` en Composer `autoload-dev`.
11. **Dependencia de pruebas Mockery ausente.** PHPUnit cargó las seis pruebas después del mapeo, pero cada una falló en `RefreshDatabase` con `Class "Mockery" not found`. Laravel testing requiere esa dependencia de desarrollo; se añade `mockery/mockery`.
12. **Enlace de dashboard incorrecto e inserciones de varios pasos.** El acceso rápido de creación apuntaba a una ruta inexistente; registro y creación de grupo podían persistir parcialmente si fallaba la emisión del token o la membresía.

## Correcciones realizadas

- `backend/bootstrap/app.php`: conserva el bootstrap Laravel 11 y declara el tipo correcto de callback `Configuration\Middleware`.
- `backend/config/app.php`: restaura el conjunto predeterminado de proveedores Laravel y conserva el proveedor de políticas de NEXORA.
- `backend/routes/api.php`: `/api/health` realiza `SELECT 1` contra la base configurada y solo devuelve `{"status":"ok"}` si puede consultar DB; no devuelve datos de conexión.
- `docker/nginx.conf`: envía `GET /up` al health endpoint de Laravel en vez del fallback SPA.
- `Dockerfile.backend` y `Dockerfile.frontend`: ambos health checks consultan `/api/health`.
- `backend/app/Http/Controllers/TaskController.php`: crea tareas únicamente en proyectos accesibles y comprueba que cualquier asignado pueda acceder al proyecto, tanto en creación como en actualización.
- `backend/tests/Feature/ProjectTaskAccessTest.php`: añade cobertura para rechazar asignación a un usuario ajeno y permitir a un miembro del proyecto.
- `backend/tests/Feature/AuthTest.php`: añade prueba del endpoint de salud con DB disponible.
- `frontend/src/pages/TasksPage.tsx`: carga proyectos reales del API y elimina los IDs estáticos; no asigna una persona por defecto.
- `frontend/src/pages/LoginPage.tsx` y `RegisterPage.tsx`: eliminan credenciales/datos precargados y añaden tipos/autocompletado y requisitos básicos HTML.
- `frontend/src/pages/DashboardPage.tsx`: muestra errores de carga en vez de permanecer indefinidamente en el estado de carga.
- `frontend/src/vite-env.d.ts`: añade las declaraciones estándar `vite/client`, necesarias para que TypeScript reconozca `import.meta.env`.
- `backend/app/Http/Controllers/AuthController.php` y `GroupController.php`: envuelven registro+token y grupo+membresía en transacciones.
- `backend/app/Http/Controllers/DashboardController.php`: corrige el acceso rápido para que apunte a la pantalla existente de proyectos.
- `backend/database/seeders/DemoSeeder.php`: rechaza explícitamente su ejecución cuando `APP_ENV=production`.
- `Dockerfile.backend`: instala `pdo_sqlite` para que los tests configurados con SQLite puedan ejecutarse.
- `backend/composer.json`: añade el namespace PSR-4 de `Tests\\` a `autoload-dev`; falta reconstruir para actualizar el autoloader de la imagen.
- `backend/composer.json`: añade `mockery/mockery` como dependencia de desarrollo requerida por el framework de pruebas Laravel.
- `Dockerfile.backend`: conserva `composer install` normal; el build compartido por el usuario completó `post-autoload-dump` y construyó la imagen backend.
- `.dockerignore` y `.gitignore`: excluyen `.env` raíz y anidados, manteniendo los `.env.example`.
- `README.md`: describe configuración, key, builds, pruebas, migraciones explícitas, backups, apagado sin eliminar el volumen y estado verificado.

La autenticación sigue siendo Sanctum bearer token y no se cambió a cookies. No se afirma que el flujo SPA con cookies/CSRF funcione.

## Validaciones ejecutadas

| Comprobación | Resultado real |
|---|---|
| Estado de herramientas de este agente | Docker, PHP, Composer, Node y npm no disponibles |
| Presencia de `.env` | Presente; solo se verificó estado de presencia/vacío para campos seleccionados, no se revelaron valores |
| Lockfiles/dependencias instaladas | No existen lockfiles, `backend/vendor` ni `frontend/node_modules` |
| Repositorio Git | No es un worktree; no se inicializó ni se cambiaron ramas |
| Lectura estática de rutas/controladores/modelos/migraciones/tests/UI | Realizada para el alcance listado arriba |
| Docker Compose YAML | Parseado con `CPAN::Meta::YAML` y aserciones estructurales en esta revisión; no se ejecutó `docker compose config` porque Docker no está instalado |
| PHP/Laravel tests y `package:discover` | No ejecutados: runtime ausente |
| Build backend | Usuario confirmó build inicial exitoso y posterior rebuild tras añadir `autoload-dev`; `package:discover` completó y `nexora-backend:latest` fue construida |
| Build frontend | Primer build detectó tipos de Vite faltantes; tras añadir `frontend/src/vite-env.d.ts`, el build pasó `tsc`, transformó 1598 módulos, generó `dist` y construyó `nexora-frontend:latest` |
| `docker compose ps -a` | Ejecutado por el usuario; ningún contenedor pertenece al proyecto Compose actual |
| APP_KEY local | Reemplazada con una clave nueva; valor no mostrado; `.env` con permisos `0600` |
| `docker compose up -d --wait --wait-timeout 120` | Ejecutado por el usuario; MariaDB, backend y frontend reportados `Healthy` |
| Health checks | Docker reporta los tres servicios saludables; backend/frontend comprueban `/api/health`, que ejecuta `SELECT 1` |
| HTTP frontend | `curl` desde el usuario devolvió el HTML servido por NGINX |
| HTTP `/api/health` | `curl` devolvió `{"status":"ok"}` a través de NGINX; confirma consulta de MariaDB |
| HTTP `/up` | Tras añadir proxy NGINX, respondió la página de salud estándar Laravel “Application up” |
| Reconstrucción/reinicio frontend | Usuario confirmó build exitoso; los tres servicios volvieron a reportarse `Healthy` |
| `php artisan route:list --path=api` | Ejecutado por el usuario; Laravel listó 23 rutas API |
| `php artisan test` | PHPUnit encontró seis pruebas, todas con error antes de sus aserciones por `Class "Mockery" not found` |
| Fix Composer autoload tests | `Tests\\` añadido y backend reconstruido; permitió cargar seis pruebas |
| Fix Mockery | Dependencia añadida en `composer.json`; pendiente rebuild backend y repetición PHPUnit |
| Migraciones | No ejecutadas; estado pendiente de inspección |

No se declara ninguna prueba de runtime aprobada.

## Riesgos y bloqueos pendientes

- Los builds backend y frontend fueron confirmados por la salida compartida; `package:discover`, TypeScript y Vite finalizaron correctamente.
- Los tres contenedores arrancaron y reportaron `Healthy`; `curl` confirmó frontend, `/api/health` con consulta MariaDB y `/up` de Laravel a través del proxy. Se reconstruyó y recreó frontend después de la corrección de NGINX.
- Laravel registró 23 rutas API. PHPUnit llegó a cargar seis pruebas, pero todas fallaron antes de las aserciones al faltar Mockery. Se añadió la dependencia; rebuild y rerun pendientes.
- Las operaciones API/autenticación, tests y persistencia tras reinicio quedan pendientes.
- La clave local ya fue reemplazada por una nueva, guardada en `.env` con permisos `0600`; debe conservarse.
- La compatibilidad real de las nuevas validaciones y el health check con MariaDB, el esquema existente y las pruebas SQLite aún requiere ejecución.
- No se probaron las migraciones sobre una base vacía ni, especialmente, su seguridad de actualización sobre una base existente.
- No hay lockfiles: las dependencias pueden variar entre builds. No se intentó generar lockfiles sin Composer/npm.
- La clave compartida previamente se considera comprometida y fue reemplazada. La nueva `APP_KEY` se guardó localmente, no se imprimió y `.env` tiene permisos `0600`. Debe conservarse en respaldos seguros y no cambiarse después de usar la aplicación.
- `docker compose ps -a` no mostró servicios preexistentes. El listado de volúmenes no encontró uno previo con la etiqueta Compose para `mysql_data`; el comando Laravel para generar la clave creó el volumen nuevo, y después `docker compose up` inició los servicios. No se ejecutaron migraciones ni se accedió a una base anterior.
- No se validó proveedor, HTTPS público, dominio, SMTP real, backup/restauración ni servicio MariaDB remoto.

## Comandos para diagnóstico y siguiente validación

Después de cambiar el proxy `/up`, reconstruir y recrear solo el frontend:

```sh
docker compose up -d --build --wait --wait-timeout 120 frontend
```

Después validar:

```sh
curl --fail http://127.0.0.1:8080/
curl --fail http://127.0.0.1:8080/up
curl --fail http://127.0.0.1:8080/api/health
docker compose exec backend php artisan route:list
docker compose exec backend php artisan test
```

El volumen es nuevo y el endpoint de salud consultó MariaDB, pero aún no se aplicaron migraciones. Inspeccionar antes de crear tablas:

```sh
docker compose exec backend php artisan migrate:status
```

Solo tras confirmar que es la base vacía nueva y revisar la lista de migraciones, aplicar:

```sh
docker compose exec backend php artisan migrate --force
```

No ejecutar `migrate:fresh`, `db:wipe`, `docker compose down -v` ni comandos de limpieza de volúmenes.

## Despliegue público

NEXORA no se considera lista para producción ni publicada. Para proceder faltan la ejecución real de las comprobaciones anteriores, lockfiles, una `APP_KEY` conservada, secretos en un gestor del proveedor, dominio/orígenes reales, HTTPS, MariaDB persistente compatible con backups, configuración SMTP real y evaluación de los límites del alojamiento elegido. No se inventó dominio ni proveedor.
