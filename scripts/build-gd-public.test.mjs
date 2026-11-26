import test from "node:test";
import assert from "node:assert/strict";
import { buildProjection, validatePublicationApprovals } from "./build-gd-public.mjs";
import { SOURCES } from "./whitelist/sources.mjs";

const base = {
  id: 1,
  licenseNo: "244190170000001",
  name: "测试艺术培训中心",
  city: "东莞",
  citySlug: "dongguan",
  county: "莞城街道",
  address: "测试路 1 号",
  trainingType: "非学科类",
  projects: "美术",
  sourceKey: "dongguan-2025-annual-check",
  sourceUrl: "https://edu.dg.gov.cn/announcement.pdf",
  publisher: "东莞市教育局",
  title: "2025 年度检查结果",
  publishedAt: null,
  asOf: "2025-12-31",
  collectedAt: "2026-11-22T00:00:00Z",
  cityCodeMatch: 1,
};

const project = (rows, reviewRowIds = new Set()) =>
  buildProjection(rows, reviewRowIds, "2026-11-23T00:00:00.000Z");

test("排除待复核和许可证属地异常行，统计口径互斥", () => {
  const output = project([
    base,
    { ...base, id: 2, licenseNo: "244190170000002" },
    { ...base, id: 3, licenseNo: "244190170000003", cityCodeMatch: 0 },
  ], new Set([2]));

  assert.equal(output.records.length, 1);
  assert.deepEqual(output.stats, {
    rawRows: 3,
    excludedReview: 1,
    excludedCityCode: 1,
    excludedConflict: 0,
    excludedUnapproved: 0,
    deduplicated: 0,
    recordCount: 1,
    sourceCount: 1,
    cityCount: 1,
  });
});

test("同许可证异名全部排除，同名多来源仅保留最新名单观察日期", () => {
  const output = project([
    base,
    { ...base, id: 2, name: "测试体育培训中心" },
    { ...base, id: 3, licenseNo: "244190170000004", asOf: "2025-01-01" },
    { ...base, id: 4, licenseNo: "244190170000004", sourceKey: "shaoguan-ruyuan-2026-01", asOf: "2026-01-01" },
  ]);

  assert.equal(output.stats.excludedConflict, 2);
  assert.equal(output.stats.deduplicated, 1);
  assert.equal(output.records.length, 1);
  assert.equal(output.records[0].sourceKey, "shaoguan-ruyuan-2026-01");
  assert.equal(output.records[0].sourceKind, "official_whitelist");
});

test("年度检查来源显式分类，未知字段为 null，稳定 ID 不受来源变化影响", () => {
  const earlier = project([{ ...base, county: "", address: "", trainingType: "", projects: null, asOf: "", collectedAt: "" }]);
  const later = project([{ ...base, sourceKey: "shaoguan-ruyuan-2026-01", asOf: "2026-01-01" }]);

  assert.equal(earlier.records[0].sourceKind, "annual_check");
  assert.equal(earlier.sources[0].sourceKind, "annual_check");
  assert.equal(earlier.records[0].county, null);
  assert.equal(earlier.records[0].address, null);
  assert.equal(earlier.records[0].trainingType, null);
  assert.equal(earlier.records[0].projects, null);
  assert.equal(earlier.records[0].publishedAt, null);
  assert.equal(earlier.records[0].asOf, null);
  assert.equal(earlier.records[0].collectedAt, null);
  assert.equal(project([base]).records[0].asOf, "2025-12-31");
  assert.equal(project([base]).sources[0].asOf, "2025-12-31");
  assert.equal(earlier.records[0].id, later.records[0].id);
  assert.equal(project([{ ...base, sourceKey: "shenzhen-futian-2024-check" }]).records[0].sourceKind, "annual_check");
  assert.equal(project([{ ...base, sourceKey: "shaoguan-shixing-2025-annual" }]).records[0].sourceKind, "annual_check");
  assert.equal(project([{ ...base, sourceKey: "shaoguan-xinfeng-2025-10" }]).records[0].sourceKind, "after_school_reference");
  assert.equal(project([{ ...base, sourceKey: "zhaoqing-gaoyao-2025-12" }]).records[0].sourceKind, "single_license_notice");
});

test("未明确归类的新来源键不能默认为白名单", () => {
  assert.throws(() => project([{ ...base, sourceKey: "unknown-new-source" }]), /未分类来源/);
});

test("来源注册表所有键均已显式分类", () => {
  const kinds = SOURCES.map(({ key }) => project([{ ...base, sourceKey: key }]).records[0].sourceKind);
  assert.equal(kinds.filter((kind) => kind === "annual_check").length, 7);
  assert.equal(kinds.filter((kind) => kind === "official_whitelist").length, 16);
  assert.equal(kinds.filter((kind) => kind === "after_school_reference").length, 1);
  assert.equal(kinds.filter((kind) => kind === "single_license_notice").length, 3);
});

test("正式发布缺任何来源的逐源授权或证据时失败关闭", () => {
  const projection = project([base]);
  assert.throws(() => validatePublicationApprovals(projection, { sources: [] }), /没有通过/);
  assert.throws(() => validatePublicationApprovals(projection, {
    sources: [{ key: base.sourceKey, url: base.sourceUrl, approved: true, scope: "public_directory", basis: "written_permission", evidenceUrl: "", evidenceText: "同意展示", reviewedAt: "2026-11-23", qualityApproved: true, qualityNotes: "逐行核对原件", contentComplete: true, linkApproved: true }],
  }), /证据/);
  const result = validatePublicationApprovals(projection, {
    sources: [{ key: base.sourceKey, url: base.sourceUrl, approved: true, scope: "public_directory", basis: "written_permission", evidenceUrl: "https://example.gov.cn/permission", evidenceText: "明确允许在本平台公开展示该名录的机构字段", reviewedAt: "2026-11-23", qualityApproved: true, qualityNotes: "逐行核对原件", contentComplete: true, linkApproved: true }],
  });
  assert.deepEqual([...result.approvedSourceKeys], [base.sourceKey]);
});

