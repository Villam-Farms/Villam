import type { ProfileRow } from "@/lib/follows";

type AuthMetadata = {
  name?: string;
  full_name?: string;
  username?: string;
};

export function getProfileDisplay(profile?: ProfileRow | null, metadata?: AuthMetadata, email?: string | null) {
  const fullName =
    profile?.full_name?.trim() ||
    metadata?.name?.trim() ||
    metadata?.full_name?.trim() ||
    null;

  const username =
    profile?.username?.trim() ||
    metadata?.username?.trim() ||
    null;

  const displayName =
    fullName ||
    username ||
    email?.split("@")[0] ||
    "there";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return {
    avatarUrl: profile?.avatar_url ?? null,
    fullName,
    username,
    displayName,
    initials: initials || "U",
  };
}
