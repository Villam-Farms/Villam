from io import BytesIO
import os
from datetime import datetime, timezone

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from jwt import InvalidTokenError
from PIL import Image
from pydantic import BaseModel, Field
from supabase import Client, create_client

load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
supabase_jwt_secret = os.getenv("SUPABASE_JWT_SECRET")

if not supabase_url or not supabase_service_role_key:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env")

supabase: Client = create_client(supabase_url, supabase_service_role_key)

app = FastAPI(title="Villam API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_bearer_token(request: Request) -> str:
    header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not header or not header.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    return header.split(" ", 1)[1].strip()


def get_current_user_id(request: Request) -> str:
    if not supabase_jwt_secret:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="SUPABASE_JWT_SECRET not set")

    token = _get_bearer_token(request)
    try:
        payload = jwt.decode(token, supabase_jwt_secret, algorithms=["HS256"], options={"verify_aud": False})
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return str(user_id)


def _safe_count(resp) -> int:
    count = getattr(resp, "count", None)
    if isinstance(count, int):
        return count
    data = getattr(resp, "data", None)
    if isinstance(data, list):
        return len(data)
    return 0


def _format_supabase_error(error: Exception) -> str:
    message = str(error).strip()
    if message:
        return message
    return error.__class__.__name__


class FollowRequest(BaseModel):
    following_id: str = Field(..., min_length=1)


class ProfileOut(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = None
    avatar_url: str | None = None
    description: str | None = None


class SearchUserOut(ProfileOut):
    is_following: bool


class CountsOut(BaseModel):
    followers: int
    following: int


class MeOut(BaseModel):
    profile: ProfileOut | None
    counts: CountsOut


class UserProfileOut(MeOut):
    is_following: bool


class ListingImageOut(BaseModel):
    id: str
    image_url: str | None = None


class FarmRatingIn(BaseModel):
    rating: float = Field(..., ge=1, le=5)
    review: str = Field(..., min_length=1, max_length=500)


class FarmRatingOut(BaseModel):
    id: int | str
    farm_id: str
    user_id: str
    rating: float
    review: str
    created_at: str | None = None
    updated_at: str | None = None


class UpdateMeIn(BaseModel):
    description: str | None = Field(default=None, max_length=280)
    avatar_url: str | None = Field(default=None, max_length=2048)


class GroceryListItemIn(BaseModel):
    name: str = Field(..., min_length=1)
    quantity: float | None = None
    unit: str | None = None
    checked: bool = False
    category: str | None = None
    isPinned: bool = False
    sortOrder: int = 0


class GroceryListCreateIn(BaseModel):
    title: str = Field(..., min_length=1)
    isPinned: bool = False
    items: list[GroceryListItemIn] = Field(default_factory=list)


class GroceryListCreateOut(BaseModel):
    id: str


class NotificationOut(BaseModel):
    id: str
    type: str
    title: str
    body: str
    actor: ProfileOut | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    is_read: bool = False
    created_at: str | None = None


class CreateThreadIn(BaseModel):
    farm_id: str = Field(..., min_length=1)
    message: str | None = Field(default=None, max_length=1000)


class SendMessageIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=1000)


class ConversationMessageOut(BaseModel):
    id: str
    thread_id: str
    sender_id: str
    recipient_id: str
    body: str
    created_at: str | None = None
    read_at: str | None = None
    sender: ProfileOut | None = None


class ConversationThreadOut(BaseModel):
    id: str
    farm_id: str
    farm_name: str | None = None
    other_user: ProfileOut | None = None
    last_message_preview: str | None = None
    last_message_at: str | None = None
    unread_count: int = 0


class ConversationThreadDetailOut(BaseModel):
    thread: ConversationThreadOut
    messages: list[ConversationMessageOut]


def _get_following_ids(user_id: str) -> set[str]:
    resp = (
        supabase.table("follows")
        .select("following_id")
        .eq("follower_id", user_id)
        .limit(1000)
        .execute()
    )
    return {
        row.get("following_id")
        for row in (getattr(resp, "data", []) or [])
        if row.get("following_id")
    }