test("有一个来源合格即可发布该来源，其余来源计入未批准且对账", () => {
  const second = { ...base, id: 2, licenseNo: "244190170000002", sourceKey: "shaoguan-ruyuan-2026-01", sourceUrl: "https://www.ruyuan.gov.cn/list.html" };
  const preview = project([base, second]);
  const decision = validatePublicationApprovals(preview, {
    sources: [{ key: second.sourceKey, url: second.sourceUrl, approved: true, scope: "public_directory", basis: "written_permission", evidenceUrl: "https://www.ruyuan.gov.cn/permission.html", evidenceText: "已获明确书面许可转载并链接来源", reviewedAt: "2026-11-23", qualityApproved: true, qualityNotes: "已核对名单行数与字段完整性", contentComplete: true, linkApproved: true }],
  });
  const release = buildProjection([base, second], new Set(), "2026-11-23T00:00:00Z", decision.approvedSourceKeys);
  assert.deepEqual(release.records.map((row) => row.sourceKey), [second.sourceKey]);
  assert.deepEqual(release.sources.map((source) => source.key), [second.sourceKey]);
  assert.equal(release.stats.excludedUnapproved, 1);
  assert.equal(release.stats.rawRows, 2);
  assert.equal(release.stats.recordCount, 1);
  assert.equal(release.stats.sourceCount, 1);
});

test("最新观察源未获批时，同号使用较早但已获批的来源", () => {
  const older = { ...base, asOf: "2025-01-01" };
  const newer = { ...base, id: 2, sourceKey: "shaoguan-ruyuan-2026-01", asOf: "2026-01-01" };
  const release = buildProjection([older, newer], new Set(), "2026-11-23T00:00:00Z", new Set([older.sourceKey]));
  assert.equal(release.records[0].sourceKey, older.sourceKey);
  assert.equal(release.stats.excludedUnapproved, 1);
  assert.equal(release.stats.deduplicated, 0);
});

test("内容审查缺失和深圳教育局仅有网站条款时都不能获批", () => {
  const source = { ...base, id: 2, licenseNo: "244030170000002", sourceKey: "shenzhen-city-2024-check", sourceUrl: "https://szeb.sz.gov.cn/attachment/annual.pdf" };
  const preview = project([base, source]);
  const valid = { key: base.sourceKey, url: base.sourceUrl, approved: true, scope: "public_directory", basis: "written_permission", evidenceUrl: "https://example.gov.cn/permission", evidenceText: "批准公开展示和链接", reviewedAt: "2026-11-23", qualityApproved: true, qualityNotes: "已核对完整性", contentComplete: true, linkApproved: true };
  const invalid = { ...valid, key: source.sourceKey, url: source.sourceUrl, basis: "site_terms" };
  const decision = validatePublicationApprovals(preview, { sources: [valid, invalid] });
  assert.deepEqual([...decision.approvedSourceKeys], [base.sourceKey]);
  assert.match(decision.rejectedSources.find((item) => item.key === source.sourceKey).reason, /书面许可/);
  assert.throws(() => validatePublicationApprovals(project([source]), { sources: [invalid] }), /没有通过.*书面许可/);
  assert.throws(() => validatePublicationApprovals(project([base]), { sources: [{ ...valid, qualityApproved: false }] }), /没有通过.*质量/);
  assert.throws(() => validatePublicationApprovals(project([base]), { sources: [{ ...valid, contentComplete: false }] }), /没有通过.*完整性/);
  assert.throws(() => validatePublicationApprovals(project([base]), { sources: [{ ...valid, qualityNotes: "" }] }), /没有通过.*质量/);
  assert.throws(() => validatePublicationApprovals(project([base]), { sources: [{ ...valid, linkApproved: false }] }), /没有通过.*链接/);
  assert.throws(() => validatePublicationApprovals(project([base]), { sources: [{ ...valid, basis: "site_terms" }] }), /没有通过.*未明确确认/);
  const ruyuan = { ...base, id: 3, licenseNo: "244538170000003", sourceKey: "shaoguan-ruyuan-2026-01", sourceUrl: "https://www.ruyuan.gov.cn/list.html" };
  const ruyuanDecision = validatePublicationApprovals(project([base, ruyuan]), { sources: [valid, { ...valid, key: ruyuan.sourceKey, url: ruyuan.sourceUrl, basis: "site_terms" }] });
  assert.deepEqual([...ruyuanDecision.approvedSourceKeys], [base.sourceKey]);
  assert.match(ruyuanDecision.rejectedSources.find((item) => item.key === ruyuan.sourceKey).reason, /书面许可/);
  for (const [key, url] of [
    ["yunfu-yunan-2026-09", "https://www.gdyunan.gov.cn/list.html"],
    ["yangjiang-yangchun-2026-04", "https://www.yangchun.gov.cn/list.html"],
    ["foshan-shunde-2025-27", "https://www.shunde.gov.cn/list.html"],
  ]) {
    const restricted = { ...base, id: 4, licenseNo: "244538170000004", sourceKey: key, sourceUrl: url };
    const decisionForDomain = validatePublicationApprovals(project([base, restricted]), {
      sources: [valid, { ...valid, key, url, basis: "site_terms", explicitReuseAllowed: true }],
    });
    assert.deepEqual([...decisionForDomain.approvedSourceKeys], [base.sourceKey]);
    assert.match(decisionForDomain.rejectedSources.find((item) => item.key === key).reason, /书面许可/);
  }
});
