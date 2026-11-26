// Administrative directory only; these entries do not imply available institutions.
// Source: https://github.com/modood/Administrative-divisions-of-China (WTFPL).
// The checked-in JSON is an offline snapshot; run this script explicitly to refresh.
import { writeFile } from 'node:fs/promises';
import { pinyin } from 'pinyin-pro';

const base = 'https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/';
const read = async (file) => {
  const response = await fetch(base + file);
  if (!response.ok) throw new Error(`Cannot load ${file}: ${response.status}`);
  return response.json();
};
const [provinces, cities, areas] = await Promise.all(['provinces.json', 'cities.json', 'areas.json'].map(read));
const provinceNames = new Map(provinces.map(p => [p.code, p.name]));
const records = cities.flatMap(city => {
  if (city.name === '县') return [];
  if (city.name.includes('直辖县级')) return areas.filter(a => a.cityCode === city.code).map(a => ({ ...a, provinceCode: city.provinceCode }));
  return [{ ...city, name: city.name === '市辖区' ? provinceNames.get(city.provinceCode) : city.name }];
});
const used = new Set();
const directory = records.map(city => {
  const name = city.name.replace(/市$/, '');
  const roman = pinyin(name, { toneType: 'none', type: 'array', v: true }).join('').replace(/[^a-z]/g, '');
  const slug = used.has(roman) ? `${roman}-${city.code}` : roman;
  used.add(slug);
  return { slug, name, province: provinceNames.get(city.provinceCode), pinyin: roman, initial: roman[0].toUpperCase() };
}).sort((a,b) => a.pinyin.localeCompare(b.pinyin));
await writeFile(new URL('../src/lib/generated/cities.json', import.meta.url), JSON.stringify(directory, null, 2) + '\n');
console.log(`Saved ${directory.length} cities and regions.`);
