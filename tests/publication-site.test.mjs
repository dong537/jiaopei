import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicationSiteUrl, resolveSiteUrl } from '../src/lib/site.ts';

test('本机预览不用未经核验的第三方域名', () => {
  assert.equal(resolveSiteUrl(undefined), 'http://127.0.0.1:3111');
});

test('正式发布要求显式配置 HTTPS 站点域名', () => {
  assert.throws(() => assertPublicationSiteUrl(undefined), /NEXT_PUBLIC_SITE_URL/);
  assert.throws(() => assertPublicationSiteUrl('http://example.org'), /HTTPS/);
  assert.throws(() => assertPublicationSiteUrl('https://localhost:3111'), /正式发布域名/);
  assert.equal(assertPublicationSiteUrl('https://example.org/'), 'https://example.org');
});
