import { notFound, redirect } from "next/navigation";
import { gdCityMap } from "@/lib/gd/categories";

/** 旧版依据工商名称推断类别，官方名单没有同等类别字段；旧链接回到城市目录。 */
export default async function LegacyCategoryPage({ params }: { params: Promise<{ city: string; category: string }> }) {
  const { city } = await params;
  if (!gdCityMap.has(city)) notFound();
  redirect("/gd/" + city);
}
