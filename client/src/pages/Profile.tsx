import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  User, Building2, MapPin, Microscope, FileText, Eye, EyeOff, Camera, Loader2,
  Globe, Lock, Users, Table2, Pencil, X, Check, Shield
} from "lucide-react";

const CONTACT_VISIBILITY_OPTIONS = [
  { value: "EVERYONE", label: "Everyone", description: "All TRYBE members can see your email", icon: Globe },
  { value: "MEMBERS_ONLY", label: "Table co-members only", description: "Only people who share a table with you", icon: Users },
  { value: "NOBODY", label: "Nobody", description: "Your email is completely hidden", icon: Lock },
];

export default function Profile() {
  const { user, profile, refetch: refetchAuth } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    organisation: "",
    roleTitle: "",
    bio: "",
    contactVisibility: "MEMBERS_ONLY",
  });

  const { data: fullProfile, isLoading: profileLoading } = useQuery<any>({
    queryKey: ["/api/profile"],
  });

  const { data: userTables, isLoading: tablesLoading } = useQuery<any[]>({
    queryKey: ["/api/tables/my"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const res = await apiRequest("PUT", "/api/user/profile", data);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated" });
      refetchAuth();
      qc.invalidateQueries({ queryKey: ["/api/profile"] });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setEditing(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const avatarMutation = useMutation({
    mutationFn: async (avatarUrl: string | null) => {
      const res = await apiRequest("PUT", "/api/user/avatar", { avatarUrl });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile photo updated" });
      refetchAuth();
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const startEditing = () => {
    setEditForm({
      name: user?.name || "",
      organisation: user?.organisation || "",
      roleTitle: user?.roleTitle || "",
      bio: user?.bio || "",
      contactVisibility: user?.contactVisibility || "MEMBERS_ONLY",
    });
    setEditing(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image must be under 2MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      avatarMutation.mutate(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  if (!user) return null;

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const joinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      })
    : null;

  const interests = fullProfile?.interests || profile?.interests || [];
  const regions = fullProfile?.regions || profile?.regions || [];
  const healthRole = fullProfile?.healthRole || profile?.collaborationMode;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground heading-rule">Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Your identity across TRYBE.</p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEditing} data-testid="button-edit-profile">
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit profile
          </Button>
        )}
      </div>

      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="p-6 flex items-start gap-5">
          <div className="relative group flex-shrink-0">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-border"
                data-testid="img-avatar"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border"
                data-testid="img-avatar-placeholder"
              >
                <span className="text-primary text-xl font-semibold">{initials}</span>
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              data-testid="button-change-avatar"
            >
              {avatarMutation.isPending ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              data-testid="input-avatar-upload"
            />
          </div>

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs mb-1">Name</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    data-testid="input-edit-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1">Role / Title</Label>
                    <Input
                      value={editForm.roleTitle}
                      onChange={(e) => setEditForm((f) => ({ ...f, roleTitle: e.target.value }))}
                      placeholder="e.g. Senior Research Fellow"
                      data-testid="input-edit-role"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1">Organisation</Label>
                    <Input
                      value={editForm.organisation}
                      onChange={(e) => setEditForm((f) => ({ ...f, organisation: e.target.value }))}
                      placeholder="e.g. WHO, MSF"
                      data-testid="input-edit-organisation"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-foreground" data-testid="text-profile-name">
                  {user.name}
                </h2>
                {user.handle && (
                  <p className="text-sm text-muted-foreground" data-testid="text-profile-handle">
                    @{user.handle}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  {user.roleTitle && (
                    <span className="flex items-center gap-1 text-sm text-foreground/80" data-testid="text-profile-role">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      {user.roleTitle}
                    </span>
                  )}
                  {user.organisation && (
                    <span className="flex items-center gap-1 text-sm text-foreground/80" data-testid="text-profile-org">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {user.organisation}
                    </span>
                  )}
                </div>
                {joinedDate && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Member since {joinedDate}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {editing ? (
          <div className="px-6 pb-6 space-y-4">
            <div>
              <Label className="text-xs mb-1">Short bio</Label>
              <Textarea
                value={editForm.bio}
                onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Tell others about your work, interests, and what brings you to TRYBE..."
                rows={3}
                maxLength={500}
                data-testid="input-edit-bio"
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {editForm.bio.length}/500
              </p>
            </div>

            <div>
              <Label className="text-xs mb-2 block">Contact visibility</Label>
              <div className="grid grid-cols-3 gap-2">
                {CONTACT_VISIBILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditForm((f) => ({ ...f, contactVisibility: opt.value }))}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      editForm.contactVisibility === opt.value
                        ? "bg-primary/5 border-primary"
                        : "bg-background border-border hover:border-muted-foreground/30"
                    }`}
                    data-testid={`button-visibility-${opt.value}`}
                  >
                    <opt.icon className={`h-4 w-4 mb-1.5 ${editForm.contactVisibility === opt.value ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-xs font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{opt.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={() => updateMutation.mutate(editForm)}
                disabled={updateMutation.isPending || !editForm.name.trim()}
                data-testid="button-save-profile"
              >
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                Save changes
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)} data-testid="button-cancel-edit">
                <X className="h-4 w-4 mr-1.5" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {user.bio && (
              <div className="px-6 pb-4">
                <p className="text-sm text-foreground/80 leading-relaxed" data-testid="text-profile-bio">{user.bio}</p>
              </div>
            )}
            {!user.bio && (
              <div className="px-6 pb-4">
                <p className="text-sm text-muted-foreground italic">No bio yet. Click "Edit profile" to add one.</p>
              </div>
            )}
          </>
        )}
      </div>

      {(regions.length > 0 || interests.length > 0 || healthRole) && (
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          {healthRole && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground">Health role</Label>
              </div>
              <p className="text-sm font-medium" data-testid="text-health-role">{healthRole}</p>
            </div>
          )}

          {regions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground">Regions</Label>
              </div>
              <div className="flex flex-wrap gap-1.5" data-testid="list-regions">
                {regions.map((r: string) => (
                  <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                ))}
              </div>
            </div>
          )}

          {interests.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Microscope className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground">Disease interests</Label>
              </div>
              <div className="flex flex-wrap gap-1.5" data-testid="list-interests">
                {interests.map((i: string) => (
                  <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>
                ))}
              </div>
            </div>
          )}

          {regions.length === 0 && interests.length === 0 && !healthRole && (
            <p className="text-sm text-muted-foreground italic">
              Complete your onboarding or visit Settings to add your health role, regions, and disease interests.
            </p>
          )}
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-1.5 mb-1">
          {user.contactVisibility === "EVERYONE" && <Globe className="h-3.5 w-3.5 text-muted-foreground" />}
          {user.contactVisibility === "MEMBERS_ONLY" && <Users className="h-3.5 w-3.5 text-muted-foreground" />}
          {user.contactVisibility === "NOBODY" && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          <Label className="text-xs text-muted-foreground">Contact visibility</Label>
        </div>
        <p className="text-sm" data-testid="text-contact-visibility">
          {CONTACT_VISIBILITY_OPTIONS.find((o) => o.value === (user.contactVisibility || "MEMBERS_ONLY"))?.label || "Members only"}
        </p>
        <p className="text-xs text-muted-foreground">
          {CONTACT_VISIBILITY_OPTIONS.find((o) => o.value === (user.contactVisibility || "MEMBERS_ONLY"))?.description}
        </p>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-5">
        <div className="flex items-center gap-1.5 mb-3">
          <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs text-muted-foreground">Joined tables</Label>
        </div>
        {tablesLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
          </div>
        ) : userTables && userTables.length > 0 ? (
          <div className="space-y-2">
            {userTables.map((table: any) => (
              <Link
                key={table.id}
                href={`/app/tables/${table.id}`}
                className="block p-3 rounded-lg border border-border hover:border-muted-foreground/30 transition-colors"
                data-testid={`link-table-${table.id}`}
              >
                <p className="text-sm font-medium text-foreground">{table.title}</p>
                {table.purpose && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{table.purpose}</p>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            You haven't joined any tables yet. <Link href="/app/tables" className="text-primary hover:underline">Browse tables</Link>
          </p>
        )}
      </div>
    </div>
  );
}
