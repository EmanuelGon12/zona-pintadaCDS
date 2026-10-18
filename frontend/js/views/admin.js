import { api } from "../api.js";
import { showToast } from "../components/toast.js";
import { h } from "../dom.js";
import { centsToDollarsText, dollarsToCents, formatPrice } from "../format.js";
import { PLAY_STYLES, SURFACES } from "../playStyles.js";
import { navigate } from "../router.js";

const SIZE_CHOICES = Array.from({ length: 17 }, (_unused, index) => String(5 + index * 0.5).replace(".0", ""));
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAXIMUM_IMAGE_BYTES = 3 * 1024 * 1024;

export async function adminProductListView() {
  const products = await api.adminListProducts();

  return h(
    "section",
    { class: "wrapper page" },
    h(
      "div",
      { class: "section-heading" },
      h("h1", { class: "display" }, "Administración"),
      h("span", { class: "section-heading__count" }, `${products.length} productos`),
      h("a", { class: "button", href: "#/admin/productos/nuevo" }, "Nuevo producto")
    ),
    h(
      "table",
      { class: "data-table data-table--products" },
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          h("th", {}, ""),
          h("th", {}, "Modelo"),
          h("th", { class: "numeric" }, "Precio"),
          h("th", { class: "numeric" }, "Stock"),
          h("th", {}, "Estado"),
          h("th", {}, "")
        )
      ),
      h(
        "tbody",
        {},
        products.map((product) =>
          h(
            "tr",
            {},
            h("td", { class: "data-table__thumb" }, product.image_url ? h("img", { src: product.image_url, alt: "" }) : null),
            h("td", { "data-label": "Modelo" }, h("strong", {}, product.name), h("br"), h("span", { class: "muted" }, `${product.colorway} · ${PLAY_STYLES[product.play_style].label}`)),
            h("td", { class: "numeric", "data-label": "Precio" }, formatPrice(product.price_cents)),
            h("td", { class: "numeric", "data-label": "Stock" }, product.stock),
            h(
              "td",
              { "data-label": "Estado" },
              h("span", { class: `badge badge--${product.is_active ? "paid" : "cancelled"}` }, product.is_active ? "Activo" : "Oculto")
            ),
            h("td", {}, h("a", { class: "text-link", href: `#/admin/productos/${product.id}` }, "Editar"))
          )
        )
      )
    )
  );
}

function field(label, id, control, hint) {
  return h(
    "div",
    { class: "field-group" },
    h("label", { class: "field-label", for: id }, label),
    control,
    hint ? h("p", { class: "field-hint" }, hint) : null
  );
}

function sizeCheckboxes(selectedSizes) {
  return h(
    "fieldset",
    { class: "field-group" },
    h("legend", { class: "field-label" }, "Tallas disponibles (US)"),
    h(
      "div",
      { class: "size-grid" },
      SIZE_CHOICES.map((size) =>
        h(
          "label",
          { class: "size-option" },
          h("input", { type: "checkbox", name: "available_sizes", value: size, checked: selectedSizes.includes(size) }),
          h("span", {}, size)
        )
      )
    )
  );
}

