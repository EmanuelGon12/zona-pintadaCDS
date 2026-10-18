from datetime import timedelta

from sqlalchemy import select

from app.config import get_settings
from app.database import Base, SessionFactory, engine
from app.models import CourtSurface, PlayStyle, Product, Role, User, current_utc_time
from app.security import hash_password

STANDARD_SIZES = ["7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "12", "13"]


def photo(photo_id: str) -> str:
    return f"https://images.unsplash.com/photo-{photo_id}?auto=format&fit=crop&w=1000&h=700&q=80"


CATALOG = [
    dict(
        name="Zapatilla de básquetbol corte medio negra, blanca y roja",
        colorway="Negro / Blanco / Rojo",
        description="Corte medio de cuero sintético con cordones hasta el tobillo y suela de goma con tracción en espiga. Equilibrio entre libertad de movimiento y sujeción.",
        price_cents=15900,
        stock=14,
        play_style=PlayStyle.SPEED,
        surface=CourtSurface.BOTH,
        released_days_ago=120,
        photo_id="1552346154-21d32810aba3",
    ),
    dict(
        name="Zapatilla de básquetbol corte medio blanca y roja",
        colorway="Blanco / Rojo",
        description="Corte medio con espuma amortiguada en el talón y planta ancha para mayor estabilidad. Sirve tanto para cancha cubierta como para cemento.",
        price_cents=12900,
        stock=24,
        play_style=PlayStyle.ALL_AROUND,
        surface=CourtSurface.BOTH,
        released_days_ago=9,
        photo_id="1605523741177-cd660595c2cf",
    ),
    dict(
        name="Zapatilla de básquetbol corte alto negra con cordones naranjas",
        colorway="Negro / Naranja",
        description="Corte alto con ajuste de cordones y suela de agarre firme. Sujeta el tobillo en los frenos y los saltos.",
        price_cents=12400,
        stock=18,
        play_style=PlayStyle.POWER,
        surface=CourtSurface.INDOOR,
        released_days_ago=4,
        photo_id="1631984564919-1f6b2313a71c",
    ),
    dict(
        name="Zapatilla de básquetbol corte alto negra y blanca",
        colorway="Negro / Blanco",
        description="Corte alto acolchado con lengüeta reforzada y plantilla estabilizadora. La más firme para quienes juegan cerca del aro.",
        price_cents=14400,
        stock=12,
        play_style=PlayStyle.POWER,
        surface=CourtSurface.INDOOR,
        released_days_ago=150,
        photo_id="1595909336425-5bf541155dec",
    ),
    dict(
        name="Zapatilla de básquetbol de competición blanca y negra",
        colorway="Blanco / Negro / Rojo",
        description="Modelo de alto rendimiento con amortiguación de doble densidad y suela de caucho de alto agarre para parqué.",
        price_cents=18900,
        stock=9,
        play_style=PlayStyle.ALL_AROUND,
        surface=CourtSurface.INDOOR,
        released_days_ago=2,
        photo_id="1533681018184-68bd1d883b97",
    ),
    dict(
        name="Zapatilla de básquetbol corte bajo gris y blanca",
        colorway="Gris / Blanco / Dorado",
        description="Perfil bajo y liviano para máxima libertad de movimiento. Ideal para bases y escoltas que priorizan la velocidad.",
        price_cents=13900,
        stock=20,
        play_style=PlayStyle.SPEED,
        surface=CourtSurface.INDOOR,
        released_days_ago=60,
        photo_id="1542219550-37153d387c27",
    ),
    dict(
        name="Zapatilla de básquetbol corte alto blanca",
        colorway="Blanco",
        description="Corte alto clásico con cierre de cordones y tira de ajuste en el tobillo. Un par versátil para entrenar y jugar todos los días.",
        price_cents=11900,
        stock=31,
        play_style=PlayStyle.POWER,
        surface=CourtSurface.BOTH,
        released_days_ago=200,
        photo_id="1512374382149-233c42b6a83b",
    ),
    dict(
        name="Zapatilla de básquetbol corte alto celeste y blanca",
        colorway="Celeste / Blanco",
        description="Corte alto con refuerzos en la puntera y el talón, y espuma amortiguadora en el antepié. Resiste el uso intensivo en cemento.",
        price_cents=12900,
        stock=16,
        play_style=PlayStyle.POWER,
        surface=CourtSurface.OUTDOOR,
        released_days_ago=14,
        photo_id="1588099768550-4014589e03e0",
    ),
    dict(
        name="Zapatilla de básquetbol corte alto negra",
        colorway="Negro / Blanco",
        description="Corte alto con malla respirable y suela con dibujo multidireccional para frenar y arrancar sin resbalar.",
        price_cents=13400,
        stock=15,
        play_style=PlayStyle.ALL_AROUND,
        surface=CourtSurface.OUTDOOR,
        released_days_ago=90,
        photo_id="1605348532760-6753d2c43329",
    ),
    dict(
        name="Zapatilla de básquetbol corte medio negra y naranja",
        colorway="Negro / Naranja",
        description="Corte medio con cuello acolchado y suela de goma resistente. Cómoda desde el primer partido, sin período de adaptación.",
        price_cents=8900,
        stock=27,
        play_style=PlayStyle.SPEED,
        surface=CourtSurface.OUTDOOR,
        released_days_ago=75,
        photo_id="1595909236612-9fd30b476365",
    ),
    dict(
        name="Zapatilla de básquetbol corte alto blanca y negra",
        colorway="Blanco / Negro",
        description="Corte alto con plantilla acolchada y laterales reforzados. Buena opción para empezar a jugar con soporte de tobillo.",
        price_cents=7900,
        stock=40,
        play_style=PlayStyle.ALL_AROUND,
        surface=CourtSurface.BOTH,
        released_days_ago=240,
        photo_id="1518894781321-630e638d0742",
    ),
    dict(
        name="Zapatilla de básquetbol corte alto gris claro y blanca (última serie)",
        colorway="Gris claro / Blanco",
        description="Último par de la colección anterior, sin reposición.",
        price_cents=7400,
        stock=0,
        play_style=PlayStyle.ALL_AROUND,
        surface=CourtSurface.BOTH,
        released_days_ago=400,
        photo_id="1699901232384-f1646fb2a8da",
        is_active=False,
    ),
]


def ensure_administrator(database) -> None:
    settings = get_settings()
    email = settings.admin_email.lower()
    if database.scalar(select(User).where(User.email == email)):
        return
    database.add(
        User(
            email=email,
            full_name=settings.admin_full_name,
            password_hash=hash_password(settings.admin_password),
            role=Role.ADMIN,
        )
    )


def ensure_catalog(database) -> None:
    if database.scalar(select(Product.id).limit(1)) is not None:
        return
    now = current_utc_time()
    for entry in CATALOG:
        released_at = now - timedelta(days=entry["released_days_ago"])
        database.add(
            Product(
                name=entry["name"],
                colorway=entry["colorway"],
                description=entry["description"],
                price_cents=entry["price_cents"],
                stock=entry["stock"],
                available_sizes=STANDARD_SIZES,
                image_key=photo(entry["photo_id"]),
                play_style=entry["play_style"],
                surface=entry["surface"],
                created_at=released_at,
                updated_at=released_at,
                is_active=entry.get("is_active", True),
            )
        )


def run() -> None:
    Base.metadata.create_all(engine)
    with SessionFactory() as database:
        ensure_administrator(database)
        ensure_catalog(database)
        database.commit()


if __name__ == "__main__":
    run()
