import { FilesWorkspace } from "@/components/files-workspace";
export const metadata = { title: "My files", robots: { index: false, follow: false } };
export default function Page() {
  return <FilesWorkspace />;
}
