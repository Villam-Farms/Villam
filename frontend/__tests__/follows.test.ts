const mockApiRequest = jest.fn();

jest.mock("@/lib/api", () => ({
  apiBaseUrl: "https://api.example.test",
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

import {
  completeOnboarding,
  followUser,
  getMe,
  getUserProfile,
  listFollowers,
  listFollowing,
  searchUsers,
  unfollowUser,
  updateMyAvatarUrl,
  updateMyDescription,
  updateMyProfile,
  uploadMyAvatar,
} from "@/lib/follows";

describe("follow/profile API", () => {
  beforeEach(() => {
    mockApiRequest.mockReset().mockResolvedValue({ ok: true });
    global.fetch = jest.fn() as jest.Mock;
  });

  it("builds profile requests", async () => {
    await getMe("token");
    expect(mockApiRequest).toHaveBeenLastCalledWith("/me", { accessToken: "token" });

    await completeOnboarding("token", { full_name: "Ada" });
    expect(mockApiRequest).toHaveBeenLastCalledWith("/me/onboarding", {
      method: "PUT", accessToken: "token", body: { full_name: "Ada" },
    });

    await getUserProfile("token", "user/a b");
    expect(mockApiRequest).toHaveBeenLastCalledWith("/users/user%2Fa%20b/profile", { accessToken: "token" });

    await updateMyDescription("token", null);
    expect(mockApiRequest).toHaveBeenLastCalledWith("/me", {
      method: "PATCH", accessToken: "token", body: { description: null },
    });

    await updateMyProfile("token", { username: "ada" });
    expect(mockApiRequest).toHaveBeenLastCalledWith("/me", {
      method: "PATCH", accessToken: "token", body: { username: "ada" },
    });

    await updateMyAvatarUrl("token", "avatar.jpg");
    expect(mockApiRequest).toHaveBeenLastCalledWith("/me", {
      method: "PATCH", accessToken: "token", body: { avatar_url: "avatar.jpg" },
    });
  });

  it.each([
    [searchUsers, "/users/search?q=leafy+greens&limit=12"],
    [listFollowers, "/followers?q=leafy+greens&limit=12"],
    [listFollowing, "/following?q=leafy+greens&limit=12"],
  ])("builds encoded search URLs", async (fn, expected) => {
    await fn("token", " leafy greens ", 12);
    expect(mockApiRequest).toHaveBeenCalledWith(expected, { accessToken: "token" });
  });

  it("omits blank queries and uses default limits", async () => {
    await searchUsers("token", "   ");
    expect(mockApiRequest).toHaveBeenLastCalledWith("/users/search?limit=50", { accessToken: "token" });
    await listFollowers("token", "");
    expect(mockApiRequest).toHaveBeenLastCalledWith("/followers?limit=100", { accessToken: "token" });
  });

  it("follows and unfollows encoded users", async () => {
    await followUser("token", "user/2");
    expect(mockApiRequest).toHaveBeenLastCalledWith("/follow", {
      method: "POST", accessToken: "token", body: { following_id: "user/2" },
    });
    await unfollowUser("token", "user/2");
    expect(mockApiRequest).toHaveBeenLastCalledWith("/follow/user%2F2", {
      method: "DELETE", accessToken: "token",
    });
  });

  it("uploads an avatar and returns JSON", async () => {
    const response = { profile: { id: "u1" }, counts: { followers: 1, following: 2 } };
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(response) });
    await expect(uploadMyAvatar("token", { uri: "file://a.jpg", name: "a.jpg", type: "image/jpeg" }))
      .resolves.toEqual(response);
    expect(global.fetch).toHaveBeenCalledWith("https://api.example.test/me/avatar", expect.objectContaining({
      method: "POST", headers: { Authorization: "Bearer token" }, body: expect.any(FormData),
    }));
  });

  it("uses server detail for upload failures", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false, status: 413, json: jest.fn().mockResolvedValue({ detail: "Too large" }),
    });
    await expect(uploadMyAvatar("t", { uri: "x", name: "x", type: "x" })).rejects.toThrow("Too large");
  });

  it("falls back when an upload error is not JSON", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false, status: 500, json: jest.fn().mockRejectedValue(new Error("invalid")),
    });
    await expect(uploadMyAvatar("t", { uri: "x", name: "x", type: "x" })).rejects.toThrow("Request failed (500)");
  });
});
