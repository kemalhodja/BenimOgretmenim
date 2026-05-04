import type { Metadata } from "next";
import { publicSiteUrl } from "../../lib/siteUrl";
import {
  getTeacherPublicPayload,
  teacherJsonLd,
  teacherPageMetadata,
  isTeacherIdParam,
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
  if (!isTeacherIdParam(teacherId)) {
    return children;
  }
  const data = await getTeacherPublicPayload(teacherId);
  if (!data?.teacher) {
    return children;
  }
  const t = data.teacher;
  const jsonLd = teacherJsonLd({
    teacherId,
    siteUrl,
    name: t.display_name?.trim() || "Öğretmen",
    description: t.bio_raw,
    cityName: t.city_name,
  });

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- Schema.org JSON-LD
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
