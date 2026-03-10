import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User, Building2, MapPin, Microscope, Mail, Shield, Table2,
  ArrowLeft, Calendar
} from "lucide-react";

interface PublicProfile {
  id: string;
  name: string;
  handle: string;
  organisation?: string;
  roleTitle?: string;
  bio?: string;
  avatarUrl?: string;
  email?: string;
  contactVisibility: string;
  createdAt: string;
  healthRole?: string;
  regions: string[];
  interests: string[];
  tables: { id: string; title: string; purpose?: string }[];
}

export default function UserProfile() {
  const [, params] = useRoute("/app/users/:userId");
  const userId = params?.userId;
  const { user: currentUser } = useAuth();

  const { data: profile, isLoading, error } = useQuery<PublicProfile>({
    queryKey: ["/api/users", userId, "public-profile"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/public-profile`);
      if (!res.ok) throw new Error("User not found");
      return res.json();
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in-up">
        <Skeleton className="h-8 w-48" />
        <div className="bg-card border border-card-border rounded-xl p-6">
          <div className="flex items-start gap-5">
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-6 max-w-2xl mx-auto animate-fade-in-up">
        <div className="bg-muted/30 border border-border rounded-xl p-10 text-center">
          <User className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">This user could not be found or is no longer active.</p>
          <Link href="/app/tables">
            <Button variant="outline" size="sm" data-testid="button-back-tables">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Back to tables
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;
  const initials = profile.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const joinedDate = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground heading-rule" data-testid="text-user-profile-name">
            {profile.name}
          </h1>
          {profile.handle && (
            <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-user-profile-handle">
              @{profile.handle}
            </p>
          )}
        </div>
        {isOwnProfile && (
          <Link href="/app/profile">
            <Button variant="outline" size="sm" data-testid="button-edit-own-profile">
              Edit profile
            </Button>
          </Link>
        )}
      </div>

      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="p-6 flex items-start gap-5">
          <div className="flex-shrink-0">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-border"
                data-testid="img-user-avatar"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border"
                data-testid="img-user-avatar-placeholder"
              >
                <span className="text-primary text-xl font-semibold">{initials}</span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              {profile.roleTitle && (
                <span className="flex items-center gap-1 text-sm text-foreground/80" data-testid="text-user-role">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  {profile.roleTitle}
                </span>
              )}
              {profile.organisation && (
                <span className="flex items-center gap-1 text-sm text-foreground/80" data-testid="text-user-org">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {profile.organisation}
                </span>
              )}
            </div>

            {profile.email && (
              <div className="flex items-center gap-1.5 mb-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <a
                  href={`mailto:${profile.email}`}
                  className="text-sm text-primary hover:underline"
                  data-testid="link-user-email"
                >
                  {profile.email}
                </a>
              </div>
            )}

            {joinedDate && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Member since {joinedDate}
              </p>
            )}
          </div>
        </div>

        {profile.bio && (
          <div className="px-6 pb-5 border-t border-border pt-4">
            <p className="text-sm text-foreground/80 leading-relaxed" data-testid="text-user-bio">{profile.bio}</p>
          </div>
        )}
      </div>

      {(profile.regions.length > 0 || profile.interests.length > 0 || profile.healthRole) && (
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          {profile.healthRole && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Health role</span>
              </div>
              <p className="text-sm font-medium" data-testid="text-user-health-role">{profile.healthRole}</p>
            </div>
          )}

          {profile.regions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Regions</span>
              </div>
              <div className="flex flex-wrap gap-1.5" data-testid="list-user-regions">
                {profile.regions.map((r) => (
                  <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                ))}
              </div>
            </div>
          )}

          {profile.interests.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Microscope className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Disease interests</span>
              </div>
              <div className="flex flex-wrap gap-1.5" data-testid="list-user-interests">
                {profile.interests.map((i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {profile.tables.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Tables</span>
          </div>
          <div className="space-y-2">
            {profile.tables.map((table) => (
              <Link
                key={table.id}
                href={`/app/tables/${table.id}`}
                className="block p-3 rounded-lg border border-border hover:border-muted-foreground/30 transition-colors"
                data-testid={`link-user-table-${table.id}`}
              >
                <p className="text-sm font-medium text-foreground">{table.title}</p>
                {table.purpose && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{table.purpose}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
