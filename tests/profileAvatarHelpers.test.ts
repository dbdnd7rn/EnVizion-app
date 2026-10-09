import test from "node:test";
import assert from "node:assert/strict";
import {
  PROFILE_PHOTO_MAX_BYTES,
  isOwnProfilePhoto,
  profilePhotoExtension,
  validateProfilePhoto,
} from "../src/profileAvatarHelpers.ts";

test("profile photos accept only safe image formats within 5 MB", () => {
  assert.equal(validateProfilePhoto("image/jpeg", 1000), null);
  assert.equal(validateProfilePhoto("image/png", PROFILE_PHOTO_MAX_BYTES), null);
  assert.equal(validateProfilePhoto("image/webp", 5000), null);
  assert.match(validateProfilePhoto("application/pdf", 500) ?? "", /JPEG/);
  assert.match(validateProfilePhoto("image/heic", 500) ?? "", /JPEG/);
  assert.match(validateProfilePhoto("image/png", 0) ?? "", /5 MB/);
  assert.match(validateProfilePhoto("image/png", PROFILE_PHOTO_MAX_BYTES + 1) ?? "", /5 MB/);
});

test("saved avatar extensions are controlled by mime type", () => {
  assert.equal(profilePhotoExtension("image/jpeg"), "jpg");
  assert.equal(profilePhotoExtension("image/png"), "png");
  assert.equal(profilePhotoExtension("image/webp"), "webp");
});

test("cleanup only removes photos inside the current account folder", () => {
  const id = "9b7cb294-5c10-4e63-bd36-4b7d86cd216e";
  assert.equal(isOwnProfilePhoto(id + "/avatar-123.jpg", id), true);
  assert.equal(isOwnProfilePhoto("someone-else/avatar.jpg", id), false);
  assert.equal(isOwnProfilePhoto(id + "/../other/photo.jpg", id), false);
  assert.equal(isOwnProfilePhoto(null, id), false);
});
