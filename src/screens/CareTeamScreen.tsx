import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import {
  inviteCareTeamMember,
  loadCareSpaces,
  loadCareTeam,
  loadPendingCareInvitations,
  reinviteCareTeamMember,
  respondToCareInvitation,
  sendCareInvitationReminder,
  revokeCareTeamAccess,
  setActiveCareRecipient,
  updateCareTeamRole,
  type CareInvitation,
  type CareRole,
  type CareSpace,
  type CareTeamMember,
} from "../careTeam";
import { useCare } from "../store";
import { ProfileAvatar } from "../profileAvatar";
import {
  Button,
  C,
  Card,
  Field,
  Heading,
  Icon,
  Page,
  S,
  Section,
  Txt,
} from "../ui";
import { useNav } from "./MainScreens";

function roleLabel(role: CareRole) {
  return {
    owner: "Primary Advocate",
    caregiver: "Co-Caregiver",
    patient: "Care Recipient",
    viewer: "Family Member",
  }[role];
}

function statusLabel(status: CareTeamMember["status"]) {
  return {
    invited: "Invited",
    active: "Active",
    declined: "Declined",
    revoked: "Revoked",
  }[status];
}

function invitationStatusLabel(member: CareTeamMember) {
  if (member.status === "invited" && member.isExpired) return "Expired";
  return statusLabel(member.status);
}

function invitationDateLabel(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString();
}

