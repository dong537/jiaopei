// 学校库：公办与民办中小学的客观登记信息，供家长在选课前了解学段和对口情况。
// 只收录可查证的字段（办学性质、学段、地址、主管部门），不排名、不打分、不收费、不接入驻。

export type School = {
  id: string;
  name: string;
  citySlug: string;
  district: string;
  nature: "公办" | "民办";
  stage: string;
  founded?: string;
  address: string;
  authority: string;
  source: string;
  checkedAt: string;
  notes: string[];
};

export const schools: School[] = [
  {
    id: "gz-tianhe-sy-xiaoxue",
    name: "广州市天河区示例实验小学",
    citySlug: "guangzhou",
    district: "天河区",
    nature: "公办",
    stage: "小学（1–6 年级）",
    founded: "1958",
    address: "天河区[街道门牌号]",
    authority: "广州市天河区教育局",
    source: "广州市天河区教育局义务教育学校名单",
    checkedAt: "2026-09-30",
    notes: ["对口地段以当年区教育局公布的招生地段表为准", "学校不参与教培网任何排名或推广"],
  },
  {
    id: "gz-yuexiu-sy-zhongxue",
    name: "广州市越秀区示例中学",
    citySlug: "guangzhou",
    district: "越秀区",
    nature: "公办",
    stage: "初中、高中",
    founded: "1954",
    address: "越秀区[街道门牌号]",
    authority: "广州市越秀区教育局",
    source: "广州市教育局普通高中学校名单",
    checkedAt: "2026-09-30",
    notes: ["高中招生计划与录取分数以当年中考招生指南为准"],
  },
  {
    id: "gz-haizhu-sy-waiguoyu",
    name: "广州市海珠区示例外国语学校",
    citySlug: "guangzhou",
    district: "海珠区",
    nature: "民办",
    stage: "初中",
    founded: "2003",
    address: "海珠区[街道门牌号]",
    authority: "广州市海珠区教育局",
    source: "广州市海珠区教育局民办学校办学许可名单",
    checkedAt: "2026-09-30",
    notes: ["民办学校收费标准以物价部门备案为准", "民办义务教育学校招生实行电脑派位"],
  },
  {
    id: "gz-panyu-sy-xiaoxue",
    name: "广州市番禺区示例小学",
    citySlug: "guangzhou",
    district: "番禺区",
    nature: "公办",
    stage: "小学（1–6 年级）",
    address: "番禺区[街道门牌号]",
    authority: "广州市番禺区教育局",
    source: "广州市番禺区教育局义务教育学校名单",
    checkedAt: "2026-09-30",
    notes: ["对口地段以当年区教育局公布的招生地段表为准"],
  },
  {
    id: "gz-baiyun-sy-zhongxue",
    name: "广州市白云区示例中学",
    citySlug: "guangzhou",
    district: "白云区",
    nature: "公办",
    stage: "初中",
    address: "白云区[街道门牌号]",
    authority: "广州市白云区教育局",
    source: "广州市白云区教育局义务教育学校名单",
    checkedAt: "2026-09-30",
    notes: ["对口地段以当年区教育局公布的招生地段表为准"],
  },
  {
    id: "gz-huangpu-sy-guoji",
    name: "广州市黄埔区示例国际课程学校",
    citySlug: "guangzhou",
    district: "黄埔区",
    nature: "民办",
    stage: "高中",
    founded: "2015",
    address: "黄埔区[街道门牌号]",
    authority: "广州市黄埔区教育局",
    source: "广州市黄埔区教育局民办学校办学许可名单",
    checkedAt: "2026-09-30",
    notes: ["开设国际课程的高中须同时完成国家课程方案", "收费标准以物价部门备案为准"],
  },
];

export const getSchool = (id: string) => schools.find((s) => s.id === id);

/** 校园照片位：按学校在名录中的顺序轮换底色，正式环境替换为学校公开照片 */
const photoTones = ["#dce6f5", "#ddefe6", "#e5e1f3", "#f5e6d8", "#dcEff3", "#f3e1e6"];
export const schoolPhoto = (s: School) => ({ label: "校园照片", tone: photoTones[Math.max(0, schools.findIndex((x) => x.id === s.id)) % photoTones.length] });
/** 占位图上的大字：取第一个学段 */
export const schoolGlyph = (s: School) => s.stage.split(/[、（]/)[0];
