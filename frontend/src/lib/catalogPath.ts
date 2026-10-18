import type { CatalogOrder, PlayStyle } from "../api/types";

interface CatalogFilters {
  search?: string;
  playStyle?: PlayStyle | "";
  order?: CatalogOrder;
}

export function catalogPath({ search, playStyle, order }: CatalogFilters): string {
  const parameters = new URLSearchParams();
  if (search) parameters.set("q", search);
  if (playStyle) parameters.set("estilo", playStyle);
  if (order && order !== "nuevos") parameters.set("orden", order);
  const queryString = parameters.toString();
  return queryString ? `/modelos?${queryString}` : "/modelos";
}

export function safeReturnPath(candidate: string | null): string {
  return candidate && candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/";
}
