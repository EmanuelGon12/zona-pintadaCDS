import logging

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import obtener_config
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import obtener_sesion_db
from app.routers import administration, authentication, cart, catalog, checkout, orders

CLAVE_JWT_POR_DEFECTO = "cambiar-esta-clave-en-produccion"

FIELD_LABELS = {
    "email": "Email",
    "full_name": "Nombre",
    "password": "Contraseña",
    "name": "Nombre",
    "colorway": "Color",
    "description": "Descripción",
    "price_cents": "Precio",
    "stock": "Stock",
    "available_sizes": "Tallas",
    "play_style": "Estilo de juego",
    "estilo": "Estilo de juego",
    "surface": "Superficie",
    "superficie": "Superficie",
    "quantity": "Cantidad",
    "size": "Talla",
    "product_id": "Producto",
    "order_id": "Pedido",
    "item_id": "Producto",
    "card_number": "Número de tarjeta",
    "image": "Imagen",
    "orden": "Orden",
    "limite": "Límite",
    "q": "Búsqueda",
}

# pydantic responde en ingles, esto lo pasa a algo que se pueda mostrar en la tienda
MENSAJES_POR_TIPO = {
    "missing": "es obligatorio",
    "string_too_short": "debe tener al menos {min_length} caracteres",
    "string_too_long": "puede tener hasta {max_length} caracteres",
    "too_short": "debe tener al menos {min_length} elemento(s)",
    "too_long": "puede tener hasta {max_length} elementos",
    "greater_than": "debe ser mayor que {gt}",
    "greater_than_equal": "debe ser mayor o igual a {ge}",
    "less_than": "debe ser menor que {lt}",
    "less_than_equal": "debe ser menor o igual a {le}",
    "int_parsing": "debe ser un número entero",
    "int_type": "debe ser un número entero",
    "int_from_float": "debe ser un número entero",
    "string_type": "debe ser un texto",
    "bool_parsing": "debe ser verdadero o falso",
    "bool_type": "debe ser verdadero o falso",
    "enum": "no es una opción válida",
    "list_type": "debe ser una lista",
}


def traducir_error(error: dict) -> str:
    if error["type"] == "json_invalid":
        return "Los datos enviados no son un JSON válido."
    campo = str(error["loc"][-1])
    etiqueta = FIELD_LABELS.get(campo, campo)
    if campo == "email" and error["type"] == "value_error":
        return "Email: no es una dirección válida."
    if error["type"] == "value_error":
        # nuestros propios validadores, el mensaje viene como "Value error, <mensaje>"
        mensaje = str(error.get("ctx", {}).get("error") or error["msg"])
    else:
        plantilla = MENSAJES_POR_TIPO.get(error["type"])
        mensaje = plantilla.format(**error.get("ctx", {})) if plantilla else "no es válido"
    return f"{etiqueta}: {mensaje}"


# sirve el build de react. Si la ruta no es un archivo (ej /modelos) devuelve el index.html
# para que react router se encargue. Solo se usa en local, en vercel lo resuelve vercel.json
class SinglePageApplication(StaticFiles):
    async def get_response(self, path, scope):
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as error:
            if error.status_code != 404 or path.startswith("api/"):
                raise
            response = await super().get_response("index.html", scope)
        response.headers["Cache-Control"] = "no-cache"
        return response


def crear_aplicacion() -> FastAPI:
    settings = obtener_config()
    # en produccion (https) no arrancamos con la clave de ejemplo, cualquiera podria firmar tokens de admin
    if settings.public_base_url.startswith("https://") and settings.jwt_secret == CLAVE_JWT_POR_DEFECTO:
        raise RuntimeError("Falta configurar JWT_SECRET para producción")

    # el esquema de la base lo manejan las migraciones de alembic (alembic upgrade head), no la app
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    application = FastAPI(title="Zona Pintada API", version="1.0.0")

    @application.get("/api/health", tags=["Salud"])
    def salud(database: Session = Depends(obtener_sesion_db)):
        # sirve para monitoreo: si la base no responde esto da 500
        database.execute(text("SELECT 1"))
        return {"estado": "ok"}

    @application.middleware("http")
    async def cabeceras_de_seguridad(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        return response

    @application.exception_handler(RequestValidationError)
    async def explicar_error_validacion(_request: Request, error: RequestValidationError):
        # pydantic devuelve una lista enorme, me quedo con el primer error y lo armo legible
        return JSONResponse(status_code=422, content={"detail": traducir_error(error.errors()[0])})

    for module in (authentication, catalog, cart, checkout, orders, administration):
        application.include_router(module.router)

    if settings.storage_backend == "local":
        settings.media_directory.mkdir(parents=True, exist_ok=True)
        application.mount("/media", StaticFiles(directory=settings.media_directory), name="media")

    if settings.frontend_directory.is_dir():
        application.mount("/", SinglePageApplication(directory=settings.frontend_directory, html=True), name="frontend")

    return application


app = crear_aplicacion()
