"use client";

import { useState } from "react";
import { KEYS, useStored } from "@/lib/demo-store";
import { CompareButton } from "./compare";
import { Icon, cx } from "./ui";

export function FavoriteButton({ id, className }: { id: string; className?: string }) {
  const [favs, setFavs] = useStored<string[]>(KEYS.favorites, []);
  const on = favs.includes(id);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => setFavs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
      className={cx("flex items-center gap-1 text-xs", on ? "text-cta" : "text-muted hover:text-brand", className)}
    >
      <Icon name="heart" className={cx("size-3.5", on && "fill-current")} />
      {on ? "已收藏" : "收藏"}
    </button>
  );
}

/**
 * 机构咨询入口。电话、微信都走平台转接：电话是虚拟号（可回溯、计入线索），
 * 微信是机构上传的企业微信二维码，在线咨询与预约同一张表单。
 */
export function OrgContact({ id, extension }: { id: string; extension: string }) {
  const [panel, setPanel] = useState<"" | "phone" | "wechat">("");
  const btn = "flex flex-col items-center gap-1 rounded-lg border py-2 text-xs";
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <a href="#booking" className={cx(btn, "border-line text-ink-2 hover:border-brand hover:text-brand")}>
          <Icon name="chat" />
          在线咨询
        </a>
        <button type="button" onClick={() => setPanel(panel === "phone" ? "" : "phone")} className={cx(btn, panel === "phone" ? "border-brand text-brand" : "border-line text-ink-2 hover:border-brand")}>
          <Icon name="phone" />
          电话咨询
        </button>
        <button type="button" onClick={() => setPanel(panel === "wechat" ? "" : "wechat")} className={cx(btn, panel === "wechat" ? "border-brand text-brand" : "border-line text-ink-2 hover:border-brand")}>
          <Icon name="chat" />
          微信咨询
        </button>
      </div>
      {panel === "phone" && (
        <div className="rounded-lg bg-brand-soft p-3 text-sm" role="status">
          <div className="font-semibold text-ink tabular">400-[XXX-XXXX] 转 {extension}</div>
          <div className="mt-0.5 text-xs leading-5 text-muted">平台虚拟号，接通后转到机构顾问；通话记录用于服务质量回访和线索计费申诉。</div>
        </div>
      )}
      {panel === "wechat" && (
        <div className="flex items-center gap-3 rounded-lg bg-brand-soft p-3 text-xs leading-5 text-muted" role="status">
          <div className="flex size-16 shrink-0 items-center justify-center rounded bg-white text-[10px] text-subtle">二维码</div>
          机构顾问企业微信，由机构上传、平台审核。添加后的咨询同样计入本机构线索。
        </div>
      )}
      <div className="flex items-center justify-between">
        <FavoriteButton id={id} />
        <CompareButton id={id} />
      </div>
    </>
  );
}
