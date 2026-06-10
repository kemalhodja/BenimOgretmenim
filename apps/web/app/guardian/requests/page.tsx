import { Suspense } from "react";
import StudentRequestsPage from "../../student/requests/page";

export default function GuardianRequestsPage() {
  return (
    <Suspense fallback={null}>
      <StudentRequestsPage />
    </Suspense>
  );
}
