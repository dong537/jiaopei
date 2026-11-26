import type { Offer } from "./types";

export type Session = { date: string; left: string; urgent?: boolean };

/** “剩 N 个名额”或“可报名”才能付款；“预约中”只能先预约 */
export const sessionOpen = (s: Session) => /剩 \d+ 个名额|可报名/.test(s.left);

/**
 * 报名价格：早鸟价按开班日期和截止日判断；推荐码 95 折需要填写推荐码。
 * 两种优惠不叠加，取对学员更低的一种。
 */
export function quote(courseId: string, price: number, session: Session | undefined, offers: Offer[] = [], today: string, code = "") {
  const options: { label: string; price: number }[] = [];
  for (const o of offers) {
    const d = o.discount;
    if (!d) continue;
    if (d.kind === "minus" && d.courseId === courseId && session?.date.startsWith(d.sessionDate) && today <= d.deadline) {
      options.push({ label: `${o.title}（${d.deadline} 前报名 ${d.sessionDate} 开班）`, price: price - d.amount });
    }
    if (d.kind === "rate" && code.trim().length >= 4) {
      options.push({ label: `${o.title}（推荐码 ${code.trim().toUpperCase()}）`, price: Math.round(price * d.rate) });
    }
  }
  options.sort((a, b) => a.price - b.price);
  return options[0] ?? { label: "", price };
}
