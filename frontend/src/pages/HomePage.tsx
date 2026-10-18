import { Link } from "react-router-dom";
import { api } from "../api/client";
import { ProductCard } from "../components/ProductCard";
import { StyleFinder } from "../components/StyleFinder";
import { useAsync } from "../hooks/useAsync";

const HERO_IMAGE = "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=2000&q=80";
const NEW_ARRIVALS_ON_HOME = 4;

const SERVICES = [
  { title: "Envío en 24 a 72 h", text: "Gratis en compras desde USD 150. Despachamos de lunes a viernes." },
  { title: "Cambios sin costo", text: "Si la talla no te queda, tienes 30 días para cambiarla." },
  { title: "Pago seguro", text: "Tarjeta de crédito o débito. No guardamos los datos de tu tarjeta." },
];

function Hero() {
  return (
    <section className="hero" style={{ backgroundImage: `url('${HERO_IMAGE}')` }}>
      <div className="wrapper hero__content">
        <p className="hero__eyebrow">Temporada 2026</p>
        <h1 className="hero__title">Zapatillas para jugar, no para mirar.</h1>
        <p className="hero__lead">
          Modelos de básquetbol para cancha cubierta y exterior, elegidos por posición. Envío a todo el país y cambios dentro de
          30 días.
        </p>
        <div className="hero__actions">
          <Link className="button button--inverted" to="/novedades">
            Ver novedades
          </Link>
          <Link className="button button--ghost" to="/estilo-de-juego">
            Encuentra tu zapatilla
          </Link>
        </div>
      </div>
    </section>
  );
}

function NewArrivals() {
  const { data: newest } = useAsync(() => api.listProducts({ order: "nuevos", limit: 8 }), []);
  if (!newest || newest.length === 0) return null;

  const arrivals = newest.filter((product) => product.is_new);
  const featured = (arrivals.length ? arrivals : newest).slice(0, NEW_ARRIVALS_ON_HOME);

  return (
    <section className="wrapper section">
      <div className="section-heading">
        <div>
          <h2 className="section-heading__title">Novedades</h2>
          <p className="section-heading__lead">Lo último que llegó a la tienda.</p>
        </div>
        <Link className="text-link" to="/novedades">
          Ver todas
        </Link>
      </div>
      <div className="rail">
        {featured.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

export function FinderSection({ asPage = false }: { asPage?: boolean }) {
  const Heading = asPage ? "h1" : "h2";
  return (
    <section className="finder-band" id="estilo">
      <div className="wrapper">
        <div className="finder-band__intro">
          <Heading className="finder-band__title">Encuentra tu zapatilla</Heading>
          <p>No todos juegan igual. Cuéntanos tu posición y dónde juegas, y te mostramos los modelos que mejor se adaptan.</p>
        </div>
        <StyleFinder />
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <Hero />
      <NewArrivals />
      <FinderSection />
      <section className="wrapper services">
        {SERVICES.map((service) => (
          <div key={service.title} className="services__item">
            <h3>{service.title}</h3>
            <p>{service.text}</p>
          </div>
        ))}
      </section>
    </>
  );
}

export function StyleFinderPage() {
  return (
    <div className="finder-page">
      <FinderSection asPage />
    </div>
  );
}