export async function adminProductFormView({ params }) {
  const editingProductId = params.productId;
  const existingProduct = editingProductId ? await api.adminGetProduct(editingProductId) : null;

  const errorSlot = h("p", { class: "form-error", role: "alert", hidden: true });
  const previewImage = h("img", { class: "image-upload__preview", alt: "Vista previa", hidden: !existingProduct?.image_url, src: existingProduct?.image_url ?? "" });
  const imageInput = h("input", {
    id: "image",
    class: "input",
    type: "file",
    accept: ALLOWED_IMAGE_TYPES.join(","),
    onchange: (event) => {
      const [file] = event.target.files;
      if (!file) return;
      const problem = describeImageProblem(file);
      if (problem) {
        event.target.value = "";
        showError(problem);
        return;
      }
      previewImage.src = URL.createObjectURL(file);
      previewImage.hidden = false;
    },
  });

  function describeImageProblem(file) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "La imagen debe ser JPG, PNG o WebP.";
    if (file.size > MAXIMUM_IMAGE_BYTES) return "La imagen no puede pesar más de 3 MB.";
    return null;
  }

  function showError(message) {
    errorSlot.textContent = message;
    errorSlot.hidden = false;
  }

  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    errorSlot.hidden = true;

    const priceCents = dollarsToCents(formData.get("price"));
    if (priceCents === null || priceCents === 0) {
      showError("Ingresa un precio válido, por ejemplo 129.90.");
      return;
    }
    const sizes = formData.getAll("available_sizes");
    if (sizes.length === 0) {
      showError("Elige al menos una talla.");
      return;
    }

    const payload = {
      name: formData.get("name"),
      colorway: formData.get("colorway"),
      description: formData.get("description"),
      price_cents: priceCents,
      stock: Number(formData.get("stock")),
      available_sizes: sizes,
      play_style: formData.get("play_style"),
      surface: formData.get("surface"),
      is_active: formData.get("is_active") === "on",
    };

    const submitButton = form.querySelector("button[type=submit]");
    submitButton.disabled = true;
    try {
      const savedProduct = existingProduct
        ? await api.adminUpdateProduct(existingProduct.id, payload)
        : await api.adminCreateProduct(payload);
      const [imageFile] = imageInput.files;
      if (imageFile) await api.adminUploadImage(savedProduct.id, imageFile);
      showToast(existingProduct ? "Cambios guardados." : "Producto creado.");
      navigate("/admin");
    } catch (error) {
      showError(error.message);
      submitButton.disabled = false;
    }
  }

  return h(
    "section",
    { class: "wrapper page" },
    h("a", { class: "text-link back-link", href: "#/admin" }, "← Productos"),
    h("h1", { class: "display" }, existingProduct ? `Editar ${existingProduct.name}` : "Nuevo producto"),
    h(
      "form",
      { class: "form admin-form", onsubmit: save, novalidate: true },
      h(
        "div",
        { class: "admin-form__columns" },
        h(
          "div",
          { class: "admin-form__main" },
          field("Nombre", "name", h("input", { class: "input", id: "name", name: "name", required: true, maxlength: "120", value: existingProduct?.name ?? "" })),
          field("Color", "colorway", h("input", { class: "input", id: "colorway", name: "colorway", maxlength: "80", value: existingProduct?.colorway ?? "" }), "Por ejemplo: Negro / Naranja."),
          field("Descripción", "description", h("textarea", { class: "input textarea", id: "description", name: "description", rows: "5", maxlength: "2000" }, existingProduct?.description ?? "")),
          h(
            "div",
            { class: "form-row" },
            field("Precio (US$)", "price", h("input", { class: "input", id: "price", name: "price", inputmode: "decimal", required: true, value: existingProduct ? centsToDollarsText(existingProduct.price_cents) : "" })),
            field("Stock", "stock", h("input", { class: "input", id: "stock", name: "stock", type: "number", min: "0", max: "100000", required: true, value: existingProduct?.stock ?? 0 }))
          ),
          h(
            "div",
            { class: "form-row" },
            field(
              "Estilo de juego",
              "play_style",
              h(
                "select",
                { class: "select", id: "play_style", name: "play_style", value: existingProduct?.play_style ?? "ALL_AROUND" },
                Object.entries(PLAY_STYLES).map(([value, style]) => h("option", { value }, `${style.label} (${style.role.toLowerCase()})`))
              )
            ),
            field(
              "Superficie",
              "surface",
              h(
                "select",
                { class: "select", id: "surface", name: "surface", value: existingProduct?.surface ?? "BOTH" },
                Object.entries(SURFACES).map(([value, surface]) => h("option", { value }, value === "BOTH" ? "Cubierta y exterior" : surface.label))
              )
            )
          ),
          sizeCheckboxes(existingProduct?.available_sizes ?? ["8", "9", "10", "11"])
        ),
        h(
          "div",
          { class: "admin-form__side" },
          h(
            "div",
            { class: "field-group" },
            h("label", { class: "field-label", for: "image" }, "Imagen"),
            h("div", { class: "image-upload" }, previewImage),
            imageInput,
            h("p", { class: "field-hint" }, "JPG, PNG o WebP. Hasta 3 MB.")
          ),
          h(
            "label",
            { class: "checkbox" },
            h("input", { type: "checkbox", name: "is_active", checked: existingProduct ? existingProduct.is_active : true }),
            h("span", {}, "Visible en el catálogo")
          )
        )
      ),
      errorSlot,
      h("button", { class: "button", type: "submit" }, existingProduct ? "Guardar cambios" : "Crear producto")
    )
  );
}