def _get_profiles_by_ids(
    ids: list[str], q: str | None = None, limit: int = 100
) -> list[dict]:
    if not ids:
        return []

    query = (
        supabase.table("profiles")
        .select("id,username,full_name,avatar_url")
        .in_("id", ids)
        .limit(limit)
        .order("username", desc=False)
    )

    if q and q.strip():
        term = q.strip()
        query = query.or_(f"username.ilike.%{term}%,full_name.ilike.%{term}%")

    resp = query.execute()
    return getattr(resp, "data", []) or []


def _farm_rating_out(row: dict) -> FarmRatingOut:
    return FarmRatingOut(
        id=row["id"],
        farm_id=str(row["farm_id"]),
        user_id=row["user_id"],
        rating=row["rating"],
        review=row.get("review") or "",
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_profile_map(ids: list[str]) -> dict[str, ProfileOut]:
    if not ids:
        return {}

    unique_ids = list(dict.fromkeys(id_ for id_ in ids if id_))
    if not unique_ids:
        return {}

    resp = (
        supabase.table("profiles")
        .select("id,username,full_name,avatar_url,description")
        .in_("id", unique_ids)
        .execute()
    )
    rows = getattr(resp, "data", []) or []
    return {
        str(row["id"]): ProfileOut(**row)
        for row in rows
        if row.get("id")
    }


def _create_notification(
    *,
    user_id: str,
    actor_id: str | None,
    type_: str,
    title: str,
    body: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
) -> None:
    supabase.table("notifications").insert(
        {
            "user_id": user_id,
            "actor_id": actor_id,
            "type": type_,
            "title": title,
            "body": body,
            "entity_type": entity_type,
            "entity_id": entity_id,
        }
    ).execute()


def _get_farm_row(farm_id: str) -> dict:
    resp = (
        supabase.table("farms")
        .select("id,name,user_id")
        .eq("id", farm_id)
        .maybe_single()
        .execute()
    )
    row = getattr(resp, "data", None)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    return row


def _get_thread_row(thread_id: str) -> dict:
    resp = (
        supabase.table("conversation_threads")
        .select("id,farm_id,buyer_user_id,farmer_user_id,last_message_at,created_at")
        .eq("id", thread_id)
        .maybe_single()
        .execute()
    )
    row = getattr(resp, "data", None)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return row


def _ensure_thread_participant(thread_id: str, user_id: str) -> dict:
    row = _get_thread_row(thread_id)
    if user_id not in {row.get("buyer_user_id"), row.get("farmer_user_id")}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant in this conversation")
    return row


def _get_or_create_thread(farm_id: str, buyer_user_id: str) -> dict:
    farm = _get_farm_row(farm_id)
    farmer_user_id = str(farm.get("user_id") or "")
    if not farmer_user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm owner not found")
    if farmer_user_id == buyer_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot message your own farm")

    existing_resp = (
        supabase.table("conversation_threads")
        .select("id,farm_id,buyer_user_id,farmer_user_id,last_message_at,created_at")
        .eq("farm_id", farm_id)
        .eq("buyer_user_id", buyer_user_id)
        .eq("farmer_user_id", farmer_user_id)
        .limit(1)
        .execute()
    )
    existing_rows = getattr(existing_resp, "data", []) or []
    if existing_rows:
        return existing_rows[0]

    create_resp = (
        supabase.table("conversation_threads")
        .insert(
            {
                "farm_id": farm_id,
                "buyer_user_id": buyer_user_id,
                "farmer_user_id": farmer_user_id,
            }
        )
        .select("id,farm_id,buyer_user_id,farmer_user_id,last_message_at,created_at")
        .single()
        .execute()
    )
    row = getattr(create_resp, "data", None)
    if not row:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to create conversation")
    return row


def _build_thread_summary(thread_row: dict, viewer_user_id: str) -> ConversationThreadOut:
    farm_id = str(thread_row.get("farm_id") or "")
    buyer_user_id = str(thread_row.get("buyer_user_id") or "")
    farmer_user_id = str(thread_row.get("farmer_user_id") or "")
    other_user_id = farmer_user_id if viewer_user_id == buyer_user_id else buyer_user_id

    profile_map = _get_profile_map([other_user_id])
    farm_resp = (
        supabase.table("farms")
        .select("id,name")
        .eq("id", farm_id)
        .maybe_single()
        .execute()
    )
    farm_row = getattr(farm_resp, "data", None) or {}

    last_message_resp = (
        supabase.table("conversation_messages")
        .select("body,created_at")
        .eq("thread_id", thread_row["id"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    last_message = ((getattr(last_message_resp, "data", []) or [None])[0]) or {}

    unread_resp = (
        supabase.table("conversation_messages")
        .select("id", count="exact")
        .eq("thread_id", thread_row["id"])
        .eq("recipient_user_id", viewer_user_id)
        .is_("read_at", "null")
        .execute()
    )

    return ConversationThreadOut(
        id=str(thread_row["id"]),
        farm_id=farm_id,
        farm_name=farm_row.get("name"),
        other_user=profile_map.get(other_user_id),
        last_message_preview=last_message.get("body"),
        last_message_at=thread_row.get("last_message_at") or last_message.get("created_at") or thread_row.get("created_at"),
        unread_count=_safe_count(unread_resp),
    )


FARM_RATING_SELECT_COLUMNS = "id,farm_id,user_id,rating,review,created_at,updated_at"


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@app.get("/db-check")
def db_check() -> dict:
    response = supabase.table("profiles").select("id").limit(1).execute()
    return {"data": response.data}


@app.put("/farms/{farm_id}/rating", response_model=FarmRatingOut)
def save_farm_rating(
    farm_id: str,
    body: FarmRatingIn,
    user_id: str = Depends(get_current_user_id),
) -> FarmRatingOut:
    try:
        farm_resp = (
            supabase.table("farms")
            .select("id")
            .eq("id", farm_id)
            .maybe_single()
            .execute()
        )
        if not getattr(farm_resp, "data", None):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")

        existing_resp = (
            supabase.table("farm_ratings")
            .select("id")
            .eq("farm_id", farm_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        existing = (getattr(existing_resp, "data", []) or [None])[0]

        payload = {
            "farm_id": farm_id,
            "user_id": user_id,
            "rating": round(body.rating * 2) / 2,
            "review": body.review.strip(),
        }

        if existing and existing.get("id") is not None:
            (
                supabase.table("farm_ratings")
                .update(payload)
                .eq("id", existing["id"])
                .execute()
            )
        else:
            supabase.table("farm_ratings").insert(payload).execute()

        rating_resp = (
            supabase.table("farm_ratings")
            .select(FARM_RATING_SELECT_COLUMNS)
            .eq("farm_id", farm_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_format_supabase_error(error),
        )

    rating_row = getattr(rating_resp, "data", None)
    if not isinstance(rating_row, dict):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Review was not saved")

    return _farm_rating_out(rating_row)


@app.get("/me", response_model=MeOut)
def get_me(user_id: str = Depends(get_current_user_id)) -> MeOut:
    profile_resp = (
        supabase.table("profiles")
        .select("id,username,full_name,avatar_url,description")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )

    followers_resp = supabase.table("follows").select("*", count="exact").eq("following_id", user_id).execute()
    following_resp = supabase.table("follows").select("*", count="exact").eq("follower_id", user_id).execute()

    profile_data = getattr(profile_resp, "data", None)
    profile = ProfileOut(**profile_data) if isinstance(profile_data, dict) else None

    return MeOut(
        profile=profile,
        counts=CountsOut(followers=_safe_count(followers_resp), following=_safe_count(following_resp)),
    )


@app.get("/users/{profile_id}/profile", response_model=UserProfileOut)
def get_user_profile(
    profile_id: str, user_id: str = Depends(get_current_user_id)
) -> UserProfileOut:
    profile_resp = (
        supabase.table("profiles")
        .select("id,username,full_name,avatar_url,description")
        .eq("id", profile_id)
        .maybe_single()
        .execute()
    )
    profile_data = getattr(profile_resp, "data", None)
    if not isinstance(profile_data, dict):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    followers_resp = (
        supabase.table("follows")
        .select("*", count="exact")
        .eq("following_id", profile_id)
        .execute()
    )
    following_resp = (
        supabase.table("follows")
        .select("*", count="exact")
        .eq("follower_id", profile_id)
        .execute()
    )
    relationship_resp = (
        supabase.table("follows")
        .select("following_id")
        .eq("follower_id", user_id)
        .eq("following_id", profile_id)
        .limit(1)
        .execute()
    )

    return UserProfileOut(
        profile=ProfileOut(**profile_data),
        counts=CountsOut(
            followers=_safe_count(followers_resp),
            following=_safe_count(following_resp),
        ),
        is_following=bool(getattr(relationship_resp, "data", None)),
    )


@app.patch("/me", response_model=MeOut)
def update_me(body: UpdateMeIn, user_id: str = Depends(get_current_user_id)) -> MeOut:
    payload = body.model_dump(exclude_unset=True)
    payload["id"] = user_id
    supabase.table("profiles").upsert(payload, on_conflict="id").execute()
    return get_me(user_id)


def _compress_image_to_jpeg(
    image_bytes: bytes,
    *,
    max_size_bytes: int = 500 * 1024,
    max_dim: int = 512,
) -> bytes:
    with Image.open(BytesIO(image_bytes)) as img:
        img = img.convert("RGBA")
        background = Image.new("RGBA", img.size, (255, 255, 255, 255))
        background.alpha_composite(img)
        img_rgb = background.convert("RGB")

        img_rgb.thumbnail((max_dim, max_dim))

        quality = 85
        scale_attempts = 0
        while True:
            out = BytesIO()
            img_rgb.save(out, format="JPEG", quality=quality, optimize=True, progressive=True)
            data = out.getvalue()
            if len(data) <= max_size_bytes:
                return data

            if quality > 45:
                quality -= 10
                continue

            if scale_attempts >= 3:
                return data

            # reduce dimensions and try again
            scale_attempts += 1
            new_w = max(128, int(img_rgb.width * 0.85))
            new_h = max(128, int(img_rgb.height * 0.85))
            img_rgb = img_rgb.resize((new_w, new_h))
            quality = 75


def _get_listing_owner(listing_id: str) -> tuple[str, str | None]:
    listing_resp = (
        supabase.table("farm_listings")
        .select("id,image_url,farms!inner(user_id)")
        .eq("id", listing_id)
        .maybe_single()
        .execute()
    )

    listing_data = getattr(listing_resp, "data", None)
    if not isinstance(listing_data, dict):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")

    farm_data = listing_data.get("farms")
    if isinstance(farm_data, list):
        farm_data = farm_data[0] if farm_data else None

    owner_id = farm_data.get("user_id") if isinstance(farm_data, dict) else None
    if not owner_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing owner not found")

    return str(owner_id), listing_data.get("image_url")


def _ensure_listing_owner(listing_id: str, user_id: str) -> str | None:
    owner_id, image_url = _get_listing_owner(listing_id)
    if owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this listing")
    return image_url


def _set_listing_image_url(listing_id: str, image_url: str | None) -> ListingImageOut:
    supabase.table("farm_listings").update({"image_url": image_url}).eq("id", listing_id).execute()
    return ListingImageOut(id=listing_id, image_url=image_url)


@app.post("/me/avatar", response_model=MeOut)
async def upload_avatar(
    file: UploadFile = File(...), user_id: str = Depends(get_current_user_id)
) -> MeOut:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file type")

    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")

    try:
        compressed = _compress_image_to_jpeg(raw)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to process image")

    object_path = f"{user_id}/avatar_{int.from_bytes(os.urandom(4), 'big')}.jpg"
    supabase.storage.from_("avatars").upload(
        object_path,
        compressed,
        {"content-type": "image/jpeg", "cache-control": "3600"},
    )

    public_url = supabase.storage.from_("avatars").get_public_url(object_path)
    supabase.table("profiles").upsert({"id": user_id, "avatar_url": public_url}, on_conflict="id").execute()
    return get_me(user_id)


@app.post("/listings/{listing_id}/image", response_model=ListingImageOut)
async def upload_listing_image(
    listing_id: str, file: UploadFile = File(...), user_id: str = Depends(get_current_user_id)
) -> ListingImageOut:
    _ensure_listing_owner(listing_id, user_id)

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file type")

    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")

    try:
        compressed = _compress_image_to_jpeg(raw, max_dim=960)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to process image")

    object_path = f"{user_id}/{listing_id}_{int.from_bytes(os.urandom(4), 'big')}.jpg"
    supabase.storage.from_("listing-images").upload(
        object_path,
        compressed,
        {"content-type": "image/jpeg", "cache-control": "3600"},
    )

    public_url = supabase.storage.from_("listing-images").get_public_url(object_path)
    return _set_listing_image_url(listing_id, public_url)


@app.delete("/listings/{listing_id}/image", response_model=ListingImageOut)
def delete_listing_image(
    listing_id: str, user_id: str = Depends(get_current_user_id)
) -> ListingImageOut:
    _ensure_listing_owner(listing_id, user_id)
    return _set_listing_image_url(listing_id, None)


@app.get("/followers", response_model=list[SearchUserOut])
def list_followers(
    q: str | None = None, limit: int = 100, user_id: str = Depends(get_current_user_id)
) -> list[SearchUserOut]:
    limit = max(1, min(limit, 200))

    rel_resp = (
        supabase.table("follows")
        .select("follower_id")
        .eq("following_id", user_id)
        .limit(limit)
        .execute()
    )
    follower_ids = [
        row.get("follower_id")
        for row in (getattr(rel_resp, "data", []) or [])
        if row.get("follower_id")
    ]

    following_ids = _get_following_ids(user_id)
    profiles = _get_profiles_by_ids(follower_ids, q=q, limit=limit)

    results: list[SearchUserOut] = []
    for row in profiles:
        profile = ProfileOut(**row)
        results.append(
            SearchUserOut(**profile.model_dump(), is_following=profile.id in following_ids)
        )
    return results


@app.get("/following", response_model=list[SearchUserOut])
def list_following(
    q: str | None = None, limit: int = 100, user_id: str = Depends(get_current_user_id)
) -> list[SearchUserOut]:
    limit = max(1, min(limit, 200))

    rel_resp = (
        supabase.table("follows")
        .select("following_id")
        .eq("follower_id", user_id)
        .limit(limit)
        .execute()
    )
    following_list = [
        row.get("following_id")
        for row in (getattr(rel_resp, "data", []) or [])
        if row.get("following_id")
    ]

    profiles = _get_profiles_by_ids(following_list, q=q, limit=limit)

    results: list[SearchUserOut] = []
    for row in profiles:
        profile = ProfileOut(**row)
        results.append(SearchUserOut(**profile.model_dump(), is_following=True))
    return results


@app.get("/users/search", response_model=list[SearchUserOut])
def search_users(
    q: str | None = None, limit: int = 50, user_id: str = Depends(get_current_user_id)
) -> list[SearchUserOut]:
    limit = max(1, min(limit, 100))

    query = (
        supabase.table("profiles")
        .select("id,username,full_name,avatar_url")
        .neq("id", user_id)
        .limit(limit)
    )

    if q and q.strip():
        term = q.strip()
        query = query.or_(f"username.ilike.%{term}%,full_name.ilike.%{term}%")

    profiles_resp = query.execute()
    profiles = getattr(profiles_resp, "data", []) or []

    following_resp = supabase.table("follows").select("following_id").eq("follower_id", user_id).execute()
    following_ids = {
        row.get("following_id")
        for row in (getattr(following_resp, "data", []) or [])
        if row.get("following_id")
    }

    results: list[SearchUserOut] = []
    for row in profiles:
        profile = ProfileOut(**row)
        results.append(SearchUserOut(**profile.model_dump(), is_following=profile.id in following_ids))
    return results


@app.post("/follow", status_code=204)
def follow(body: FollowRequest, user_id: str = Depends(get_current_user_id)) -> None:
    if body.following_id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot follow yourself")

    existing_resp = (
        supabase.table("follows")
        .select("follower_id")
        .eq("follower_id", user_id)
        .eq("following_id", body.following_id)
        .limit(1)
        .execute()
    )
    existed = bool(getattr(existing_resp, "data", None))

    supabase.table("follows").upsert(
        {"follower_id": user_id, "following_id": body.following_id},
        on_conflict="follower_id,following_id",
    ).execute()

    if not existed:
        actor_profile = _get_profile_map([user_id]).get(user_id)
        actor_name = (
            actor_profile.full_name
            if actor_profile and actor_profile.full_name
            else f"@{actor_profile.username}" if actor_profile and actor_profile.username
            else "Someone"
        )
        _create_notification(
            user_id=body.following_id,
            actor_id=user_id,
            type_="follow",
            title="New follower",
            body=f"{actor_name} started following you.",
            entity_type="profile",
            entity_id=user_id,
        )


@app.delete("/follow/{following_id}", status_code=204)
def unfollow(following_id: str, user_id: str = Depends(get_current_user_id)) -> None:
    supabase.table("follows").delete().match({"follower_id": user_id, "following_id": following_id}).execute()


@app.get("/notifications", response_model=list[NotificationOut])
def list_notifications(user_id: str = Depends(get_current_user_id)) -> list[NotificationOut]:
    resp = (
        supabase.table("notifications")
        .select("id,type,title,body,actor_id,entity_type,entity_id,is_read,created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )
    rows = getattr(resp, "data", []) or []
    actor_ids = [str(row.get("actor_id")) for row in rows if row.get("actor_id")]
    profile_map = _get_profile_map(actor_ids)

    return [
        NotificationOut(
            id=str(row["id"]),
            type=str(row.get("type") or ""),
            title=str(row.get("title") or ""),
            body=str(row.get("body") or ""),
            actor=profile_map.get(str(row.get("actor_id"))),
            entity_type=row.get("entity_type"),
            entity_id=str(row["entity_id"]) if row.get("entity_id") else None,
            is_read=bool(row.get("is_read")),
            created_at=row.get("created_at"),
        )
        for row in rows
        if row.get("id")
    ]


@app.post("/notifications/read-all", status_code=204)
def read_all_notifications(user_id: str = Depends(get_current_user_id)) -> None:
    supabase.table("notifications").update({"is_read": True}).eq("user_id", user_id).eq("is_read", False).execute()


@app.post("/notifications/{notification_id}/read", status_code=204)
def read_notification(notification_id: str, user_id: str = Depends(get_current_user_id)) -> None:
    supabase.table("notifications").update({"is_read": True}).eq("id", notification_id).eq("user_id", user_id).execute()


@app.get("/threads", response_model=list[ConversationThreadOut])
def list_threads(user_id: str = Depends(get_current_user_id)) -> list[ConversationThreadOut]:
    resp = (
        supabase.table("conversation_threads")
        .select("id,farm_id,buyer_user_id,farmer_user_id,last_message_at,created_at")
        .or_(f"buyer_user_id.eq.{user_id},farmer_user_id.eq.{user_id}")
        .order("last_message_at", desc=True)
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )
    rows = getattr(resp, "data", []) or []
    return [_build_thread_summary(row, user_id) for row in rows if row.get("id")]


@app.post("/threads", response_model=ConversationThreadOut)
def create_thread(body: CreateThreadIn, user_id: str = Depends(get_current_user_id)) -> ConversationThreadOut:
    thread = _get_or_create_thread(body.farm_id, user_id)

    message = (body.message or "").strip()
    if message:
        send_thread_message(str(thread["id"]), SendMessageIn(body=message), user_id)
        thread = _get_thread_row(str(thread["id"]))

    return _build_thread_summary(thread, user_id)


@app.get("/threads/{thread_id}", response_model=ConversationThreadDetailOut)
def get_thread(thread_id: str, user_id: str = Depends(get_current_user_id)) -> ConversationThreadDetailOut:
    thread = _ensure_thread_participant(thread_id, user_id)

    supabase.table("conversation_messages").update({"read_at": _utc_now_iso()}).eq("thread_id", thread_id).eq("recipient_user_id", user_id).is_("read_at", "null").execute()
    supabase.table("notifications").update({"is_read": True}).eq("user_id", user_id).eq("type", "message").eq("entity_type", "thread").eq("entity_id", thread_id).eq("is_read", False).execute()

    messages_resp = (
        supabase.table("conversation_messages")
        .select("id,thread_id,sender_user_id,recipient_user_id,body,created_at,read_at")
        .eq("thread_id", thread_id)
        .order("created_at", desc=False)
        .limit(500)
        .execute()
    )
    rows = getattr(messages_resp, "data", []) or []
    sender_ids = [str(row.get("sender_user_id")) for row in rows if row.get("sender_user_id")]
    profile_map = _get_profile_map(sender_ids)

    return ConversationThreadDetailOut(
        thread=_build_thread_summary(thread, user_id),
        messages=[
            ConversationMessageOut(
                id=str(row["id"]),
                thread_id=str(row["thread_id"]),
                sender_id=str(row["sender_user_id"]),
                recipient_id=str(row["recipient_user_id"]),
                body=str(row.get("body") or ""),
                created_at=row.get("created_at"),
                read_at=row.get("read_at"),
                sender=profile_map.get(str(row.get("sender_user_id"))),
            )
            for row in rows
            if row.get("id")
        ],
    )


@app.post("/threads/{thread_id}/messages", response_model=ConversationMessageOut)
def send_thread_message(
    thread_id: str,
    body: SendMessageIn,
    user_id: str = Depends(get_current_user_id),
) -> ConversationMessageOut:
    thread = _ensure_thread_participant(thread_id, user_id)
    buyer_user_id = str(thread.get("buyer_user_id") or "")
    farmer_user_id = str(thread.get("farmer_user_id") or "")
    recipient_user_id = farmer_user_id if user_id == buyer_user_id else buyer_user_id
    if not recipient_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Conversation recipient missing")

    clean_body = body.body.strip()
    if not clean_body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message cannot be empty")

    create_resp = (
        supabase.table("conversation_messages")
        .insert(
            {
                "thread_id": thread_id,
                "sender_user_id": user_id,
                "recipient_user_id": recipient_user_id,
                "body": clean_body,
            }
        )
        .select("id,thread_id,sender_user_id,recipient_user_id,body,created_at,read_at")
        .single()
        .execute()
    )
    row = getattr(create_resp, "data", None)
    if not row:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to send message")

    supabase.table("conversation_threads").update({"last_message_at": row.get("created_at") or _utc_now_iso()}).eq("id", thread_id).execute()

    sender_profile = _get_profile_map([user_id]).get(user_id)
    sender_name = (
        sender_profile.full_name
        if sender_profile and sender_profile.full_name
        else f"@{sender_profile.username}" if sender_profile and sender_profile.username
        else "Someone"
    )
    _create_notification(
        user_id=recipient_user_id,
        actor_id=user_id,
        type_="message",
        title="New message",
        body=f"{sender_name}: {clean_body[:120]}",
        entity_type="thread",
        entity_id=thread_id,
    )

    return ConversationMessageOut(
        id=str(row["id"]),
        thread_id=str(row["thread_id"]),
        sender_id=str(row["sender_user_id"]),
        recipient_id=str(row["recipient_user_id"]),
        body=str(row.get("body") or ""),
        created_at=row.get("created_at"),
        read_at=row.get("read_at"),
        sender=sender_profile,
    )
