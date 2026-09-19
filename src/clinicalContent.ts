import type { Guide } from "./content";
import { supabase } from "./supabase";
import { getStaffMembership, type StaffRole } from "./staff";

export type ClinicalStatus =
  | "draft"
  | "clinical_review"
  | "approved"
  | "published";

export type ClinicalSection = {
  title: string;
  body: string;
};

export type ClinicalContentRecord = Guide & {
  uuid: string;
  status: ClinicalStatus;
  version: number;
  reviewNotes: string;
  reviewedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

export type ClinicalContentVersion = {
  id: string;
  version: number;
  action: string;
  snapshot: {
    slug?: string;
    title?: string;
    category?: string;
    description?: string;
    icon?: string;
    read_time?: string;
    sections?: ClinicalSection[];
    source_url?: string | null;
    status?: ClinicalStatus;
    review_notes?: string | null;
  };
  createdAt: string;
};

function mapContent(row: any): ClinicalContentRecord {
  return {
    uuid: row.id,
    id: row.slug,
    title: row.title,
    category: row.category,
    description: row.description ?? "",
    icon: row.icon || "book-outline",
    readTime: row.read_time || "3 min read",
    sections: Array.isArray(row.sections)
      ? row.sections.map((section: any) => ({
          title: String(section?.title ?? ""),
          body: String(section?.body ?? ""),
        }))
      : [],
    ...(row.source_url ? { url: row.source_url } : {}),
    status: row.status as ClinicalStatus,
    version: Number(row.version ?? 1),
    reviewNotes: row.review_notes ?? "",
    reviewedAt: row.reviewed_at ?? null,
    approvedAt: row.approved_at ?? null,
    publishedAt: row.published_at ?? null,
    updatedAt: row.updated_at,
  };
}

const contentSelect =
  "id, slug, title, category, description, icon, read_time, sections, source_url, status, version, review_notes, reviewed_at, approved_at, published_at, updated_at";

export async function loadPublishedGuides(): Promise<ClinicalContentRecord[]> {
  const { data, error } = await supabase
    .from("clinical_content")
    .select(contentSelect)
    .eq("status", "published")
    .order("category", { ascending: true })
    .order("title", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapContent);
}

export async function loadPublishedGuide(
  slug: string,
): Promise<ClinicalContentRecord | null> {
  const { data, error } = await supabase
    .from("clinical_content")
    .select(contentSelect)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw error;
  return data ? mapContent(data) : null;
}

export async function loadManagedClinicalContent(): Promise<{
  role: StaffRole;
  items: ClinicalContentRecord[];
}> {
  const membership = await getStaffMembership();

  if (
    !membership ||
    !["admin", "advocate"].includes(membership.role)
  ) {
    throw new Error("Clinical content requires Advocate or Admin access.");
  }

  const { data, error } = await supabase
    .from("clinical_content")
    .select(contentSelect)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return {
    role: membership.role,
    items: (data ?? []).map(mapContent),
  };
}

export async function loadClinicalContentItem(
  contentId: string,
): Promise<ClinicalContentRecord> {
  const { data, error } = await supabase
    .from("clinical_content")
    .select(contentSelect)
    .eq("id", contentId)
    .single();

  if (error) throw error;
  return mapContent(data);
}

export async function loadClinicalContentVersions(
  contentId: string,
): Promise<ClinicalContentVersion[]> {
  const { data, error } = await supabase
    .from("clinical_content_versions")
    .select("id, version, action, snapshot, created_at")
    .eq("content_id", contentId)
    .order("version", { ascending: false })
    .limit(30);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    version: Number(row.version),
    action: row.action,
    snapshot: row.snapshot ?? {},
    createdAt: row.created_at,
  }));
}

async function mutateClinicalContent<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    "clinical-content-admin",
    { body },
  );

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function saveClinicalContent(
  content: ClinicalContentRecord,
): Promise<ClinicalContentRecord> {
  const result = await mutateClinicalContent<{ content: any }>({
    action: "save",
    contentId: content.uuid,
    title: content.title,
    category: content.category,
    description: content.description,
    icon: content.icon,
    readTime: content.readTime,
    sections: content.sections,
    sourceUrl: content.url ?? "",
    reviewNotes: content.reviewNotes,
  });

  return mapContent(result.content);
}

export async function submitClinicalContentForReview(contentId: string) {
  const result = await mutateClinicalContent<{ content: any }>({
    action: "submit_review",
    contentId,
  });
  return mapContent(result.content);
}

export async function returnClinicalContentToDraft(contentId: string) {
  const result = await mutateClinicalContent<{ content: any }>({
    action: "return_draft",
    contentId,
  });
  return mapContent(result.content);
}

export async function approveClinicalContent(
  contentId: string,
  reviewNotes: string,
) {
  const result = await mutateClinicalContent<{ content: any }>({
    action: "approve",
    contentId,
    reviewNotes,
  });
  return mapContent(result.content);
}

export async function publishClinicalContent(contentId: string) {
  const result = await mutateClinicalContent<{ content: any }>({
    action: "publish",
    contentId,
  });
  return mapContent(result.content);
}
