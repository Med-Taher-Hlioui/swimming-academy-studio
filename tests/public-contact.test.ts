import assert from "node:assert/strict";
import { test } from "node:test";
import { instagramLink, whatsappLink } from "../src/features/public-site/contact-links";

test("missing or invalid contacts never create a live social link", () => {
  for (const value of [null, "", "javascript:alert(1)", "https://instagram.com.evil.test/owner", "https://user:pass@instagram.com/owner", "http://instagram.com/owner", "https://instagram.com/", "https://instagram.com/owner/extra"]) {
    assert.equal(instagramLink(value), null);
  }
  for (const value of [null, "", "owner number", "+216 00 000 000", "0123456789", "123", "1234567890123456"]) {
    assert.equal(whatsappLink(value, "Hello"), null);
  }
});

test("configured social links use allowed destinations and encoded message text", () => {
  // Synthetic inputs for URL construction only; these are not academy contacts.
  assert.equal(instagramLink("https://instagram.com/example_profile/?tracking=test"), "https://www.instagram.com/example_profile/");
  const url = new URL(whatsappLink("12345678901", "Bonjour & hello? مرحبا")!);
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/12345678901");
  assert.equal(url.searchParams.get("text"), "Bonjour & hello? مرحبا");
  assert.equal([...url.searchParams].length, 1);
});
