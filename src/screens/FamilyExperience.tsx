import React,{useCallback,useEffect,useRef,useState} from "react";
import {AccessibilityInfo,ActivityIndicator,Animated,Pressable,Text,TextInput,View,useWindowDimensions,Platform} from "react-native";
import {useFocusEffect} from "@react-navigation/native";
import {useCare} from "../store";
import {useAuth} from "../auth";
import {useAppearance} from "../appearance";
import {C,S,Page,Brand,Icon,Button} from "../ui";
import {themeBackground,themeBorder,themeForeground,themeShadow} from "../themeColors";
import {ProfileAvatar} from "../profileAvatar";
import {HomeJourneyArtwork} from "../components/HomeJourneyArtwork";
import {HomeGlassOrb} from "../components/HomeGlassMotion";
import {useNav} from "./MainScreens";
import {loadFamilyCommunicationCenter,familyUpdateTypeLabels,type FamilyUpdate} from "../familyCommunication";
import {loadFamilyHelpOffers,offerFamilyHelp,practicalHelpLabels,practicalHelpTypes,type PracticalHelpType,type FamilyHelpOffer} from "../familyHelp";
import {supabase} from "../supabase";

const TEXT="DMSans_400Regular",SEMI="DMSans_600SemiBold",BOLD="DMSans_700Bold";
const VIOLET="#70338F";

function FamilyReveal({children,delay=0}:{children:React.ReactNode;delay?:number}){
  const opacity=useRef(new Animated.Value(1)).current;
  const translate=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    let active=true;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced=>{
      if(!active||reduced)return;
      opacity.setValue(0);translate.setValue(13);
      Animated.parallel([
        Animated.timing(opacity,{toValue:1,duration:420,delay,useNativeDriver:Platform.OS!=="web"}),
        Animated.timing(translate,{toValue:0,duration:420,delay,useNativeDriver:Platform.OS!=="web"}),
      ]).start();
    }).catch(()=>{});
    return()=>{active=false;opacity.stopAnimation();translate.stopAnimation();};
  },[opacity,translate,delay]);
  return <Animated.View style={{opacity,transform:[{translateY:translate}]}}>{children}</Animated.View>;
}
function FamilyCard({children}:{children:React.ReactNode}){
  return <View style={{padding:19,gap:12,borderRadius:26,borderWidth:1,
    borderColor:themeBorder("#E9DEEF"),backgroundColor:themeBackground("#FFFEFF"),
    shadowColor:themeShadow("#6B4A7F"),shadowOpacity:0.075,
    shadowRadius:16,shadowOffset:{width:0,height:7},elevation:2,overflow:"hidden"}}>
    {children}
  </View>;
}
function FamilyHeading({eyebrow,title,description}:{eyebrow:string;title:string;description?:string}){
  return <View style={{gap:9,paddingTop:6}}>
    <Text style={[S.eyebrow,{letterSpacing:2.6,color:themeForeground(VIOLET)}]}>{eyebrow}</Text>
    <Text accessibilityRole="header" style={{fontFamily:"Lora_500Medium",fontSize:29,
      lineHeight:37,color:themeForeground("#18163C")}}>{title}</Text>
    {description&&<Text style={[S.body,{fontSize:14.5}]}>{description}</Text>}
  </View>;
}
function FamilyAction({title,subtitle,icon,onPress}:{
  title:string;subtitle:string;icon:string;onPress:()=>void;
}){
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
    style={({pressed})=>({minHeight:110,borderRadius:25,
      borderWidth:1,borderColor:themeBorder("#E9DDF1"),
      backgroundColor:themeBackground("#FFFDFF"),padding:16,gap:8,
      opacity:pressed?0.78:1,shadowColor:themeShadow("#6D4786"),
      shadowOpacity:0.07,shadowRadius:12,shadowOffset:{width:0,height:6},elevation:2})}>
    <View style={{height:38,width:38,borderRadius:14,backgroundColor:themeBackground("#F1E5FA"),
      alignItems:"center",justifyContent:"center"}}>
      <Icon name={icon} size={21} color={themeForeground("#78359E")}/>
    </View>
    <Text style={{fontFamily:BOLD,fontSize:15,color:C.ink}}>{title}</Text>
    <Text style={[S.small,{lineHeight:17}]}>{subtitle}</Text>
  </Pressable>;
}
function FamilyUpdateCard({update}:{update:FamilyUpdate}){
  return <FamilyCard>
    <View style={[S.between,{alignItems:"flex-start"}]}>
      <View style={{paddingHorizontal:11,paddingVertical:7,borderRadius:18,
        backgroundColor:themeBackground("#F1E6F8")}}>
        <Text style={[S.eyebrow,{fontSize:10,color:themeForeground(VIOLET)}]}>
          {familyUpdateTypeLabels[update.updateType]||"Care update"}
        </Text>
      </View>
      {update.priority!=="routine"&&<Text style={[S.small,{color:themeForeground("#A04266")}]}>Important</Text>}
    </View>
    <Text style={[S.h3,{fontSize:17,lineHeight:23}]}>{update.title}</Text>
    <Text style={[S.body,{fontSize:14,lineHeight:22}]}>{update.body}</Text>
    <Text style={S.small}>{new Date(update.createdAt).toLocaleString()}</Text>
  </FamilyCard>;
}
function FamilyStatus({loading,error,empty}:{
  loading:boolean;error:string;empty:string;
}){
  if(loading)return <ActivityIndicator color={C.purple}/>;
  if(error)return <FamilyCard><Text accessibilityRole="alert" style={[S.body,{color:C.rose}]}>{error}</Text></FamilyCard>;
  return <FamilyCard><Icon name="heart-outline" size={28}/><Text style={S.body}>{empty}</Text></FamilyCard>;
}

