from logging.config import fileConfig

from alembic import context

from app import models
from app.config import obtener_config
from app.database import engine, normalizar_url_base

# la url sale de la misma config que la app (DATABASE_URL o backend/.env), no del alembic.ini
if context.config.config_file_name:
    fileConfig(context.config.config_file_name)

target_metadata = models.Base.metadata


def migrar_sin_conexion():
    context.configure(
        url=normalizar_url_base(obtener_config().database_url),
        target_metadata=target_metadata,
        literal_binds=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def migrar():
    # reuso el engine de la app, que ya tiene la config para el pooler de supabase
    with engine.connect() as conexion:
        # render_as_batch porque sqlite no soporta ALTER TABLE completo
        context.configure(connection=conexion, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    migrar_sin_conexion()
else:
    migrar()
