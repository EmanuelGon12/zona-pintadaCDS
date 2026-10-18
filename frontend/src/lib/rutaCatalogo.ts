import type { CatalogOrder, PlayStyle } from "../api/tipos";

interface CatalogFilters {
  search?: string;
  playStyle?: PlayStyle | "";
  order?: CatalogOrder;
}

export function rutaCatalogo({ search, playStyle, order }: CatalogFilters): string {
  const parameters = new URLSearchParams();
  if (search) parameters.set("q", search);
  if (playStyle) parameters.set("estilo", playStyle);
  if (order && order !== "nuevos") parameters.set("orden", order);
  const queryString = parameters.toString();
  return queryString ? `/modelos?${queryString}` : "/modelos";
}

// evita que ?volver= mande a otro sitio (ej //sitio-malo.com)
export function rutaDeVueltaSegura(candidate: string | null): string {
  return candidate && candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/";
}
