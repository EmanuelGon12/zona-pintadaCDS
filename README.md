# Zona Pintada

E-commerce de calzado de básquetbol. Catálogo con búsqueda, filtros por estilo de juego y orden, sección de
novedades, un selector que recomienda modelos según la posición y la superficie donde juegas, carrito, registro e
inicio de sesión con roles (`CUSTOMER` y `ADMIN`), checkout con Mercado Pago en modo de prueba, historial de pedidos y un
panel de administración para gestionar productos e imágenes.

## Estructura

```
backend/    API REST (FastAPI + SQLAlchemy, SQLite en local o Postgres)
frontend/   Aplicación web (React + TypeScript + Vite, React Router)
api/        Punto de entrada del backend como función serverless en Vercel
```

### Frontend

```
src/api/         Cliente HTTP tipado y tipos de la API
src/context/     Sesión, contador del carrito y avisos (React Context)
src/components/  Encabezado, tarjetas de producto, selector por estilo, protección de rutas
src/pages/       Una página por pantalla (catálogo, producto, carrito, pedidos, admin, etc.)
src/hooks/       Carga de datos (`useCargarDatos`) y cierre de sesión
src/lib/         Formatos de precio y fecha, estilos de juego, armado de URLs del catálogo
```

Las rutas protegidas (`/carrito`, `/pedidos`, `/admin`) redirigen al login y vuelven a la página original después de
ingresar. El control de permisos real está en el backend; el frontend solo evita mostrar pantallas que no
corresponden.

## Requisitos

- Python 3.9 o superior
- Node.js 20 o superior
- Opcional: una base Postgres (por defecto se usa SQLite, sin instalar nada)

## Puesta en marcha

**Backend**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head        # crea las tablas
python -m app.seed
uvicorn app.main:app --reload
```

**Frontend**, en otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abrir <http://localhost:5173>. Vite redirige `/api` y `/media` al backend en el puerto 8000 (se cambia con la
variable `BACKEND_URL`). La documentación interactiva de la API está en <http://localhost:8000/docs>.

Para probar la versión compilada con un solo proceso, ejecutar `npm run build` en `frontend/`: el backend sirve
`frontend/dist` y responde con la aplicación en cualquier ruta que no sea de la API.

`python -m app.seed` se puede correr varias veces: crea el administrador y 12 modelos de ejemplo (11 activos y 1
oculto) solo si todavía no existen, y después descarga las fotos de ejemplo (Unsplash) y las sube al almacenamiento
configurado, guardando en la base solo la clave del archivo. Si una foto no se puede descargar, queda la URL original
y se reintenta en la próxima corrida.

`PUBLIC_BASE_URL` en `backend/.env` debe apuntar a la dirección donde se abre la tienda, porque se usa para armar las
URLs de retorno de Mercado Pago.

### Usuarios

| Rol        | Email                  | Contraseña   |
|------------|------------------------|--------------|
| `ADMIN`    | `admin@zonapintada.uy` | `admin12345` |
| `CUSTOMER` | se crea desde "Crear cuenta" | —      |

Las credenciales del administrador se cambian con `ADMIN_EMAIL` y `ADMIN_PASSWORD` antes de ejecutar el seed.

## Pagos

La tienda cobra en pesos uruguayos. Hay dos pasarelas detrás de la misma interfaz (`PaymentGateway`):

**Mercado Pago (modo de prueba).** Es la que usa el despliegue. El enunciado pide Stripe o un servicio equivalente,
y Stripe no admite cuentas de Uruguay. En `backend/.env`:

```
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...      # credenciales de prueba de la aplicación
MERCADOPAGO_WEBHOOK_SECRET=...            # opcional, para validar la firma de las notificaciones
```

El checkout crea una preferencia de Checkout Pro con los productos y el envío calculados en el backend, y usa el id de
la orden como `external_reference`. Al volver del pago, la orden se confirma buscando en Mercado Pago un pago aprobado
con esa referencia. Con una URL pública (`https://`) además se activan la vuelta automática a la tienda y las
notificaciones en `/api/checkout/webhook/mercadopago`. El webhook no confía en el contenido recibido: con el id del pago
lo consulta a la API de Mercado Pago antes de marcar la orden como pagada.

Para probar hay que crear un comprador de prueba en *Tus integraciones → Cuentas de prueba*, pagar con él en una
ventana de incógnito y usar una tarjeta de prueba con titular `APRO` (aprobado) u `OTHE` (rechazado).

**Simulador.** Sin token, el checkout usa una pasarela simulada con el mismo flujo, para poder correr el proyecto sin
cuentas externas:

- `4242 4242 4242 4242` aprueba el pago.
- `4000 0000 0000 0002` lo rechaza.

