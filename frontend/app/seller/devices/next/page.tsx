import { Suspense } from "react";
import NextStepsClient from "./NextStepsClient";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NextStepsClient />
    </Suspense>
  );
}
