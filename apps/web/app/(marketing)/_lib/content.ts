import { en, type Content } from "./content.en";
import { bn } from "./content.bn";
import type { Lang } from "./lang";

export type { Content };

export function getContent(lang: Lang): Content {
  return lang === "bn" ? bn : en;
}

// "{days} দিন" / "{price}" ধরনের প্লেসহোল্ডারে মান বসায়
export function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