Para sumar otra pasarela alcanza con una clase nueva que implemente `abrir_sesion` y `esta_pagada`.

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

El backend corre en Vercel como función serverless (`api/index.py`) y el frontend se compila en cada despliegue y se
sirve como estático desde `frontend/dist` (ver `vercel.json`). Como en serverless el disco no persiste, la base de datos y las imágenes viven en
Supabase.

**1. Base de datos.** En Supabase crea un proyecto y copia la cadena de conexión del *Transaction pooler*
(Connect → Transaction pooler, puerto 6543). Será tu `DATABASE_URL`.

**2. Imágenes.** En Storage crea un bucket público (por ejemplo `product-images`). Luego, en Project Settings →
Storage → S3 Connection, copia el endpoint y la región, y genera un par de claves de acceso.

**3. Crear las tablas** (desde tu máquina, con la cadena de conexión de Supabase):

```bash
cd backend
DATABASE_URL='postgresql://...' alembic upgrade head
```

Si la base ya existía de antes de usar migraciones (tablas creadas por la app), primero hay que marcar el esquema
inicial como aplicado y recién ahí subir: `alembic stamp 0001` y después `alembic upgrade head`.

**4. Cargar datos iniciales.** Hay que pasarle también las variables de S3 para que las fotos de ejemplo se suban al
bucket:

```bash
cd backend
DATABASE_URL='postgresql://...' ADMIN_PASSWORD='una-clave-segura' STORAGE_BACKEND=s3 S3_BUCKET=product-images \
S3_ENDPOINT_URL='https://<ref>.storage.supabase.co/storage/v1/s3' S3_REGION='<región>' \
S3_ACCESS_KEY_ID='...' S3_SECRET_ACCESS_KEY='...' \
S3_PUBLIC_BASE_URL='https://<ref>.supabase.co/storage/v1/object/public/product-images' python -m app.seed
```

**5. Vercel.** Importa el repositorio (la raíz del proyecto es la raíz del repo) y define estas variables de entorno:

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

Para cobrar con Mercado Pago agrega `MERCADOPAGO_ACCESS_TOKEN` (y opcionalmente `MERCADOPAGO_WEBHOOK_SECRET`). Sin
token de pago se usa la pasarela simulada.

La conexión usa el pooler de Supabase sin pool propio (`NullPool`), que es lo recomendado para funciones serverless.
`GET /api/health` responde `{"estado": "ok"}` si la API y la base están funcionando, útil para un monitor.

### Migraciones

El esquema lo manejan las migraciones de Alembic (`backend/migrations`), no la app. Para cambiar el modelo de datos:

```bash
cd backend
alembic revision --autogenerate -m "que cambio"   # revisar el archivo generado antes de aplicarlo
alembic upgrade head
```

CI verifica que las migraciones generen exactamente el esquema de los modelos (`alembic check`).

## Tests

```bash
cd backend && ruff check app tests && python -m pytest --cov=app
cd frontend && npm run lint && npm test            # o npm run test:coverage
```

En cada push GitHub Actions corre los linters (Ruff y ESLint), verifica las migraciones, corre las dos suites
(backend con Python 3.9 y 3.12) y compila el frontend
(`.github/workflows/tests.yml`).

**Backend** (pytest, ~96 % de cobertura). Los tests usan una base SQLite temporal y no salen a internet: las
pasarelas, S3 y las descargas se reemplazan por dobles.

- Autenticación: registro, login, tokens vencidos, adulterados o de usuarios borrados, mensajes que no revelan si un
  email existe, todas las rutas privadas piden login y todas las del admin piden rol `ADMIN`.
- Validaciones con mensajes en español (campos vacíos o con espacios, contraseñas largas con tildes, JSON roto,
  parámetros inválidos).
- Catálogo: productos ocultos, búsqueda sin tildes y sin comodines, filtros, orden, novedades y recomendaciones.
- Carrito y precios: reglas de envío en los bordes, límites de cantidad, tallas inexistentes, carrito ajeno.
- Stock: reserva al iniciar el pago, la última unidad no se vende dos veces, devolución al cancelar o vencer la
  reserva, pago que llega tarde.
- Checkout y órdenes: precio del momento, pago aprobado, rechazado, duplicado o abandonado, fallas de la pasarela,
  cada usuario ve solo sus órdenes.
- Integraciones: preferencia de Mercado Pago, búsqueda del pago, webhook con y sin firma; sesión y webhook de
  S3 con bucket público y privado; seed que sube las fotos y se puede repetir.

**Frontend** (Vitest + Testing Library, ~80 % de cobertura). Se prueba lo que ve y hace el usuario, con la API
simulada: cliente HTTP (token, errores, sesión vencida), protección de rutas, login y registro, ficha de producto,
carrito, pasarela simulada, vuelta del pago, catálogo con filtros en la URL, selector por estilo de juego, encabezado
y formulario del admin.

