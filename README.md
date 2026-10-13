# CRM Comercial

CRM comercial personal (DocuWare, demos, presupuestos, captación). React + TypeScript + Vite + Firebase (Auth + Firestore).

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5190
npm run build    # comprobación de tipos + build de producción en dist/
```

La configuración web de Firebase está en `src/config/firebase.config.ts`.
Las reglas de seguridad están en `firestore.rules` (publicarlas en Firebase Console > Firestore > Reglas).

## Pruebas locales (sin tocar datos reales)

Requiere Java 21 (emuladores de Firebase).

```bash
npm run emulators            # Auth + Firestore locales (proyecto demo-crm)
sh scripts/seed-emulator.sh  # crea el usuario de pruebas local
npm run dev:emu              # app en http://127.0.0.1:5190 contra los emuladores
```

## Despliegue

Cada push a `main` compila y publica en GitHub Pages (`.github/workflows/deploy.yml`).

## Estructura

```
src/
  app/         router y navegación (fuente única de secciones)
  auth/        sesión, login, rutas protegidas
  components/  componentes de UI reutilizables
  config/      configuración de Firebase
  layout/      shell: menú lateral y barra superior
  lib/         inicialización de Firebase
  pages/       pantallas
  services/    acceso a datos (Firestore)
  styles/      tokens de diseño (claro/oscuro) y estilos
  theme/       tema claro/oscuro
  types/       modelo de datos
```

## Modelo de datos (multi-tenant)

```
users/{uid}                      perfil + preferencias + defaultOrgId
orgs/{orgId}                     organización (hoy orgId = uid) + settings
orgs/{orgId}/members/{uid}       rol: owner | admin | member
orgs/{orgId}/companies|contacts|leads|opportunities|activities|services|tags|customFields|imports
```

- Borrado lógico (`deleted: true`) y `updatedAt` en todos los documentos: permiten la
  sincronización incremental (`src/services/sync.ts`), que solo descarga lo que ha cambiado.
- Datos de demostración marcados con `isDemo` y etiqueta "Demo" (se borran desde Configuración › Datos).
- Cada importación guarda su lote (`importBatch`) y puede deshacerse.
