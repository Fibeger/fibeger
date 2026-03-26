import { getApiClient } from "../client";
import type { FileBlob } from "../types";

export function uploadFile(
  formData: FormData
): Promise<FileBlob | FileBlob[]> {
  return getApiClient().upload("/api/upload", formData);
}

export function uploadFiles(
  files: File[],
  folder?: string
): Promise<FileBlob[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  if (folder) formData.append("folder", folder);
  return getApiClient().upload<FileBlob[]>("/api/upload", formData);
}
