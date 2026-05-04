import { notFound } from "next/navigation";
import { SketchifyClient } from "./_sketchify-client";

export default function SketchifyPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SketchifyClient />;
}
