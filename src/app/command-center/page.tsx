import { Admin } from "@/components/workspace/admin";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/services/auth";
export const metadata = { title: "Command center", robots: { index: false, follow: false } };
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN")
    return (
      <div className="error" role="alert">
        Administrator access required.
      </div>
    );
  return <Admin command />;
}
