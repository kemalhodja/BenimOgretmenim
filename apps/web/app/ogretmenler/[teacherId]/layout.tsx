import type { Metadata } from "next";
import { publicSiteUrl } from "../../lib/siteUrl";
import {
  getTeacherPublicPayload,
  teacherJsonLd,
  teacherPageMetadata,
  extractTeacherIdParam,
} from "./teacherPublicMeta";

const siteUrl = publicSiteUrl();

export async function generateMetadata({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}): Promise<Metadata> {
  const { teacherId } = await params;
  return teacherPageMetadata(teacherId, siteUrl);
}

export default async function OgretmenProfileLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ teacherId: string }>;
}>) {
  const { teacherId } = await params;
  const canonicalTeacherId = extractTeacherIdParam(teacherId);
  if (!canonicalTeacherId) {
    return children;
  }
  const data = await getTeacherPublicPayload(canonicalTeacherId);
  if (!data?.teacher) {
    return children;
  }
  const t = data.teacher;
  const jsonLd = teacherJsonLd({
    teacherId: canonicalTeacherId,
    siteUrl,
    name: t.display_name?.trim() || "Öğretmen",
    description: t.bio_raw,
    cityName: t.city_name,
    branchName: t.profile_site?.primaryBranchName,
    priceLabel: t.profile_site?.priceLabel,
    faq: t.profile_site?.faq,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
