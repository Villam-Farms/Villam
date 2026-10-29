import { supabase } from "@/lib/supabase";

export type ProduceReference = {
  id: string;
  name: string;
};

const PREPARATION_WORDS = new Set([
  "fresh", "large", "small", "medium", "extra", "virgin", "organic", "ripe",
  "chopped", "diced", "sliced", "minced", "peeled", "crushed", "grated", "optional",
]);

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !PREPARATION_WORDS.has(word))
    .join(" ")
    .trim();
}

function singularize(value: string) {
  if (value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.endsWith("oes")) return value.slice(0, -2);
  if (value.endsWith("s") && !value.endsWith("ss")) return value.slice(0, -1);
  return value;
}

export function findProduceMatch(ingredientName: string, produceItems: ProduceReference[]) {
  const ingredient = normalize(ingredientName);
  if (!ingredient) return null;

  const ingredientForms = new Set([ingredient, singularize(ingredient)]);

  return produceItems.find((item) => {
    const produceName = normalize(item.name);
    const produceForms = [produceName, singularize(produceName)];

    return produceForms.some(
      (form) => ingredientForms.has(form) || ingredientForms.has(`the ${form}`)
    );
  }) ?? null;
}

export async function matchIngredientsToProduce(ingredientNames: string[]) {
  const uniqueNames = [...new Set(ingredientNames.map((name) => name.trim()).filter(Boolean))];
  if (uniqueNames.length === 0) return new Map<string, ProduceReference>();

  try {
    const { data, error } = await supabase
      .from("produce_items")
      .select("id,name")
      .order("name", { ascending: true });

    if (error) throw error;

    const produceItems = (data ?? []) as ProduceReference[];
    return new Map(
      uniqueNames.flatMap((name) => {
        const match = findProduceMatch(name, produceItems);
        return match ? [[name, match] as const] : [];
      })
    );
  } catch {
    // Ingredient linking enhances recipes but must not prevent recipes from loading or saving.
    return new Map<string, ProduceReference>();
  }
}
