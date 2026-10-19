import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/cliente";
import type { CourtSurface, PlayStyle, Product, ProductInput } from "../../api/tipos";
import { EstadoError, Cargando } from "../../components/EstadosDePagina";
import { useAvisos } from "../../context/ContextoAvisos";
import { useCargarDatos } from "../../hooks/useCargarDatos";
import { centavosATexto, pesosACentavos } from "../../lib/formato";
import { PLAY_STYLES, PLAY_STYLE_KEYS, SURFACES, SURFACE_KEYS } from "../../lib/estilosDeJuego";

// tallas US del 5 al 13 de a medio punto
const SIZE_CHOICES = Array.from({ length: 17 }, (_unused, index) => String(5 + index * 0.5));
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAXIMUM_IMAGE_BYTES = 3 * 1024 * 1024;
const DEFAULT_SIZES = ["8", "9", "10", "11"];

interface ProductFormValues {
  name: string;
  colorway: string;
  description: string;
  price: string;
  stock: string;
  availableSizes: string[];
  playStyle: PlayStyle;
  surface: CourtSurface;
  isActive: boolean;
}

function valoresIniciales(product: Product | null): ProductFormValues {
  return {
    name: product?.name ?? "",
    colorway: product?.colorway ?? "",
    description: product?.description ?? "",
    price: product ? centavosATexto(product.price_cents) : "",
    stock: String(product?.stock ?? 0),
    availableSizes: product?.available_sizes ?? DEFAULT_SIZES,
    playStyle: product?.play_style ?? "ALL_AROUND",
    surface: product?.surface ?? "BOTH",
    isActive: product?.is_active ?? true,
  };
}

// el backend vuelve a validar igual, esto es para avisar antes de subir
function problemaDeImagen(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "La imagen debe ser JPG, PNG o WebP.";
  if (file.size > MAXIMUM_IMAGE_BYTES) return "La imagen no puede pesar más de 3 MB.";
  return null;
}

function armarProducto(values: ProductFormValues): ProductInput | string {
  const priceCents = pesosACentavos(values.price);
  if (priceCents === null || priceCents === 0) return "Ingresa un precio válido, por ejemplo 5190.";
  if (values.availableSizes.length === 0) return "Elige al menos una talla.";
  return {
    name: values.name,
    colorway: values.colorway,
    description: values.description,
    price_cents: priceCents,
    stock: Number(values.stock),
    available_sizes: SIZE_CHOICES.filter((size) => values.availableSizes.includes(size)),
    play_style: values.playStyle,
    surface: values.surface,
    is_active: values.isActive,
  };
}

