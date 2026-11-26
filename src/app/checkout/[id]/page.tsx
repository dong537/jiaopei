import Loading from "@/app/loading";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/CheckoutForm";
import { Breadcrumbs, Container } from "@/components/ui";
import { courses, getCourse, getOrg } from "@/lib/data";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "确认报名", robots: { index: false, follow: false } };

// 只有开通平台担保付款的机构课程才能在线报名
export function generateStaticParams() {
  return courses.filter((c) => getOrg(c.orgId)?.escrow).map((c) => ({ id: c.id }));
}

export default function CheckoutPage(props: PageProps<"/checkout/[id]">) {
  return <Suspense fallback={<Loading />}><CheckoutPageContent {...props} /></Suspense>;
}

async function CheckoutPageContent({ params }: PageProps<"/checkout/[id]">) {
  const course = getCourse((await params).id);
  const org = course && getOrg(course.orgId);
  if (!course || !org?.escrow) notFound();
  const sessions = course.sessions ?? [{ date: `${course.nextStart}${/\d/.test(course.nextStart) ? " 开班" : ""}`, left: "可报名" }];
  const refundRule =
    course.facts?.find((f) => f.label === "退费规则")?.value ?? "开课前全额退；开课后按未上课时比例退";

  return (
    <Container>
      <Breadcrumbs items={[{ name: org.name, href: `/org/${org.id}` }, { name: course.name, href: `/course/${course.id}` }, { name: "确认报名" }]} />
      <h1 className="mb-5 text-2xl font-bold text-ink">确认报名</h1>
      <Suspense fallback={<p className="text-muted">正在加载…</p>}>
        <CheckoutForm
          course={{ id: course.id, name: course.name, price: course.price, hours: course.hours, classLabel: course.classLabel }}
          org={{ id: org.id, name: org.name }}
          sessions={sessions}
          offers={org.offers ?? []}
          today={site.asOf}
          refundRule={refundRule}
        />
      </Suspense>
    </Container>
  );
}