## Decisiones de diseño

- **El backend es la fuente de verdad.** El carrito vive en la base de datos y el frontend solo envía producto, talla
  y cantidad. Precios, subtotal, envío, total y stock se calculan y validan en el servidor, tanto en el carrito
  como al iniciar el checkout.
- **Dinero en centavos enteros** para evitar errores de redondeo.
- **Regla de envío:** $ 290 fijos, gratis desde $ 6.000 de subtotal (configurable).
- **Orden en dos pasos.** Al iniciar el checkout se crea una orden `PENDING` con una copia de los productos,
  cantidades y precios de ese momento. Al confirmarse el pago pasa a `PAID`, se descuenta el stock y se quitan
  del carrito los productos comprados. Si el pago se cancela o expira, queda `CANCELLED`. La confirmación es
  idempotente, así que el retorno del navegador y el webhook pueden llegar en cualquier orden.
- **Autorización por recurso.** Un usuario solo puede ver, pagar o cancelar sus propias órdenes y modificar su
  propio carrito; sobre el resto recibe `404`. Las rutas `/api/admin/*` exigen rol `ADMIN` en el servidor, más allá
  de lo que oculte el frontend.
- **Registro público solo crea `CUSTOMER`.** El rol no se acepta desde el cliente.
- **Sesión en cookie `HttpOnly`.** El JWT viaja en una cookie que JavaScript no puede leer (así un XSS no puede
  robarla), con `SameSite=Lax` contra CSRF y `Secure` en producción. El frontend solo guarda nombre y rol para mostrar
  la interfaz, y al cargar confirma la sesión con `/api/auth/me`. `POST /api/auth/logout` borra la cookie. Para
  clientes que no son el navegador, la API también acepta `Authorization: Bearer`.
- **Límite de intentos de login.** Con 5 intentos fallidos para un mismo email en 15 minutos, el login responde `429`
  hasta que pase la ventana. Los intentos se guardan en la base porque en serverless no hay memoria compartida.
- **Contraseñas** con bcrypt; los mensajes de login no revelan si un email está registrado.
- **Calidad.** Dependencias con versiones fijas, Ruff y ESLint en CI, logs de los errores de pago y de los webhooks
  (sin datos sensibles), y una captura de errores en React para que un fallo de una pantalla no deje la página en
  blanco.
- **URLs limpias** con React Router (`/modelos?estilo=SPEED&orden=precio-asc`): los filtros del catálogo viven en la
  URL, así que se pueden compartir y el botón de volver del navegador funciona como se espera.
- **Búsqueda sin distinguir mayúsculas ni acentos** (`competicion` encuentra "Zapatilla de básquetbol de competición"), mediante una clave de búsqueda
  normalizada que se mantiene sincronizada con el nombre.
- **Novedades.** Un producto se considera nuevo durante los 30 días posteriores a su alta. El backend informa
  `is_new` y el catálogo acepta `orden=nuevos|precio-asc|precio-desc` y `limite`.
- **Selector por estilo de juego.** Cada modelo tiene un estilo (`SPEED`, `ALL_AROUND`, `POWER`) y una superficie
  (`INDOOR`, `OUTDOOR`, `BOTH`). `GET /api/products/recommendations?estilo=…&superficie=…` devuelve hasta tres
  modelos con stock del estilo pedido, priorizando los aptos para esa superficie y luego el menor precio. La lógica
  vive en el backend para poder testearla y cambiarla sin tocar el frontend.
- **Reserva de stock.** Al iniciar el pago el stock se descuenta con un `UPDATE … WHERE stock >= cantidad`, que es
  atómico: si dos personas compran la última unidad a la vez, solo una lo logra. La reserva dura 30 minutos
  (`RESERVATION_MINUTES`); si el pago se cancela o vence, el stock vuelve. Las preferencias de Mercado Pago vencen junto
  con la reserva. Si igual llega un pago aprobado tarde, la orden se marca pagada.
- **Pasarela detrás de una interfaz** (`PaymentGateway`) y almacenamiento detrás de otra (`ObjectStorage`), para
  poder cambiar de implementación sin tocar las rutas.

## Limitaciones conocidas

- El stock es por modelo, no por talla.
- El bloqueo de login es por email: frena la fuerza bruta contra una cuenta, pero no a alguien que pruebe la misma
  contraseña contra muchos emails. Para eso habría que sumar un límite por IP.
- Las reservas vencidas se liberan cuando alguien agrega al carrito o inicia un pago, no con una tarea programada.
- La integración con Mercado Pago se probó de punta a punta en modo de prueba, en local y en Vercel.
