import { supabase } from "./supabase";

export const practicalHelpTypes = ["transport","groceries","errands","companionship","other"] as const;
export type PracticalHelpType = typeof practicalHelpTypes[number];
export type FamilyHelpStatus = "offered" | "accepted" | "declined";
export const practicalHelpLabels: Record<PracticalHelpType,string> = {
  transport:"Transportation", groceries:"Groceries", errands:"Errands",
  companionship:"Companionship", other:"Other practical help",
};
export type FamilyHelpOffer = {
  id:string; care_recipient_id:string; created_by:string;
  help_type:PracticalHelpType; note:string; status:FamilyHelpStatus;
  reviewed_by:string|null; reviewed_at:string|null; created_at:string;
};

export function validatePracticalHelp(type:string,note:string): string|null {
  if(!practicalHelpTypes.includes(type as PracticalHelpType)) return "Choose a practical way to help.";
  if(note.trim().length>500) return "Please keep your message within 500 characters.";
  return null;
}

export async function loadFamilyHelpOffers(careRecipientId:string):Promise<FamilyHelpOffer[]> {
  const {data,error}=await supabase.from("family_help_offers")
    .select("id,care_recipient_id,created_by,help_type,note,status,reviewed_by,reviewed_at,created_at")
    .eq("care_recipient_id",careRecipientId).order("created_at",{ascending:false}).limit(100);
  if(error)throw error;
  return (data??[]) as FamilyHelpOffer[];
}

export async function offerFamilyHelp(careRecipientId:string,type:PracticalHelpType,note:string):Promise<void> {
  const invalid=validatePracticalHelp(type,note);
  if(invalid) throw new Error(invalid);
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user) throw new Error("Sign in to offer practical help.");
  const {error}=await supabase.from("family_help_offers").insert({
    care_recipient_id:careRecipientId,created_by:user.id,help_type:type,note:note.trim(),
  });
  if(error)throw error;
}

export async function reviewFamilyHelpOffer(offerId:string,status:"accepted"|"declined"):Promise<void> {
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user) throw new Error("Sign in to review help offers.");
  const {data,error}=await supabase.from("family_help_offers")
    .update({status,reviewed_by:user.id,reviewed_at:new Date().toISOString()})
    .eq("id",offerId).eq("status","offered").select("id").maybeSingle();
  if(error)throw error;
  if(!data)throw new Error("This offer is no longer available for review.");
}
