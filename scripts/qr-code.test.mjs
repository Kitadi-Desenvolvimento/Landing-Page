import assert from "node:assert/strict";
import { test } from "node:test";
import { generateQRCode, getProductQRCodeUrl, getQrLogoLayout } from "../app/lib/qr-code-service.ts";

test("the catalogue QR points to the real public route, not the backoffice", () => {
  assert.equal(
    getProductQRCodeUrl("https://www.kitadi.co.ao/backoffice?section=products#catalogue"),
    "https://www.kitadi.co.ao/produtos",
  );
});

test("each product, including a newly created one, uses its own public slug", () => {
  for (const slug of ["financas-pessoais", "produto-acabado-de-criar"]) {
    assert.equal(
      getProductQRCodeUrl("https://www.kitadi.co.ao/", slug),
      `https://www.kitadi.co.ao/produtos/${slug}`,
    );
  }
});

test("product slugs are encoded as one path segment", () => {
  assert.equal(
    getProductQRCodeUrl("https://www.kitadi.co.ao", "poupança / família?#"),
    "https://www.kitadi.co.ao/produtos/poupan%C3%A7a%20%2F%20fam%C3%ADlia%3F%23",
  );
});

test("local development preserves the browser origin and port", () => {
  assert.equal(getProductQRCodeUrl("http://localhost:3000"), "http://localhost:3000/produtos");
});

test("invalid site URLs and empty or traversal slugs fail instead of generating broken links", () => {
  for (const url of ["/produtos", "invalid", "javascript:alert(1)", "ftp://example.com", "https://user:pass@example.com"]) {
    assert.throws(() => getProductQRCodeUrl(url));
  }
  for (const slug of ["", " ", ".", ".."]) {
    assert.throws(() => getProductQRCodeUrl("https://www.kitadi.co.ao", slug));
  }
});

test("catalogue and product QR images are distinct downloadable 1024px PNGs", async () => {
  const urls = [
    getProductQRCodeUrl("https://www.kitadi.co.ao"),
    getProductQRCodeUrl("https://www.kitadi.co.ao", "financas-pessoais"),
    getProductQRCodeUrl("https://www.kitadi.co.ao", "novo-produto"),
  ];
  const images = await Promise.all(urls.map(generateQRCode));
  assert.equal(new Set(images).size, urls.length);
  for (const image of images) {
    assert.match(image, /^data:image\/png;base64,/);
    const png = Buffer.from(image.split(",")[1], "base64");
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), 1024);
    assert.equal(png.readUInt32BE(20), 1024);
  }
  assert.equal(await generateQRCode(urls[0]), images[0]);
});

test("QR encoding failures reject so the interface can offer a retry", async () => {
  await assert.rejects(generateQRCode("x".repeat(10000)));
});

test("the Kitadi logo badge is centred and covers well under the error-correction budget", () => {
  const size = 1024;
  const { badge, logo, rim } = getQrLogoLayout(size);
  assert.ok(Math.abs(badge.x * 2 + badge.width - size) <= 1);
  assert.ok(Math.abs(badge.y * 2 + badge.height - size) <= 1);
  assert.ok(logo.x >= badge.x && logo.x + logo.width <= badge.x + badge.width);
  assert.ok(logo.y >= badge.y && logo.y + logo.height <= badge.y + badge.height);
  const covered = ((badge.width + rim * 2) * (badge.height + rim * 2)) / (size * size);
  assert.ok(covered < 0.1, `badge covers ${(covered * 100).toFixed(1)}% of the QR`);
});
