import { supabase } from "./supabase";

export const careContactCategories = [
  "primary_care",
  "specialist",
  "pharmacy",
  "home_health",
  "insurance",
  "hospital_department",
  "other",
] as const;

export type CareContactCategory = (typeof careContactCategories)[number];

export const careContactCategoryLabels: Record<CareContactCategory, string> = {
  primary_care: "Primary doctor",
  specialist: "Specialist",
  pharmacy: "Pharmacy",
  home_health: "Home health",
  insurance: "Insurance",
  hospital_department: "Hospital department",
  other: "Other",
};

export const preferredContactMethods = [
  "phone",
  "email",
  "portal",
  "in_person",
  "other",
] as const;

export type PreferredContactMethod = (typeof preferredContactMethods)[number];

export const preferredContactMethodLabels: Record<PreferredContactMethod, string> = {
  phone: "Phone",
  email: "Email",
  portal: "Patient portal",
  in_person: "In person",
  other: "Other",
};

export type CareContact = {
  id: string;
  careRecipientId: string;
  category: CareContactCategory;
  providerName: string;
  organizationName: string;
  specialty: string;
  phone: string;
  email: string;
  address: string;
  preferredContactMethod: PreferredContactMethod;
  officeHours: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type CareContactInput = Omit<
  CareContact,
  "id" | "careRecipientId" | "createdAt" | "updatedAt"
>;

const selectFields =
  "id, care_recipient_id, category, provider_name, organization_name, specialty, phone, email, address, preferred_contact_method, office_hours, notes, created_at, updated_at";

function mapCareContact(row: any): CareContact {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    category: row.category as CareContactCategory,
    providerName: row.provider_name,
    organizationName: row.organization_name ?? "",
    specialty: row.specialty ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    preferredContactMethod:
      (row.preferred_contact_method as PreferredContactMethod) ?? "phone",
    officeHours: row.office_hours ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function clean(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function payload(input: CareContactInput) {
  return {
    category: input.category,
    provider_name: input.providerName.trim(),
    organization_name: clean(input.organizationName),
    specialty: clean(input.specialty),
    phone: clean(input.phone),
    email: clean(input.email.toLowerCase()),
    address: clean(input.address),
    preferred_contact_method: input.preferredContactMethod,
    office_hours: clean(input.officeHours),
    notes: clean(input.notes),
    updated_at: new Date().toISOString(),
  };
}

export async function loadCareContacts(
  careRecipientId: string,
): Promise<CareContact[]> {
  const { data, error } = await supabase
    .from("care_contacts")
    .select(selectFields)
    .eq("care_recipient_id", careRecipientId)
    .order("category", { ascending: true })
    .order("provider_name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapCareContact);
}

export async function createCareContact(
  careRecipientId: string,
  input: CareContactInput,
): Promise<CareContact> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { data, error } = await supabase
    .from("care_contacts")
    .insert({
      care_recipient_id: careRecipientId,
      created_by: user.id,
      ...payload(input),
    })
    .select(selectFields)
    .single();

  if (error) throw error;
  return mapCareContact(data);
}

export async function updateCareContact(
  careRecipientId: string,
  contactId: string,
  input: CareContactInput,
): Promise<CareContact> {
  const { data, error } = await supabase
    .from("care_contacts")
    .update(payload(input))
    .eq("id", contactId)
    .eq("care_recipient_id", careRecipientId)
    .select(selectFields)
    .single();

  if (error) throw error;
  return mapCareContact(data);
}

export async function deleteCareContact(
  careRecipientId: string,
  contactId: string,
) {
  const { error } = await supabase
    .from("care_contacts")
    .delete()
    .eq("id", contactId)
    .eq("care_recipient_id", careRecipientId);

  if (error) throw error;
}

export function careContactSearchText(contact: CareContact) {
  return [
    contact.providerName,
    contact.organizationName,
    contact.specialty,
    contact.phone,
    contact.email,
    contact.address,
    contact.officeHours,
    contact.notes,
    careContactCategoryLabels[contact.category],
  ]
    .join(" ")
    .toLowerCase();
}
