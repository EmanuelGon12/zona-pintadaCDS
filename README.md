# Zona Pintada

E-commerce de calzado de básquetbol. Catálogo con búsqueda, filtros por estilo de juego y orden, sección de
novedades, un selector que recomienda modelos según la posición y la superficie donde juegas, carrito, registro e
inicio de sesión con roles (`CUSTOMER` y `ADMIN`), checkout con Stripe en modo de prueba, historial de pedidos y un
panel de administración para gestionar productos e imágenes.

## Estructura

```
backend/    API REST (FastAPI + SQLAlchemy + SQLite)
frontend/   Aplicación web (JavaScript con módulos ES, sin paso de build)
```

El backend sirve también el frontend, así que alcanza con levantar un solo proceso.

## Requisitos

- Python 3.9 o superior
- Opcional: una base Postgres (por defecto se usa SQLite, sin instalar nada)

## Puesta en marcha

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed
uvicorn app.main:app --reload
```

Abrir <http://localhost:8000>. La documentación interactiva de la API está en <http://localhost:8000/docs>.

`python -m app.seed` es idempotente: crea el administrador y 12 modelos de ejemplo (11 activos y 1 oculto) solo si
todavía no existen. Las fotos del seed son de Unsplash y se referencian por URL; las imágenes que se suben desde
el panel de administración sí se guardan en el almacenamiento configurado.

Si usás otro puerto, ajustá `PUBLIC_BASE_URL` en `backend/.env`, porque se usa para armar las URLs de retorno del pago.

### Usuarios

| Rol        | Email                  | Contraseña   |
|------------|------------------------|--------------|
| `ADMIN`    | `admin@zonapintada.uy` | `admin12345` |
| `CUSTOMER` | se crea desde "Crear cuenta" | —      |

Las credenciales del administrador se cambian con `ADMIN_EMAIL` y `ADMIN_PASSWORD` antes de ejecutar el seed.

## Pagos

**Con Stripe (modo de prueba).** Definir en `backend/.env`:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

El checkout crea una sesión de Stripe Checkout. Al volver del pago, el pedido se confirma consultando la sesión a
Stripe, y además se procesa el webhook `checkout.session.completed` / `checkout.session.expired`. Para probarlo en
local:

```bash
stripe listen --forward-to localhost:8000/api/checkout/webhook
```

Tarjeta de prueba: `4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC.

**Sin Stripe.** Si `STRIPE_SECRET_KEY` está vacío, el checkout usa una pasarela simulada que replica el flujo
(redirección, pago aprobado, pago rechazado, cancelación) para poder correr el proyecto sin cuentas externas:

- `4242 4242 4242 4242` aprueba el pago.
- `4000 0000 0000 0002` lo rechaza.

## Almacenamiento de imágenes

Por defecto se guardan en `backend/data/media` y se sirven en `/media`. En la base de datos solo se guarda la clave
del objeto. Para usar S3 o un servicio compatible (por ejemplo MinIO):

```
STORAGE_BACKEND=s3
S3_BUCKET=zona-pintada-media
S3_ENDPOINT_URL=http://localhost:9000
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

Con S3 las imágenes se entregan por URLs firmadas temporales, por lo que el bucket puede ser privado.

Validaciones de subida: JPG, PNG o WebP, hasta 3 MB. El tipo se verifica por el contenido del archivo y no por la
extensión ni el `Content-Type` que declara el cliente.

## Despliegue en Vercel con Supabase

El backend corre en Vercel como función serverless (`api/index.py`) y el frontend se sirve como estático desde
`frontend/` (ver `vercel.json`). Como en serverless el disco no persiste, la base de datos y las imágenes viven en
Supabase.

**1. Base de datos.** En Supabase crea un proyecto y copia la cadena de conexión del *Transaction pooler*
(Connect → Transaction pooler, puerto 6543). Será tu `DATABASE_URL`.

**2. Imágenes.** En Storage crea un bucket público (por ejemplo `product-images`). Luego, en Project Settings →
Storage → S3 Connection, copia el endpoint y la región, y genera un par de claves de acceso.

**3. Cargar datos iniciales** (desde tu máquina, una sola vez):

```bash
cd backend
DATABASE_URL="postgresql://..." ADMIN_PASSWORD="una-clave-segura" python -m app.seed
```

**4. Vercel.** Importa el repositorio (la raíz del proyecto es la raíz del repo) y define estas variables de entorno:

```
DATABASE_URL=postgresql://...
JWT_SECRET=una-clave-larga-y-aleatoria
PUBLIC_BASE_URL=https://tu-proyecto.vercel.app
STORAGE_BACKEND=s3
S3_BUCKET=product-images
S3_ENDPOINT_URL=https://<ref>.storage.supabase.co/storage/v1/s3
S3_REGION=<la región de tu proyecto>
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=https://<ref>.supabase.co/storage/v1/object/public/product-images
```

Para pagar con Stripe agrega también `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`, y registra en Stripe el webhook
`https://tu-proyecto.vercel.app/api/checkout/webhook` con los eventos `checkout.session.completed` y
`checkout.session.expired`. Sin esas variables se usa la pasarela simulada.

