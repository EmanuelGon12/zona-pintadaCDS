from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import obtener_config
from app.database import Base, engine
from app.routers import administration, authentication, cart, catalog, checkout, orders

FIELD_LABELS = {
    "email": "Email",
    "full_name": "Nombre",
    "password": "Contraseña",
    "name": "Nombre",
    "price_cents": "Precio",
    "stock": "Stock",
    "available_sizes": "Tallas",
    "quantity": "Cantidad",
}


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
    Base.metadata.create_all(engine)
    application = FastAPI(title="Zona Pintada API", version="1.0.0")

    @application.exception_handler(RequestValidationError)
    async def explicar_error_validacion(_request: Request, error: RequestValidationError):
        # pydantic devuelve una lista enorme, me quedo con el primer error y lo armo legible
        first_error = error.errors()[0]
        field_name = str(first_error["loc"][-1])
        label = FIELD_LABELS.get(field_name, field_name)
        return JSONResponse(
            status_code=422,
            content={"detail": f"{label}: {first_error['msg']}"},
        )

    for module in (authentication, catalog, cart, checkout, orders, administration):
        application.include_router(module.router)

    if settings.storage_backend == "local":
        settings.media_directory.mkdir(parents=True, exist_ok=True)
        application.mount("/media", StaticFiles(directory=settings.media_directory), name="media")

    if settings.frontend_directory.is_dir():
        application.mount("/", SinglePageApplication(directory=settings.frontend_directory, html=True), name="frontend")

    return application


app = crear_aplicacion()
