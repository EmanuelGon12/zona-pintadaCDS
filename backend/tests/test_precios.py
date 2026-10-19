import pytest

from app.config import Settings
from app.services.pricing import calcular_totales

CONFIG = Settings(free_shipping_threshold_cents=600000, flat_shipping_cents=29000)


@pytest.mark.parametrize(
    "lineas, subtotal, envio",
    [
        ([], 0, 0),
        ([(100000, 1)], 100000, 29000),
        ([(599999, 1)], 599999, 29000),
        ([(600000, 1)], 600000, 0),
        ([(200000, 3)], 600000, 0),
        ([(150000, 2), (100000, 1)], 400000, 29000),
    ],
)
def test_reglas_de_envio(lineas, subtotal, envio):
    totales = calcular_totales(lineas, CONFIG)
    assert (totales.subtotal_cents, totales.shipping_cents, totales.total_cents) == (subtotal, envio, subtotal + envio)