function Campo({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field-group">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

function FormularioProducto({ product }: { product: Product | null }) {
  const navigate = useNavigate();
  const mostrarAviso = useAvisos();
  const [values, setValues] = useState(() => valoresIniciales(product));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(product?.image_url ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!imageFile) return;
    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl); // liberar la preview vieja
  }, [imageFile]);

  function actualizarCampo<Key extends keyof ProductFormValues>(key: Key, value: ProductFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function alternarTalla(size: string) {
    actualizarCampo(
      "availableSizes",
      values.availableSizes.includes(size) ? values.availableSizes.filter((selected) => selected !== size) : [...values.availableSizes, size]
    );
  }

  function elegirImagen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const problem = problemaDeImagen(file);
    if (problem) {
      event.target.value = "";
      setErrorMessage(problem);
      return;
    }
    setErrorMessage(null);
    setImageFile(file);
  }

  async function guardar(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    const payload = armarProducto(values);
    if (typeof payload === "string") {
      setErrorMessage(payload);
      return;
    }

    setIsSaving(true);
    try {
      const saved = product ? await api.actualizarProducto(product.id, payload) : await api.crearProducto(payload);
      // la imagen va aparte porque el producto tiene que existir antes
      if (imageFile) await api.subirImagen(saved.id, imageFile);
      mostrarAviso(product ? "Cambios guardados." : "Producto creado.");
      navigate("/admin");
    } catch (error) {
      setErrorMessage((error as Error).message);
      setIsSaving(false);
    }
  }

  return (
    <form className="form admin-form" onSubmit={guardar} noValidate>
      <div className="admin-form__columns">
        <div className="admin-form__main">
          <Campo label="Nombre" htmlFor="name">
            <input className="input" id="name" required maxLength={120} value={values.name} onChange={(event) => actualizarCampo("name", event.target.value)} />
          </Campo>
          <Campo label="Color" htmlFor="colorway" hint="Por ejemplo: Negro / Naranja.">
            <input className="input" id="colorway" maxLength={80} value={values.colorway} onChange={(event) => actualizarCampo("colorway", event.target.value)} />
          </Campo>
          <Campo label="Descripción" htmlFor="description">
            <textarea
              className="input textarea"
              id="description"
              rows={5}
              maxLength={2000}
              value={values.description}
              onChange={(event) => actualizarCampo("description", event.target.value)}
            />
          </Campo>
          <div className="form-row">
            <Campo label="Precio ($)" htmlFor="price">
              <input className="input" id="price" inputMode="decimal" required value={values.price} onChange={(event) => actualizarCampo("price", event.target.value)} />
            </Campo>
            <Campo label="Stock" htmlFor="stock">
              <input
                className="input"
                id="stock"
                type="number"
                min={0}
                max={100000}
                required
                value={values.stock}
                onChange={(event) => actualizarCampo("stock", event.target.value)}
              />
            </Campo>
          </div>
          <div className="form-row">
            <Campo label="Estilo de juego" htmlFor="play_style">
              <select className="select" id="play_style" value={values.playStyle} onChange={(event) => actualizarCampo("playStyle", event.target.value as PlayStyle)}>
                {PLAY_STYLE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PLAY_STYLES[key].label} ({PLAY_STYLES[key].role.toLowerCase()})
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Superficie" htmlFor="surface">
              <select className="select" id="surface" value={values.surface} onChange={(event) => actualizarCampo("surface", event.target.value as CourtSurface)}>
                {SURFACE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key === "BOTH" ? "Cubierta y exterior" : SURFACES[key].label}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <fieldset className="field-group">
            <legend className="field-label">Tallas disponibles (US)</legend>
            <div className="size-grid">
              {SIZE_CHOICES.map((size) => (
                <label key={size} className="size-option">
                  <input type="checkbox" checked={values.availableSizes.includes(size)} onChange={() => alternarTalla(size)} />
                  <span>{size}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="admin-form__side">
          <div className="field-group">
            <label className="field-label" htmlFor="image">
              Imagen
            </label>
            <div className="image-upload">{previewUrl && <img className="image-upload__preview" src={previewUrl} alt="Vista previa" />}</div>
            <input className="input" id="image" type="file" accept={ALLOWED_IMAGE_TYPES.join(",")} onChange={elegirImagen} />
            <p className="field-hint">JPG, PNG o WebP. Hasta 3 MB.</p>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={values.isActive} onChange={(event) => actualizarCampo("isActive", event.target.checked)} />
            <span>Visible en el catálogo</span>
          </label>
        </div>
      </div>

      {errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}
      <button className="button" type="submit" disabled={isSaving}>
        {product ? "Guardar cambios" : "Crear producto"}
      </button>
    </form>
  );
}

function PaginaFormularioProducto({ product }: { product: Product | null }) {
  return (
    <section className="wrapper page">
      <Link className="text-link back-link" to="/admin">
        ← Productos
      </Link>
      <h1 className="display">{product ? `Editar ${product.name}` : "Nuevo producto"}</h1>
      <FormularioProducto product={product} />
    </section>
  );
}

export function PaginaNuevoProducto() {
  return <PaginaFormularioProducto product={null} />;
}

export function PaginaEditarProducto() {
  const { productId = "" } = useParams();
  const { data: product, error, isLoading } = useCargarDatos(() => api.obtenerProductoAdmin(productId), `admin-producto-${productId}`);

  if (isLoading) return <Cargando />;
  if (error || !product) return <EstadoError error={error ?? new Error("No encontramos ese producto.")} />;
  return <PaginaFormularioProducto key={product.id} product={product} />;
}
