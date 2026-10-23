# Plan de finalización de NEXORA

Fecha: 2026-10-23

## 1. Objetivo

Cerrar NEXORA con un producto verificable, un historial Git limpio y un despliegue
público solo cuando existan las decisiones y credenciales necesarias. El producto ya
funciona en local; este plan ordena lo que falta y evita inventar alcance.

## 2. Supuestos y límites

- No se tocarán las dos cuentas reales de la base local.
- No se ejecutará `migrate:fresh`, `db:wipe`, `down -v` ni ningún borrado de volumen.
- No se leerán ni commitearán secretos.
- No se implementará Discord por suposición.
- No se afirmará que Figma fue replicado sin archivo o capturas.
- El commit requiere confirmación explícita antes de ejecutarse.

## 3. Fase 1 — Checkpoint seguro del trabajo actual

### 3.1 Revisar antes de stagear

```sh
git status --short
git diff --check
git diff --stat
```

Verificar que no haya secretos, `.env`, respaldos locales ni artefactos de build.

### 3.2 Incluir en el commit

- Backend: controladores, modelos, políticas, recursos, migraciones, rutas, pruebas,
  configuración y seeders modificados.
- Frontend: `src/`, páginas, componentes, tipos, cliente API, estilos, pruebas y
  configuración de Vite.
- Infraestructura: `docker-compose.yml`, `Dockerfile.frontend`, `docker/nginx.conf`,
  `.dockerignore` y ejemplos de entorno sin valores reales.
- Documentación: `README.md`, `CONTINUIDAD_HISTORICA_NEXORA.md`,
  `AUDITORIA_NEXORA_COMPLETA.md`, `PLAN_FINALIZACION_NEXORA.md`.
- `frontend/package-lock.json`, necesario para que el build Docker con `npm ci` sea
  reproducible.

### 3.3 Excluir del commit

- `.agents/`.
- `.vscode/mcp.json.bak.20261020-222741`.
- Cualquier `.env`, credencial o archivo con secretos.
- `frontend/dist` y artefactos generados.
- Cambios accidentales en archivos de usuario o del sistema.

### 3.4 Verificación posterior al commit

```sh
git show --stat --oneline HEAD
git status --short
```

Criterio de aceptación: el commit contiene solo el producto y su documentación; el
árbol queda limpio salvo exclusiones deliberadas.

## 4. Fase 2 — Cierre visual y de accesibilidad

Ya se unificaron cabeceras, paneles, avatares, buscador, ajustes y autenticación. Para
cerrar esta fase:

1. Revisar en navegador real las pantallas con datos (no solo estados vacíos):
   amistades, grupos con miembros, notificaciones no leídas, tareas y proyectos.
2. Confirmar contraste de textos secundarios y estados `hover`/`focus` visibles.
3. Verificar navegación por teclado en formularios, modales y menú de cuenta.
4. Validar 320 px, 390 px, 768 px y 1440 px sin desbordamiento.
5. Repetir `npm test`, `npm run build` y la auditoría de consola.

Criterio de aceptación: sin errores de consola, sin desbordamiento horizontal, foco
visible y formularios utilizables solo con teclado.

## 5. Fase 3 — Discord (requiere decisión humana)

Antes de escribir código, responder:

1. ¿Inicio de sesión con Discord o vinculación de una cuenta ya existente?
2. ¿Notificaciones por webhook, bot en servidor o solo invitaciones?
3. ¿Qué datos se guardan: ID de Discord, nombre, avatar, servidor?
4. ¿Qué pasa al desvincular o revocar el acceso?

Implementación mínima si se elige OAuth de vinculación:

- migración con `discord_id` único y nullable, más tokens si se requieren;
- configuración `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
  `DISCORD_REDIRECT_URI` fuera de Git;
- endpoints para iniciar, callback, estado y desvincular;
- validación de `state` y revocación de tokens;
- pruebas de éxito, cancelación, ID duplicado y desvinculación;
- pantalla de ajustes con estado real, no un módulo “pendiente”.

Criterio de aceptación: el flujo se prueba contra una aplicación Discord de prueba y
no se almacenan secretos en el frontend.

## 6. Fase 4 — Figma (requiere material)

Si se aporta el archivo o capturas:

1. Extraer tokens de color, tipografía, espaciado y radios.
2. Comparar con `frontend/src/styles.css` y listar diferencias.
3. Implementar por componentes, no por página completa.
4. Validar contraste y tamaños táctiles antes de aceptar el diseño.
5. Mantener las clases existentes cuando el cambio sea solo cosmético.

Si no se aporta material, se conserva el sistema actual y se documenta como decisión
de producto, sin afirmar fidelidad a Figma.

## 7. Fase 5 — Despliegue público (requiere credenciales)

### 7.1 Decisiones previas

- Proveedor con Docker o buildpack compatible.
- Dominio y HTTPS.
- MariaDB persistente con backups y restauración probada.
- Gestor de secretos del proveedor.
- SMTP real si se usarán correos.
- Orígenes exactos para CORS si frontend y backend quedan separados.

### 7.2 Checklist de publicación

1. `APP_ENV=production`, `APP_DEBUG=false`, `APP_KEY` estable.
2. Credenciales únicas de base y secretos fuera del repositorio.
3. `CORS_ALLOWED_ORIGINS` y `APP_URL` con el dominio real.
4. Migraciones revisadas y aplicadas con respaldo previo.
5. Build de frontend con la URL real de API.
6. Health check, login, registro, amistades, grupos, proyectos, tareas y retos
   verificados contra la base de producción.
7. Backup y restauración de prueba en un entorno separado.
8. Monitoreo de errores y rotación de tokens.

Criterio de aceptación: una cuenta nueva completa el flujo principal en el dominio
público y un backup restaurado en un entorno limpio reproduce los datos.

## 8. Orden recomendado

1. Commit selectivo y verificación del árbol.
2. Revisión visual con datos reales y accesibilidad.
3. Decisión de Discord y, si aplica, implementación.
4. Decisión de Figma y, si aplica, adaptación visual.
5. Despliegue con credenciales y validación de producción.

## 9. Rollback

- Commit: revertir el commit con `git revert`, sin reescribir historia compartida.
- Migraciones: restaurar el backup previo; no usar `down` a ciegas en producción.
- Despliegue: conservar la imagen anterior y revertir el tráfico; no borrar el volumen.
- UI: los cambios son reversibles por archivo; mantener el commit como punto de
  restauración.

## 10. Definición de terminado

- El trabajo está versionado sin secretos ni herramientas locales.
- Las pruebas backend/frontend y el build pasan.
- Los flujos principales funcionan contra MariaDB.
- Discord y Figma tienen decisión explícita, implementados o documentados como fuera
  de alcance.
- El despliegue público tiene dominio, HTTPS, secretos gestionados, backups y health
  checks verificados.
