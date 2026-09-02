"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ProfileSettingsProps {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

export function ProfileSettings({ user }: ProfileSettingsProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(user);
  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("Profile updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (passwords.newPass !== passwords.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.newPass,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("Password changed");
      setPasswords({ current: "", newPass: "", confirm: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your account details</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 max-w-md">
          <div>
            <Label>First name</Label>
            <Input value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />
          </div>
          <div>
            <Label>Last name</Label>
            <Input value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
          </div>
          <p className="text-sm text-muted-foreground">Role: {user.role}</p>
          <Button onClick={saveProfile} disabled={savingProfile}>Save profile</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 max-w-md">
          <Input type="password" placeholder="Current password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
          <Input type="password" placeholder="New password" value={passwords.newPass} onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })} />
          <Input type="password" placeholder="Confirm new password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
          <Button onClick={changePassword} disabled={savingPassword}>Update password</Button>
        </CardContent>
      </Card>
    </div>
  );
}
