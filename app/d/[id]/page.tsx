import type { Metadata } from "next";
import { PublicDocumentPage } from "@/app/components/documents/public-document-page";

export const metadata: Metadata = {
  title: "Document · Web OCR",
  description: "Shared document details",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  return <PublicDocumentPage key={id} id={id} />;
}