function invitationWindowLabel(member: CareTeamMember) {
  if (member.status !== "invited" || !member.inviteExpiresAt) return "";

  const hours = Math.ceil(
    (new Date(member.inviteExpiresAt).getTime() - Date.now()) /
      (60 * 60 * 1000),
  );

  if (member.isExpired || hours <= 0) return "Invitation expired";
  if (hours < 24) return `Expires in ${hours}h`;

  const days = Math.ceil(hours / 24);
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

function reminderCoolingDown(member: CareTeamMember) {
  if (!member.lastRemindedAt) return false;
  return (
    Date.now() - new Date(member.lastRemindedAt).getTime() <
    24 * 60 * 60 * 1000
  );
}

function RolePicker({
  value,
  disabled,
  onChange,
}: {
  value: Exclude<CareRole, "owner">;
  disabled?: boolean;
  onChange: (role: Exclude<CareRole, "owner">) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {(["caregiver", "patient", "viewer"] as const).map((role) => (
        <Pressable
          key={role}
          disabled={disabled}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === role, disabled }}
          onPress={() => onChange(role)}
          style={[
            S.pill,
            {
              minHeight: 42,
              justifyContent: "center",
              paddingHorizontal: 14,
              backgroundColor: value === role ? C.purple : C.lavender,
              opacity: disabled ? 0.55 : 1,
            },
          ]}
        >
          <Text
            style={[
              S.h3,
              {
                fontSize: 12,
                color: value === role ? C.white : C.deep,
              },
            ]}
          >
            {roleLabel(role)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}


const P="#70338F", INK="#19163D", MUTED="#77728D";
function Glass({children,style,tint="#F1E4FB"}:{
  children:React.ReactNode;style?:any;tint?:string
}) {
 return <View style={[{backgroundColor:"#FBF8FDEA",borderColor:"#FFFFFF",borderWidth:1,
    borderRadius:27,padding:16,gap:13,overflow:"hidden",
    shadowColor:"#59356B",shadowOpacity:0.09,shadowRadius:17,
    shadowOffset:{width:0,height:8},elevation:2},style]}>
   <View pointerEvents="none" style={{position:"absolute",right:-70,top:-85,
     width:175,height:175,borderRadius:100,backgroundColor:tint,opacity:0.66}}/>
   <View pointerEvents="none" style={{position:"absolute",left:-55,bottom:-75,
     width:120,height:120,borderRadius:70,backgroundColor:"#EEDDF8",opacity:0.42}}/>
   {children}
 </View>;
}
function Chip({text,active=false}:{text:string;active?:boolean}){
 return <View style={{backgroundColor:active?"#E4F3EC":"#F1EDF5",
   borderRadius:30,paddingHorizontal:10,paddingVertical:7,
   flexDirection:"row",gap:5,alignItems:"center"}}>
   {active&&<View style={{height:7,width:7,borderRadius:4,backgroundColor:"#15986B"}}/>}
   <Text numberOfLines={1} style={{fontFamily:"DMSans_600SemiBold",
     fontSize:11,color:active?"#15966B":"#706584"}}>{text}</Text>
 </View>;
}
function MemberFace({member}:{member:CareTeamMember}){
 if(member.isCurrentUser)return <ProfileAvatar name={member.displayName} size={47}/>;
 return <View style={{height:47,width:47,borderRadius:24,alignItems:"center",
   justifyContent:"center",backgroundColor:"#EFE4F9",borderWidth:2,borderColor:"#FFFFFF"}}>
   <Text style={{color:P,fontSize:17,fontFamily:"DMSans_700Bold"}}>
     {(member.displayName.trim()[0]||"?").toUpperCase()}
   </Text></View>;
}
function ToolLink({title,detail,icon,onPress,tint="#F1E6FB"}:{
 title:string;detail:string;icon:string;onPress:()=>void;tint?:string
}){
 return <Pressable accessibilityRole="button" accessibilityLabel={title}
 onPress={onPress} style={({pressed})=>({opacity:pressed?0.72:1})}>
   <Glass tint={tint} style={{padding:15}}>
     <View style={{flexDirection:"row",alignItems:"center",gap:12}}>
       <View style={{width:44,height:44,borderRadius:16,alignItems:"center",
       justifyContent:"center",backgroundColor:tint}}>
       <Icon name={icon} size={22} color={P}/></View>
       <View style={{flex:1,gap:3}}>
         <Text style={{fontFamily:"DMSans_700Bold",fontSize:15,color:INK}}>{title}</Text>
         <Text style={{fontFamily:"DMSans_400Regular",fontSize:12,color:MUTED,
           lineHeight:18}}>{detail}</Text>
       </View>
       <Icon name="chevron-forward" size={19} color={P}/>
     </View>
   </Glass>
 </Pressable>;
}

export function CareTeamScreen() {
  const n = useNav();
  const { state, refresh: refreshCare } = useCare();
  const [spaces, setSpaces] = useState<CareSpace[]>([]);
  const [pending, setPending] = useState<CareInvitation[]>([]);
  const [members, setMembers] = useState<CareTeamMember[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [currentRole, setCurrentRole] = useState<CareRole>("viewer");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<Exclude<CareRole, "owner">>("caregiver");

  const recipientId = state.careRecipientId;

  const refresh = useCallback(async (clearMessage = false) => {
    setLoading(true);
    if (clearMessage) setMessage("");
    try {
      const [spaceRows, invitationRows] = await Promise.all([
        loadCareSpaces(),
        loadPendingCareInvitations(),
      ]);
      setSpaces(spaceRows);
      setPending(invitationRows);

      if (!recipientId) {
        setMembers([]);
        setCanManage(false);
        return;
      }

      const roster = await loadCareTeam(recipientId);

      setMembers(roster.members);
      setCanManage(roster.canManage);
      setCurrentRole(roster.currentRole);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the care team.",
      );
    } finally {
      setLoading(false);
    }
  }, [recipientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const invitationSummary = useMemo(() => {
    const managed = members.filter((member) => member.role !== "owner");
    return {
      pending: managed.filter(
        (member) => member.status === "invited" && !member.isExpired,
      ).length,
      expired: managed.filter(
        (member) => member.status === "invited" && member.isExpired,
      ).length,
      active: managed.filter((member) => member.status === "active").length,
      closed: managed.filter((member) =>
        ["declined", "revoked"].includes(member.status),
      ).length,
    };
  }, [members]);

  async function switchSpace(space: CareSpace) {
    if (space.active) return;
    setBusyId(`space-${space.careRecipientId}`);
    setMessage("");
    try {
      await setActiveCareRecipient(space.careRecipientId);
      await refreshCare();
      n.reset({ index: 0, routes: [{ name: "Main" }] });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not switch care profiles.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function respond(invitation: CareInvitation, action: "accept" | "decline") {
    setBusyId(`invite-${invitation.careRecipientId}`);
    setMessage("");
    try {
      await respondToCareInvitation(invitation.careRecipientId, action);
      if (action === "accept") {
        await refreshCare();
        n.reset({ index: 0, routes: [{ name: "Main" }] });
        return;
      }
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not update that invitation.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function invite() {
    if (!recipientId || !inviteName.trim() || !inviteEmail.trim()) return;
    setBusyId("invite-new");
    setMessage("");
    try {
      const result = await inviteCareTeamMember({
        careRecipientId: recipientId,
        displayName: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteName("");
      setInviteEmail("");
      setInviteRole("caregiver");
      setMessage(
        result.invitationEmailSent
          ? "Invitation email requested and a 14-day in-app invitation is ready. Access stays pending until they accept."
          : "A 14-day invitation is ready in their EnVizion account. Access stays pending until they accept.",
      );
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not send the care team invitation.",
      );
    } finally {
      setBusyId(null);
    }
  }


  if (loading && !spaces.length && !pending.length) {
    return <Page><ActivityIndicator color={P}/><Txt>Loading your care team…</Txt></Page>;
  }
  return <Page>
    <View style={{flexDirection:"row",alignItems:"center",gap:11,marginBottom:4}}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back"
        onPress={()=>n.goBack()} style={({pressed})=>({
          height:44,width:44,borderRadius:23,justifyContent:"center",
          alignItems:"center",backgroundColor:"#F6EDFBEA",
          borderWidth:1,borderColor:"#FFFFFF",opacity:pressed?0.65:1
        })}>
        <Icon name="arrow-back-outline" size={23} color={P}/>
      </Pressable>
      <View style={{flex:1,gap:4}}>
        <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit
          style={{fontFamily:"DMSans_700Bold",fontSize:21,color:INK}}>
          Care team & sharing
        </Text>
        <Text style={{fontFamily:"DMSans_400Regular",fontSize:12,
          lineHeight:17,color:MUTED}}>Care is easier when the right people can help.</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open profile settings"
        onPress={()=>n.navigate("Profile")} style={({pressed})=>({
          height:43,width:43,borderRadius:22,justifyContent:"center",
          alignItems:"center",backgroundColor:"#F7F0FB",
          borderWidth:1,borderColor:"#FFFFFF",opacity:pressed?0.65:1
        })}>
        <Icon name="settings-outline" size={22} color={P}/>
      </Pressable>
    </View>
    <Glass tint="#E7D3F7" style={{backgroundColor:"#F6EBFBDD"}}>
      <View style={{flexDirection:"row",alignItems:"center",gap:13}}>
        {state.careMode==="self" ? (
          <ProfileAvatar name={state.careRecipientName||state.name||"Care profile"} size={84}/>
        ) : (
          <View style={{height:84,width:84,borderRadius:42,borderWidth:4,
            borderColor:"#FFFFFF",backgroundColor:"#E9DAF7",alignItems:"center",
            justifyContent:"center"}}>
            <Text style={{fontFamily:"DMSans_700Bold",fontSize:29,color:P}}>
              {(state.careRecipientName.trim()[0]||"C").toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{flex:1,gap:5}}>
          <Text style={[S.eyebrow,{color:P,letterSpacing:1.5}]}>ACTIVE CARE PROFILE</Text>
          <Text numberOfLines={2} style={{fontFamily:"DMSans_700Bold",fontSize:23,
            color:INK}}>{state.careRecipientName||"Care profile"}</Text>
          <Text style={{fontFamily:"DMSans_600SemiBold",fontSize:12.5,
            color:"#615477"}}>{roleLabel(state.accessRole)} access</Text>
          <View style={{alignSelf:"flex-start"}}><Chip text="Active" active/></View>
        </View>
      </View>
      <Text style={{fontSize:12.5,lineHeight:19,color:MUTED,
        fontFamily:"DMSans_400Regular"}}>
        {state.accessRole==="viewer"||state.accessRole==="patient"?
          "View your shared care records in one secure space.":
          "Update shared care records and manage who has access."}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Edit your account profile picture"
        onPress={()=>n.navigate("Profile")} style={({pressed})=>({
        flexDirection:"row",alignItems:"center",gap:9,padding:8,
        backgroundColor:"#FFFFFFB9",borderRadius:20,opacity:pressed?0.7:1
      })}>
        <ProfileAvatar name={state.name||"My account"} size={33}/>
        <Text style={{flex:1,fontFamily:"DMSans_600SemiBold",fontSize:12,color:P}}>
          My profile picture
        </Text>
        <Icon name="camera-outline" size={18} color={P}/>
      </Pressable>
    </Glass>
    {Boolean(message)&&(
      <View style={{backgroundColor:"#F9F1FC",padding:13,borderRadius:17,
        borderWidth:1,borderColor:"#E7D4EE"}}>
        <Text accessibilityRole="alert" style={{fontSize:12.5,color:INK}}>{message}</Text>
      </View>
    )}
      {pending.length > 0 && (
        <>
          <Section title="Invitations waiting for you" />
          {pending.map((invitation) => (
            <Card
              key={invitation.careRecipientId}
              style={{
                backgroundColor: C.lavender,
                borderColor: "#DCCBE4",
                gap: 12,
              }}
            >
              <View style={S.between}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={S.eyebrow}>CARE TEAM INVITATION</Text>
                  <Text style={S.h2}>{invitation.careRecipientName}</Text>
                </View>
                <View style={[S.pill, { backgroundColor: C.white }]}>
                  <Text style={[S.small, { color: C.purple }]}>
                    {roleLabel(invitation.role)}
                  </Text>
                </View>
              </View>

              <Txt>
                {invitation.inviterName} invited you to join this care space as{" "}
                {roleLabel(invitation.role)}. Access stays inactive until you
                accept.
              </Txt>

              <View
                style={{
                  borderRadius: 16,
                  backgroundColor: "#FFFFFFA8",
                  padding: 12,
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <Icon name="person-add-outline" size={20} color={C.purple} />
                <Txt style={[S.small, { flex: 1 }]}>
                  Invited by {invitation.inviterName}
                </Txt>
              </View>

              <Button
                title={`Accept as ${roleLabel(invitation.role)}`}
                disabled={busyId !== null}
                icon="checkmark-circle-outline"
                onPress={() => void respond(invitation, "accept")}
              />
              <Button
                title="Decline invitation"
                secondary
                disabled={busyId !== null}
                onPress={() => void respond(invitation, "decline")}
              />
            </Card>
          ))}
        </>
      )}


    <Glass tint="#EEE3FB">
      <View style={{flexDirection:"row",alignItems:"center",gap:9}}>
        <View style={{height:42,width:42,borderRadius:16,backgroundColor:"#F1E7FC",
          justifyContent:"center",alignItems:"center"}}>
          <Icon name="people-outline" size={23} color={P}/>
        </View>
        <View style={{flex:1,gap:3}}>
          <Text accessibilityRole="header" style={{fontFamily:"DMSans_700Bold",
            fontSize:18,color:INK}}>People with access</Text>
          <Text style={{fontSize:11.5,color:MUTED}}>Your trusted care team</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh members"
          disabled={loading} onPress={()=>void refresh(true)}
          style={({pressed})=>({paddingVertical:10,paddingHorizontal:11,
            borderRadius:22,backgroundColor:"#FFFFFFBA",borderWidth:1,
            borderColor:"#F0E3F6",flexDirection:"row",alignItems:"center",
            gap:5,opacity:pressed||loading?0.6:1})}>
          <Icon name="refresh-outline" size={15} color={P}/>
          <Text style={{color:P,fontSize:11,fontFamily:"DMSans_600SemiBold"}}>Refresh</Text>
        </Pressable>
      </View>
      {!members.length&&<Text style={{color:MUTED,fontSize:12.5,lineHeight:19}}>
        No members are listed for this care profile yet.
      </Text>}
      {members.map(member=>(
        <View key={member.userId} style={{backgroundColor:"#FFFFFFE9",
          borderRadius:21,borderColor:"#FFFFFF",borderWidth:1,padding:11,gap:11}}>
          <Pressable accessibilityRole="button"
            accessibilityLabel={member.displayName+", "+roleLabel(member.role)+". Details"}
            accessibilityState={{expanded:expandedMember===member.userId}}
            onPress={()=>setExpandedMember(id=>id===member.userId?null:member.userId)}
            style={({pressed})=>({flexDirection:"row",alignItems:"center",gap:10,
              minHeight:52,opacity:pressed?0.73:1})}>
            <MemberFace member={member}/>
            <View style={{flex:1,gap:4}}>
              <Text numberOfLines={1} style={{fontFamily:"DMSans_700Bold",
                fontSize:14.5,color:INK}}>{member.displayName}</Text>
              <Text numberOfLines={1} style={{fontFamily:"DMSans_400Regular",
                fontSize:12,color:MUTED}}>{roleLabel(member.role)}</Text>
            </View>
            <Chip text={invitationStatusLabel(member)} active={member.status==="active"}/>
            <Icon name={expandedMember===member.userId?"chevron-up":"chevron-forward"}
              size={17} color="#897B96"/>
          </Pressable>
          {expandedMember===member.userId&&(
            <View style={{gap:12,borderTopWidth:1,borderColor:"#F0E7F5",paddingTop:10}}>
              {Boolean(member.email)&&<Text selectable style={{fontSize:12,color:MUTED}}>
                {member.email}
              </Text>}
          {member.status === "invited" && (
            <View
              style={{
                borderRadius: 16,
                backgroundColor: member.isExpired ? "#FFF7ED" : "#F8F3FA",
                padding: 12,
                gap: 5,
              }}
            >
              <View style={S.between}>
                <Text style={[S.small, { fontFamily: "DMSans_600SemiBold" }]}>
                  {invitationWindowLabel(member)}
                </Text>
                {member.inviteExpiresAt && (
                  <Text style={S.small}>
                    {member.isExpired ? "Expired " : "Expires "}
                    {invitationDateLabel(member.inviteExpiresAt)}
                  </Text>
                )}
              </View>
              <Txt style={S.small}>
                {member.emailRequestedAt
                  ? `Email requested ${invitationDateLabel(member.emailRequestedAt)} · in-app invitation ready`
                  : "In-app invitation ready"}
              </Txt>
              {member.lastRemindedAt && (
                <Txt style={S.small}>
                  Last reminder {new Date(member.lastRemindedAt).toLocaleString()}
                </Txt>
              )}
            </View>
          )}

          {canManage && member.role !== "owner" && (
            <>
              <RolePicker
                value={member.role as Exclude<CareRole, "owner">}
                disabled={busyId !== null || member.status === "revoked"}
                onChange={async (role) => {
                  if (!recipientId) return;
                  setBusyId(member.userId);
                  try {
                    await updateCareTeamRole({
                      careRecipientId: recipientId,
                      userId: member.userId,
                      role,
                    });
                    await refresh();
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "We could not change that role.",
                    );
                  } finally {
                    setBusyId(null);
                  }
                }}
              />

              {member.status === "invited" && !member.isExpired && (
                <Button
                  title={
                    reminderCoolingDown(member)
                      ? "Reminder sent recently"
                      : "Send invitation reminder"
                  }
                  secondary
                  disabled={busyId !== null || reminderCoolingDown(member)}
                  icon="notifications-outline"
                  onPress={async () => {
                    if (!recipientId) return;
                    setBusyId(`reminder-${member.userId}`);
                    setMessage("");
                    try {
                      await sendCareInvitationReminder(
                        recipientId,
                        member.userId,
                      );
                      setMessage(
                        `Reminder sent to ${member.displayName} in EnVizion Life.`,
                      );
                      await refresh();
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "We could not send that reminder.",
                      );
                    } finally {
                      setBusyId(null);
                    }
                  }}
                />
              )}

              {member.status === "invited" && member.isExpired ? (
                <Button
                  title="Re-open invitation"
                  secondary
                  disabled={busyId !== null}
                  icon="refresh-outline"
                  onPress={async () => {
                    if (!recipientId) return;
                    setBusyId(`reinvite-${member.userId}`);
                    try {
                      await reinviteCareTeamMember(recipientId, member.userId);
                      setMessage(
                        `A fresh 14-day invitation is ready for ${member.displayName}.`,
                      );
                      await refresh();
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "We could not re-open that invitation.",
                      );
                    } finally {
                      setBusyId(null);
                    }
                  }}
                />
              ) : member.status === "active" || member.status === "invited" ? (
                <Button
                  title="Revoke access"
                  secondary
                  disabled={busyId !== null}
                  onPress={async () => {
                    if (!recipientId) return;
                    setBusyId(member.userId);
                    try {
                      await revokeCareTeamAccess(recipientId, member.userId);
                      await refresh();
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "We could not revoke access.",
                      );
                    } finally {
                      setBusyId(null);
                    }
                  }}
                />
              ) : (
                <Button
                  title="Invite again"
                  secondary
                  disabled={busyId !== null}
                  onPress={async () => {
                    if (!recipientId) return;
                    setBusyId(member.userId);
                    try {
                      await reinviteCareTeamMember(recipientId, member.userId);
                      setMessage(
                        `A fresh 14-day invitation is ready for ${member.displayName}.`,
                      );
                      await refresh();
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "We could not send another invitation.",
                      );
                    } finally {
                      setBusyId(null);
                    }
                  }}
                />
              )}
            </>
          )}

            </View>
          )}
        </View>
      ))}
    </Glass>

    {canManage&&recipientId&&(
      <Glass tint="#F3E8FA">
        <View style={{flexDirection:"row",gap:11,alignItems:"center"}}>
          <View style={{width:43,height:43,borderRadius:16,
            backgroundColor:"#F0E4FB",justifyContent:"center",alignItems:"center"}}>
            <Icon name="person-add-outline" size={23} color={P}/>
          </View>
          <View style={{flex:1,gap:3}}>
            <Text accessibilityRole="header" style={{fontFamily:"DMSans_700Bold",
              fontSize:18,color:INK}}>Invite someone you trust</Text>
            <Text style={{fontSize:12,color:MUTED}}>Add a family member or caregiver.</Text>
          </View>
        </View>
        <View style={{flexDirection:"row",alignItems:"center",gap:10,
          backgroundColor:"#FFFFFF",borderRadius:21,borderColor:"#E7DAEF",
          borderWidth:1,paddingHorizontal:14,minHeight:52}}>
          <Icon name="person-outline" size={19} color="#93849F"/>
          <TextInput accessibilityLabel="Full name" placeholder="Full name"
            placeholderTextColor="#9A8EA6" autoCapitalize="words"
            value={inviteName} onChangeText={setInviteName} editable={busyId===null}
            style={{flex:1,minWidth:0,minHeight:52,fontSize:14,color:INK,
              fontFamily:"DMSans_400Regular"}}/>
        </View>
        <View style={{flexDirection:"row",alignItems:"center",gap:10,
          backgroundColor:"#FFFFFF",borderRadius:21,borderColor:"#E7DAEF",
          borderWidth:1,paddingHorizontal:14,minHeight:52}}>
          <Icon name="mail-outline" size={19} color="#93849F"/>
          <TextInput accessibilityLabel="Email address" placeholder="Email address"
            placeholderTextColor="#9A8EA6" autoCapitalize="none" autoCorrect={false}
            keyboardType="email-address" value={inviteEmail} onChangeText={setInviteEmail}
            editable={busyId===null}
            style={{flex:1,minWidth:0,minHeight:52,fontSize:14,color:INK,
              fontFamily:"DMSans_400Regular"}}/>
        </View>
        <Text style={{fontFamily:"DMSans_700Bold",fontSize:13,color:INK}}>Access level</Text>
        <RolePicker value={inviteRole} disabled={busyId!==null} onChange={setInviteRole}/>
        <Text style={{fontFamily:"DMSans_400Regular",fontSize:11.5,
          lineHeight:18,color:MUTED}}>
          {inviteRole==="caregiver"?"Can view and update shared records.":
           inviteRole==="patient"?"Can view their shared care record.":
           "Can read shared updates, without changing medical data."}
        </Text>
        <Button title={busyId==="invite-new"?"Sending invitation…":"Send invitation"}
          icon="person-add-outline"
          disabled={busyId!==null||!inviteName.trim()||!inviteEmail.trim()}
          onPress={()=>void invite()}/>
      </Glass>
    )}

    {recipientId&&(
      <Glass tint="#F2E8F9">
        <View style={{flexDirection:"row",alignItems:"center",gap:11}}>
          <View style={{width:44,height:44,borderRadius:16,
            backgroundColor:"#FAECEF",justifyContent:"center",alignItems:"center"}}>
            <Icon name="swap-horizontal-outline" size={24} color={P}/>
          </View>
          <View style={{flex:1,gap:4}}>
            <Text accessibilityRole="header" style={{fontSize:17,
              color:INK,fontFamily:"DMSans_700Bold"}}>Primary Advocate handover</Text>
            <Text style={{fontSize:12,color:MUTED,lineHeight:18}}>
              Transfer responsibility with a clear permissions review.
            </Text>
          </View>
          <Icon name="chevron-forward" color={P} size={19}/>
        </View>
        <Button title="Review handover" secondary
          onPress={()=>n.navigate("AdvocateHandover")}/>
      </Glass>
    )}
    <Pressable accessibilityRole="button" accessibilityLabel="More sharing tools"
      accessibilityState={{expanded:showTools}}
      onPress={()=>setShowTools(old=>!old)}
      style={({pressed})=>({flexDirection:"row",gap:10,alignItems:"center",
        borderRadius:21,backgroundColor:"#F2E9F8",
        borderWidth:1,borderColor:"#E6D8EE",padding:15,
        opacity:pressed?0.75:1})}>
      <Icon name="settings-outline" size={21} color={P}/>
      <Text style={{flex:1,fontFamily:"DMSans_700Bold",fontSize:14.5,color:P}}>
        More sharing tools
      </Text>
      <Icon name={showTools?"chevron-up":"chevron-down"} size={19} color={P}/>
    </Pressable>
    {showTools&&(
      <View style={{gap:13}}>
        <Glass>
          <Text accessibilityRole="header" style={[S.h3,{color:INK}]}>Your care spaces</Text>
          {!spaces.length&&<Txt>No care spaces yet.</Txt>}
          {spaces.map(space=>(
            <Pressable key={space.careRecipientId} accessibilityRole="button"
              accessibilityLabel={space.active?space.careRecipientName+", active":
                "Switch to "+space.careRecipientName}
              disabled={space.active||busyId!==null}
              onPress={()=>void switchSpace(space)}
              style={({pressed})=>({backgroundColor:"#FFFFFFCC",padding:12,
                borderRadius:17,flexDirection:"row",gap:12,alignItems:"center",
                opacity:pressed?0.7:1})}>
              <View style={{flex:1,gap:4}}>
                <Text style={[S.h3,{fontSize:14}]}>{space.careRecipientName}</Text>
                <Text style={S.small}>{space.relationship} · {roleLabel(space.role)}</Text>
              </View>
              {space.active?<Chip text="Active" active/>:
                <Icon name="swap-horizontal-outline" size={20}/>}
            </Pressable>
          ))}
        </Glass>
        {canManage&&recipientId&&(
          <Glass>
            <Text accessibilityRole="header" style={[S.h3,{color:INK}]}>
              Invitation management
            </Text>
            <View style={{flexDirection:"row",flexWrap:"wrap",gap:7}}>
              {([
                ["Pending",invitationSummary.pending],
                ["Active",invitationSummary.active],
                ["Expired",invitationSummary.expired],
                ["Closed",invitationSummary.closed],
              ] as const).map(([label,value])=>(
                <View key={label} style={{flexGrow:1,minWidth:67,alignItems:"center",
                  borderRadius:15,padding:10,backgroundColor:"#FFFFFFC9"}}>
                  <Text style={[S.h3,{fontSize:18}]}>{value}</Text>
                  <Text style={S.small}>{label}</Text>
                </View>
              ))}
            </View>
            <Text style={{fontSize:11.5,lineHeight:18,color:MUTED}}>
              Invitations last 14 days. Reminders can be sent once every 24 hours.
              “Email requested” means EnVizion handed the invite to the email provider;
              it does not claim that the message was delivered or opened.
            </Text>
          </Glass>
        )}
        {canManage&&(
          <>
            <ToolLink title="Periodic Access Recertification" detail="90-day access review: keep access, change role or revoke it."
              icon="calendar-outline" tint="#EAF3EE"
              onPress={()=>n.navigate("CareAccessRecertification")}/>
            <ToolLink title="Care Team Security Review"
              detail="Check permissions and invitation issues."
              icon="shield-checkmark-outline" tint="#F9ECE0"
              onPress={()=>n.navigate("CareTeamSecurityReview")}/>
          </>
        )}
        <ToolLink title="Care Team Activity Center" detail="Review access and care activity."
          icon="time-outline" onPress={()=>n.navigate("CareTeamActivity")}/>
      </View>
    )}
  </Page>;
}