Las tablas se crean solas en el primer arranque. La conexión usa el pooler de Supabase sin pool propio
(`NullPool`), que es lo recomendado para funciones serverless.

## Tests

```bash
cd backend
python -m pytest
```

Cubren autenticación y roles, catálogo y búsqueda, reglas del carrito, checkout (pago aprobado, rechazado,
cancelado), aislamiento de pedidos entre usuarios y validación de imágenes.

## Decisiones de diseño

- **El backend es la fuente de verdad.** El carrito vive en la base de datos y el frontend solo envía producto, talla
  y cantidad. Precios, subtotal, envío, total y stock se calculan y validan en el servidor, tanto en el carrito
  como al iniciar el checkout.
- **Dinero en centavos enteros** para evitar errores de redondeo.
- **Regla de envío:** US$ 9 fijos, gratis desde US$ 150 de subtotal (configurable).
- **Orden en dos pasos.** Al iniciar el checkout se crea una orden `PENDING` con una copia de los productos,
  cantidades y precios de ese momento. Al confirmarse el pago pasa a `PAID`, se descuenta el stock y se quitan
  del carrito los productos comprados. Si el pago se cancela o expira, queda `CANCELLED`. La confirmación es
  idempotente, así que el retorno del navegador y el webhook pueden llegar en cualquier orden.
- **Autorización por recurso.** Un usuario solo puede ver, pagar o cancelar sus propias órdenes y modificar su
  propio carrito; sobre el resto recibe `404`. Las rutas `/api/admin/*` exigen rol `ADMIN` en el servidor, más allá
  de lo que oculte el frontend.
- **Registro público solo crea `CUSTOMER`.** El rol no se acepta desde el cliente.
- **Sesión con JWT** guardado en `localStorage`. Cerrar sesión descarta el token del lado del cliente.
- **Búsqueda sin distinguir mayúsculas ni acentos** (`piv` encuentra "Pívot Pro"), mediante una clave de búsqueda
  normalizada que se mantiene sincronizada con el nombre.
- **Novedades.** Un producto se considera nuevo durante los 30 días posteriores a su alta. El backend informa
  `is_new` y el catálogo acepta `orden=nuevos|precio-asc|precio-desc` y `limite`.
- **Selector por estilo de juego.** Cada modelo tiene un estilo (`SPEED`, `ALL_AROUND`, `POWER`) y una superficie
  (`INDOOR`, `OUTDOOR`, `BOTH`). `GET /api/products/recommendations?estilo=…&superficie=…` devuelve hasta tres
  modelos con stock del estilo pedido, priorizando los aptos para esa superficie y luego el menor precio. La lógica
  vive en el backend para poder testearla y cambiarla sin tocar el frontend.
- **Pasarela detrás de una interfaz** (`PaymentGateway`) y almacenamiento detrás de otra (`ObjectStorage`), para
  poder cambiar de implementación sin tocar las rutas.

## Limitaciones conocidas

- Las tablas se crean al iniciar (`create_all`); no hay migraciones. Si cambia el modelo de datos en una base existente, hay que
  recrearla (en local alcanza con borrar `backend/data` y volver a correr el seed).
- El despliegue en Vercel con Supabase no se probó contra los servicios reales. La compatibilidad con Postgres sí se
  verificó ejecutando la suite de tests completa sobre una instancia local.
- El stock es por modelo, no por talla.
- La integración con Stripe real no pudo probarse de punta a punta en el desarrollo; sí está cubierto el flujo
  con la pasarela simulada.
