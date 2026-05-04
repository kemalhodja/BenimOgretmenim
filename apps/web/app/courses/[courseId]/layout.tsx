import type { Metadata } from "next";
import { publicSiteUrl } from "../../lib/siteUrl";
import {
  courseJsonLd,
  coursePageMetadata,
  getCoursePublicPayload,
  isCourseIdParam,
} from "./coursePublicMeta";

const siteUrl = publicSiteUrl();

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseId: string }>;
}): Promise<Metadata> {
  const { courseId } = await params;
  return coursePageMetadata(courseId, siteUrl);
}

export default async function CoursePublicLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}>) {
  const { courseId } = await params;
  if (!isCourseIdParam(courseId)) {
    return children;
  }
  const data = await getCoursePublicPayload(courseId);
  if (!data?.course) {
    return children;
  }
  const c = data.course;
  const jsonLd = courseJsonLd({
    courseId,
    siteUrl,
    title: c.title?.trim() || "Kurs",
    description: c.description,
    teacherName: c.teacher_display_name?.trim() || "Öğretmen",
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
