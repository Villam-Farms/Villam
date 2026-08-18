import { supabase } from "@/lib/supabase";

export const FARM_IMAGE_BUCKET = "farm-images";

export function farmImagePathFromUrl(imageUrl: string | null | undefined) {
  if (!imageUrl) return null;

  try {
    const path = new URL(imageUrl).pathname;
    const prefix = `/storage/v1/object/public/${FARM_IMAGE_BUCKET}/`;
    if (!path.startsWith(prefix)) return null;
    return decodeURIComponent(path.slice(prefix.length)) || null;
  } catch {
    return null;
  }
}

export async function resolveFarmImageUrl(
  imagePath: string | null | undefined,
  fallbackUrl: string | null | undefined
) {
  const path = imagePath || farmImagePathFromUrl(fallbackUrl);
  if (!path) return fallbackUrl ?? null;

  const { data, error } = await supabase.storage
    .from(FARM_IMAGE_BUCKET)
    .createSignedUrl(path, 60 * 60);
  return !error && data?.signedUrl ? data.signedUrl : fallbackUrl ?? null;
}
