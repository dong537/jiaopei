import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPublicRecords, getPublicCityStats, parsePageParam, projectionPath, previewModeActive } from '../src/lib/gd/public.ts';

const records = [
  { id: 'a', name: '甲艺术培训', licenseNo: '244010170000001', citySlug: 'guangzhou', city: '广州', county: '天河区', sourceKind: 'official_whitelist' },
  { id: 'b', name: '乙科技培训', licenseNo: '244010170000002', citySlug: 'guangzhou', city: '广州', county: '越秀区', sourceKind: 'official_whitelist' },
  { id: 'c', name: '甲艺术培训', licenseNo: '244190170000003', citySlug: 'dongguan', city: '东莞', county: '东城区', sourceKind: 'annual_check' },
];

test('城市、来源类别和名称筛选只返回相应官方观察', () => {
  const found = filterPublicRecords(records, { citySlug: 'guangzhou', sourceKind: 'official_whitelist', q: '甲', page: 1, pageSize: 20 });
  assert.equal(found.total, 1);
  assert.deepEqual(found.rows.map((r) => r.id), ['a']);
});

test('可按原文许可证号精准查到单条来源记录', () => {
  const found = filterPublicRecords(records, { q: '244010170000002' });
  assert.deepEqual(found.rows.map((r) => r.id), ['b']);
});

test('分页输入有上限且次序稳定', () => {
  const first = filterPublicRecords(records, { page: 1, pageSize: 1 });
  const second = filterPublicRecords(records, { page: 2, pageSize: 1 });
  assert.equal(first.total, 3);
  assert.equal(first.pages, 3);
  assert.notEqual(first.rows[0].id, second.rows[0].id);
  assert.equal(filterPublicRecords(records, { page: 100, pageSize: 1 }).rows.length, 1);
});

test('分页 URL 只接受规范正整数', () => {
  assert.equal(parsePageParam('2'), 2);
  for (const value of ['', '0', '-1', '2abc', '02', 'Infinity', '999999999999999999999999']) {
    assert.equal(parsePageParam(value), 1, value);
  }
});

test('地市统计按来源记录数而非推定机构数统计', () => {
  assert.deepEqual(getPublicCityStats(records), [
    { citySlug: 'guangzhou', city: '广州', records: 2 },
    { citySlug: 'dongguan', city: '东莞', records: 1 },
  ]);
});

test('生产环境绝不读取私有预览文件', () => {
  assert.match(projectionPath('development'), /gd-public-preview\.json$/);
  assert.match(projectionPath('production'), /gd-public-release\.json$/);
});

test('私有预览必须在非生产环境显式启用', () => {
  assert.equal(previewModeActive('development', undefined), false);
  assert.equal(previewModeActive('development', '1'), true);
  assert.equal(previewModeActive('production', '1'), false);
});