export function FamilyHomeScreen(){
  const {state}=useCare(),n=useNav(),{signOut}=useAuth();
  const {width}=useWindowDimensions();
  const height=width<375?370:405;
  const day=new Date().getHours(),when=day<12?"morning":day<18?"afternoon":"evening";
  const first=(state.name||"").trim().split(/\s+/)[0]||"family";
  const [latest,setLatest]=useState<FamilyUpdate[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  useFocusEffect(useCallback(()=>{
    let active=true;setLatest([]);setError("");setLoading(true);
    if(state.careRecipientId){
      void loadFamilyCommunicationCenter(state.careRecipientId).then(x=>{
        if(active)setLatest(x.updates.slice(0,2));
      }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not load updates.");})
        .finally(()=>{if(active)setLoading(false);});
    }else setLoading(false);
    return()=>{active=false;};
  },[state.careRecipientId]));
  return <Page>
    <FamilyReveal>
      <View style={[S.between,{paddingBottom:9}]}>
        <Brand/>
        <Pressable accessibilityRole="button" accessibilityLabel="Sign out of EnVizion Life"
          onPress={()=>void signOut()}
          style={{borderRadius:28,backgroundColor:themeBackground("#F1E8F8"),padding:7}}>
          <ProfileAvatar name={state.name||"Family Member"} size={42}/>
        </Pressable>
      </View>
    </FamilyReveal>
    <FamilyReveal delay={70}>
      <View style={{height,marginHorizontal:-20,position:"relative",overflow:"hidden",
        backgroundColor:themeBackground("#FFFDFC")}}>
        <View pointerEvents="none" style={{position:"absolute",top:0,bottom:0,left:0,right:0}}>
          <HomeJourneyArtwork height={height}/>
        </View>
        <HomeGlassOrb id="a" size={37} delay={320} style={{top:65,right:58}}/>
        <HomeGlassOrb id="b" size={24} delay={1800} style={{bottom:75,right:17}}/>
        <View style={{paddingHorizontal:23,paddingTop:32,maxWidth:width-18,gap:0}}>
          <Text style={[S.eyebrow,{letterSpacing:2.7,color:themeForeground("#77718D"),marginBottom:18}]}>
            YOUR FAMILY CARE JOURNEY
          </Text>
          <Text accessibilityRole="header" style={{
            fontFamily:"Lora_500Medium",fontSize:width<375?44:53,
            lineHeight:width<375?53:62,letterSpacing:-2,
            color:themeForeground("#101338")}}>
            Good{"\n"}{when},{"\n"}{first}.
          </Text>
          <Text style={{fontFamily:TEXT,fontSize:15,lineHeight:23,
            color:themeForeground("#77738A"),maxWidth:285,marginTop:17}}>
            Stay connected to the care that matters, wherever you are.
          </Text>
          <View style={{backgroundColor:themeBackground("#C47CDB"),width:37,
            height:3,borderRadius:3,marginTop:15}}/>
        </View>
      </View>
    </FamilyReveal>
    <FamilyReveal delay={110}>
      <FamilyCard>
        <View style={S.row}><Icon name="people-outline" size={24}/>
          <View style={{flex:1,gap:4}}>
            <Text style={[S.eyebrow,{color:themeForeground(VIOLET)}]}>CONNECTED CARE PROFILE</Text>
            <Text style={[S.h2,{fontSize:21}]}>{state.careRecipientName||"No care profile selected"}</Text>
            <Text style={S.small}>Family Member · Approved access only</Text>
          </View>
        </View>
      </FamilyCard>
    </FamilyReveal>
    <FamilyReveal delay={160}>
      <FamilyHeading eyebrow="FAMILY CARE TOOLS" title="Together in every moment."
        description="Four ways to stay informed and offer support."/>
      <View style={{flexDirection:"row",gap:12,flexWrap:"wrap"}}>
        {[
          {title:"Care updates",subtitle:"Read updates from the care team",icon:"newspaper-outline" as const,go:()=>n.navigate("Main",{screen:"FamilyUpdates"})},
          {title:"Care Team Chat",subtitle:"Message authorized caregivers",icon:"chatbubbles-outline" as const,go:()=>n.navigate("CareTeamChat",{careRecipientId:state.careRecipientId??undefined})},
          {title:"Appointments",subtitle:"See shared visit details",icon:"calendar-outline" as const,go:()=>n.navigate("FamilyAppointments")},
          {title:"Offer practical help",subtitle:"Volunteer to support the family",icon:"hand-left-outline" as const,go:()=>n.navigate("Main",{screen:"FamilyHelp"})},
        ].map(item=><View key={item.title} style={{width:"48%",flexGrow:1,flexBasis:"40%"}}>
          <FamilyAction {...item} onPress={item.go}/>
        </View>)}
      </View>
    </FamilyReveal>
    <FamilyReveal delay={220}>
      <View style={S.between}><Text style={S.h2}>Latest care updates</Text>
        <Pressable accessibilityRole="button" onPress={()=>n.navigate("Main",{screen:"FamilyUpdates"})}>
          <Text style={{fontFamily:SEMI,color:themeForeground(VIOLET)}}>View all →</Text>
        </Pressable>
      </View>
      {loading||error||!latest.length?<FamilyStatus loading={loading} error={error}
        empty="Your care team's shared updates will appear here."/>:
        latest.map(x=><FamilyUpdateCard key={x.id} update={x}/>)}
    </FamilyReveal>
    <Text style={[S.small,{textAlign:"center"}]}>Family access is read-only for clinical care records.</Text>
  </Page>;
}

export function FamilyUpdatesScreen(){
  const {state}=useCare(),[updates,setUpdates]=useState<FamilyUpdate[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState("");
  useFocusEffect(useCallback(()=>{
    let active=true;setLoading(true);setError("");setUpdates([]);
    if(!state.careRecipientId){setLoading(false);return()=>{active=false;};}
    void loadFamilyCommunicationCenter(state.careRecipientId)
      .then(result=>{if(active)setUpdates(result.updates);})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not load approved updates.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[state.careRecipientId]));
  return <Page>
    <FamilyHeading eyebrow="FAMILY COMMUNICATION" title="Care updates, made clear."
      description="Only updates shared by your authorized care team appear here."/>
    {loading||error||!updates.length?<FamilyStatus loading={loading} error={error}
      empty="No care updates have been shared with you yet."/>:
      updates.map(update=><FamilyUpdateCard key={update.id} update={update}/>)}
  </Page>;
}
type SharedAppointment={
  id:string;title:string;appointment_date:string|null;appointment_time:string|null;
  starts_at:string|null;location:string|null;
};
function appointmentDate(item:SharedAppointment){
  return String(item.appointment_date||item.starts_at||"").slice(0,10);
}
export function FamilyAppointmentsScreen(){
  const {state}=useCare(),[items,setItems]=useState<SharedAppointment[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState("");
  useFocusEffect(useCallback(()=>{
    let active=true;setItems([]);setError("");setLoading(true);
    if(!state.careRecipientId){setLoading(false);return()=>{active=false;};}
    Promise.resolve(supabase.from("appointments")
      .select("id,title,appointment_date,appointment_time,starts_at,location")
      .eq("care_recipient_id",state.careRecipientId)
      .order("created_at",{ascending:false}).limit(100))
      .then(({data,error:problem})=>{
        if(!active)return;
        if(problem)throw problem;
        setItems((data??[]) as SharedAppointment[]);
      }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not load shared appointments.");})
        .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[state.careRecipientId]));
  const today=new Date(),todayKey=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const upcoming=items.filter(x=>!appointmentDate(x)||appointmentDate(x)>=todayKey)
    .sort((a,b)=>(appointmentDate(a)||"9999").localeCompare(appointmentDate(b)||"9999"));
  const earlier=items.filter(x=>appointmentDate(x)&&appointmentDate(x)<todayKey)
    .sort((a,b)=>appointmentDate(b).localeCompare(appointmentDate(a)));
  const render=(x:SharedAppointment)=><FamilyCard key={x.id}>
    <View style={S.row}><Icon name="calendar-outline" size={23}/>
      <Text style={[S.h3,{flex:1}]}>{x.title}</Text>
    </View>
    <Text style={S.body}>{x.appointment_date||
      (x.starts_at?new Date(x.starts_at).toLocaleDateString():"Date to be confirmed")}
      {x.appointment_time?" · "+x.appointment_time.slice(0,5):""}</Text>
    <Text style={S.small}>{x.location||"Location to be confirmed"}</Text>
  </FamilyCard>;
  return <Page>
    <FamilyHeading eyebrow="SHARED APPOINTMENTS" title="Looking ahead."
      description="View visit details shared through the care profile. Only caregivers can edit appointments."/>
    {loading||error||!items.length?<FamilyStatus loading={loading} error={error}
      empty="No appointments have been shared with you yet."/>:<>
      <Text style={S.h2}>Upcoming visits</Text>
      {upcoming.length?upcoming.map(render):<FamilyStatus loading={false} error="" empty="No upcoming visits."/>}
      {earlier.length>0&&<><Text style={S.h2}>Previous visits</Text>{earlier.slice(0,15).map(render)}</>}
    </>}
  </Page>;
}
export function FamilyChatScreen(){
  const {state}=useCare(),n=useNav();
  return <Page>
    <FamilyHeading eyebrow="CARE TEAM CHAT" title="Stay close, stay connected."
      description="Speak privately with authorized members of your care team."/>
    <FamilyCard>
      <Icon name="chatbubbles-outline" size={35}/>
      <Text style={S.h2}>Your family conversation</Text>
      <Text style={S.body}>Messages are available only to people who currently have permission to join this care profile.</Text>
      <Button title="Open Care Team Chat" icon="chatbubbles-outline"
        onPress={()=>n.navigate("CareTeamChat",{careRecipientId:state.careRecipientId??undefined})}/>
    </FamilyCard>
  </Page>;
}
export function FamilyHelpScreen(){
  const {state}=useCare(),[type,setType]=useState<PracticalHelpType>("transport"),
    [note,setNote]=useState(""),[offers,setOffers]=useState<FamilyHelpOffer[]>([]),
    [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),
    [error,setError]=useState(""),[success,setSuccess]=useState("");
  const load=useCallback(async()=>{
    if(!state.careRecipientId){setOffers([]);return;}
    setOffers(await loadFamilyHelpOffers(state.careRecipientId));
  },[state.careRecipientId]);
  useFocusEffect(useCallback(()=>{
    let active=true;setLoading(true);
    void load().catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load offers.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[load]));
  async function submit(){
    if(!state.careRecipientId||busy)return;
    setBusy(true);setError("");setSuccess("");
    try{
      await offerFamilyHelp(state.careRecipientId,type,note);
      setNote("");await load();setSuccess("Your offer was sent to the care team for review.");
    }catch(e){setError(e instanceof Error?e.message:"Could not submit the offer.");}
    finally{setBusy(false);}
  }
  return <Page>
    <FamilyHeading eyebrow="FAMILY SUPPORT" title="Little acts, big difference."
      description="Let the caregivers know how you can help with everyday, non-medical activities."/>
    <FamilyCard>
      <Text style={S.h2}>Offer practical help</Text>
      <Text style={S.body}>Choose a way to help. Your care team can accept or decline your offer.</Text>
      <View style={{flexDirection:"row",flexWrap:"wrap",gap:9}}>
        {practicalHelpTypes.map(choice=><Pressable key={choice} accessibilityRole="radio"
          accessibilityState={{selected:choice===type}}
          onPress={()=>setType(choice)} style={{borderRadius:19,paddingHorizontal:14,
            minHeight:42,justifyContent:"center",borderColor:themeBorder("#DDCEE7"),borderWidth:1,
            backgroundColor:themeBackground(choice===type?"#E8D6F5":"#FCF9FF")}}>
          <Text style={[S.h3,{fontSize:12,color:themeForeground("#683387")}]}>
            {practicalHelpLabels[choice]}
          </Text>
        </Pressable>)}
      </View>
      <Text style={S.h3}>Details (optional)</Text>
      <TextInput accessibilityLabel="Describe the help you can offer" value={note}
        onChangeText={setNote} placeholder="For example, I can drive on Monday."
        maxLength={500} multiline textAlignVertical="top"
        placeholderTextColor={themeForeground("#91849D")}
        style={{minHeight:105,borderRadius:20,borderWidth:1,padding:14,
          borderColor:themeBorder("#E7DCEF"),color:C.ink,
          backgroundColor:themeBackground("#FFFEFF"),fontFamily:TEXT}}/>
      <Text style={[S.small,{textAlign:"right"}]}>{note.length}/500</Text>
      {Boolean(error)&&<Text accessibilityRole="alert" style={{color:C.rose}}>{error}</Text>}
      {Boolean(success)&&<Text accessibilityRole="alert" style={{color:C.green}}>{success}</Text>}
      <Button title={busy?"Sending your offer…":"Send offer to care team"} disabled={busy||!state.careRecipientId}
        icon="heart-outline" onPress={()=>void submit()}/>
    </FamilyCard>
    <Text style={S.h2}>My offers</Text>
    {loading?<ActivityIndicator color={C.purple}/>:
      !offers.length?<FamilyStatus loading={false} error="" empty="You haven't offered help yet."/>:
      offers.map(o=><FamilyCard key={o.id}>
        <View style={S.between}>
          <Text style={[S.h3,{flex:1}]}>{practicalHelpLabels[o.help_type]}</Text>
          <Text style={[S.small,{color:o.status==="accepted"?C.green:themeForeground(VIOLET)}]}>
            {o.status==="offered"?"Awaiting review":o.status==="accepted"?"Accepted":"Declined"}
          </Text>
        </View>
        {Boolean(o.note)&&<Text style={S.body}>{o.note}</Text>}
        <Text style={S.small}>Sent {new Date(o.created_at).toLocaleString()}</Text>
      </FamilyCard>)}
    <Text style={S.small}>An accepted offer is a coordination agreement, not an assigned clinical care task.</Text>
  </Page>;
}
