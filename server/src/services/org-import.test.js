// pV2-IMPORT-ORG-01 (BE-00127) — parser + SSRF-guard unit tests. Pure, no network
// (parseOrgFromHtml runs off an inline HTML fixture). Mirrors the spec acceptance.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseOrgFromHtml, _internals } = require('./org-import.service');

// A representative homepage: JSON-LD Organization (the source of truth) PLUS an
// og:description + meta description that DIFFER, to prove JSON-LD wins.
const HOMEPAGE = `<!doctype html><html><head>
  <title>Yahire — Event Hire London</title>
  <meta name="description" content="PAGE META — should lose to JSON-LD">
  <meta property="og:site_name" content="Yahire OG">
  <meta property="og:description" content="OG DESC — should lose to JSON-LD">
  <meta property="og:image" content="https://yahire.com/og.jpg">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@graph":[
    {"@type":"WebSite","name":"ignore me"},
    {"@type":["Organization","LocalBusiness"],
     "name":"Yahire",
     "description":"Yahire is London's furniture and catering equipment hire company.",
     "url":"https://www.yahire.com",
     "logo":"https://yahire.com/logo.png",
     "image":["https://yahire.com/cover.jpg"],
     "telephone":"+44 20 8965 5305",
     "email":"info@yahire.com",
     "address":{"@type":"PostalAddress","streetAddress":"Unit 13 Cranford Way","addressLocality":"London","addressCountry":"GB"}}
  ]}
  </script></head>
  <body><footer>Yahire Ltd. Company number 7602218. VAT reg no 123 4567 89.</footer></body></html>`;

describe('pV2-IMPORT-ORG-01 parseOrgFromHtml', () => {
  const { org, source } = parseOrgFromHtml(HOMEPAGE, { isHomepage: true, url: 'https://www.yahire.com/some/path' });

  test('name from JSON-LD (high)', () => {
    assert.equal(org.name.value, 'Yahire');
    assert.equal(org.name.confidence, 'high');
  });

  test('description from JSON-LD, NOT og/meta (high)', () => {
    assert.equal(org.description.value, "Yahire is London's furniture and catering equipment hire company.");
    assert.equal(org.description.confidence, 'high');
  });

  test('website normalized to origin (high)', () => {
    assert.equal(org.website.value, 'https://www.yahire.com');
  });

  test('logo + cover from JSON-LD (high)', () => {
    assert.equal(org.logo_url.value, 'https://yahire.com/logo.png');
    assert.equal(org.cover_image_url.value, 'https://yahire.com/cover.jpg');
  });

  test('address / city / country from PostalAddress (medium)', () => {
    assert.equal(org.address.value, 'Unit 13 Cranford Way');
    assert.equal(org.city.value, 'London');
    assert.equal(org.city.confidence, 'medium');
    assert.equal(org.country.value, 'GB');
  });

  test('phone + email from JSON-LD (high)', () => {
    assert.equal(org.phone.value, '+44 20 8965 5305');
    assert.equal(org.email.value, 'info@yahire.com');
  });

  test('company_number + vat from footer regex (low)', () => {
    assert.equal(org.company_number.value, '7602218');
    assert.equal(org.company_number.confidence, 'low');
    assert.ok(org.vat_number.value.replace(/\s/g, '').startsWith('123456789'));
    assert.equal(org.vat_registered.value, 'true');
  });

  test('currency inferred GBP from GB country (low)', () => {
    assert.equal(org.default_currency.value, 'GBP');
    assert.equal(org.default_currency.confidence, 'low');
  });

  test('source flags reflect what matched', () => {
    assert.equal(source.jsonLd, true);
    assert.equal(source.og, true);
  });
});

describe('pV2-IMPORT-ORG-01 homepage-only meta guard', () => {
  // A product page: NO Organization JSON-LD, only a product-copy meta description.
  const PRODUCT = `<html><head><title>Chiavari Chair</title>
    <meta name="description" content="Gold chiavari chair, £2.50 each — product copy">
    </head><body></body></html>`;

  test('off-homepage: meta description is NOT used as the org description', () => {
    const { org } = parseOrgFromHtml(PRODUCT, { isHomepage: false, url: 'https://x.com/p/chair' });
    assert.equal(org.description, undefined, 'no description (product meta ignored off homepage)');
  });

  test('on-homepage: meta description IS used (medium) when no JSON-LD', () => {
    const { org } = parseOrgFromHtml(PRODUCT, { isHomepage: true, url: 'https://x.com' });
    assert.equal(org.description.value, 'Gold chiavari chair, £2.50 each — product copy');
    assert.equal(org.description.confidence, 'medium');
  });
});

describe('pV2-IMPORT-ORG-01 SSRF guard', () => {
  const { isPrivateIp, assertSafeUrl } = _internals;

  test('isPrivateIp classifies ranges', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.10', '172.16.0.1', '169.254.1.1', '::1']) {
      assert.equal(isPrivateIp(ip), true, `${ip} should be private`);
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34']) {
      assert.equal(isPrivateIp(ip), false, `${ip} should be public`);
    }
  });

  test('assertSafeUrl rejects non-http, loopback, and private IPs', async () => {
    await assert.rejects(() => assertSafeUrl('ftp://example.com'), /http\(s\)/i);
    await assert.rejects(() => assertSafeUrl('http://localhost/x'), /private|loopback/i);
    await assert.rejects(() => assertSafeUrl('http://127.0.0.1'), /private/i);
    await assert.rejects(() => assertSafeUrl('http://192.168.1.5'), /private/i);
  });

  test('assertSafeUrl accepts a public IP literal', async () => {
    const u = await assertSafeUrl('https://8.8.8.8/');
    assert.equal(u.hostname, '8.8.8.8');
  });
});
