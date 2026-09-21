import { TopBar } from "@/components/TopBar";
import { ProfileForm } from "@/components/ProfileForm";
import { requireUser } from "@/lib/auth";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div>
      <TopBar title="My profile" description="Your account details and password" />
      <div className="p-4 sm:p-8">
        <div className="max-w-lg">
          <ProfileForm email={user.email} fullName={user.fullName} role={user.role} />
        </div>
      </div>
    </div>
  );
}
