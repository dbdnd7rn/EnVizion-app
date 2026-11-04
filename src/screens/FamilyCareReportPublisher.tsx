import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useCare } from "../store";
import { themeAction, themeBackground, themeBorder, themeForeground, themeShadow } from "../themeColors";
import { C, Icon, S } from "../ui";
import {
  buildFamilyReportPreview,
  familyReportDateLabel, loadFamilyReportSource, loadFamilyReportsForReview,
  localDateKey, publishFamilyReport, reportPeriodStart, shiftLocalDate,
  unpublishFamilyReport, type FamilyCareReport, type FamilyReportPeriod,
} from "../familyReports";
import type { CarePlanItem, CarePlanCompletion } from "../carePlan";

const PURPLE = "#70338F";

function ShareGlass({children}:{children:React.ReactNode}){
  return <View style={{
    padding:18,gap:13,borderRadius:26,overflow:"hidden",
    backgroundColor:themeBackground("#FFFCFF"),
    borderColor:themeBorder("#E7DBEF"),borderWidth:1,
    shadowColor:themeShadow(PURPLE),shadowOpacity:.07,
    shadowRadius:13,shadowOffset:{width:0,height:5},elevation:1,
  }}>{children}</View>;
}

function PeriodChoice({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){
  return <Pressable accessibilityRole="button" accessibilityState={{selected:active}}
    accessibilityLabel={label} onPress={onPress} style={{
      flex:1,minHeight:44,borderRadius:19,alignItems:"center",justifyContent:"center",
      backgroundColor:active?themeAction(PURPLE):themeBackground("#F4EAF9"),
    }}>
    <Text style={{fontFamily:"DMSans_600SemiBold",fontSize:13.5,
      color:active?themeForeground("#FFFFFF"):themeForeground("#683487")}}>{label}</Text>
  </Pressable>;
}

/** The Primary Advocate explicitly approves each snapshot before family can read it. */
export function FamilyCareReportPublisher(){
  const {state}=useCare();
  const careRecipientId=state.careRecipientId;
  const canPublish=state.accessRole==="owner";
  const canSee=canPublish||state.accessRole==="caregiver";
  const [period,setPeriod]=useState<FamilyReportPeriod>("daily");
  const [selectedOn,setSelectedOn]=useState(localDateKey(new Date()));
  const [items,setItems]=useState<CarePlanItem[]>([]);
  const [completions,setCompletions]=useState<CarePlanCompletion[]>([]);
  const [reports,setReports]=useState<FamilyCareReport[]>([]);
  const [note,setNote]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  const refresh=useCallback(async()=>{
    if(!careRecipientId||!canPublish)return;
    const [source,saved]=await Promise.all([
      loadFamilyReportSource(careRecipientId),
      loadFamilyReportsForReview(careRecipientId),
    ]);
    setItems(source.items);setCompletions(source.completions);setReports(saved);
  },[careRecipientId,canPublish]);

  useFocusEffect(useCallback(()=>{
    if(!canPublish||!careRecipientId)return;
    let active=true;
    setLoading(true);setError("");
    void refresh().catch(e=>{
      if(active)setError(e instanceof Error?e.message:"Could not load the real care records.");
    }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[refresh,canPublish,careRecipientId]));

  const today=localDateKey(new Date());
  const start=reportPeriodStart(period,selectedOn);
  const published=reports.find(r=>r.period===period&&r.start_on===start);
  useEffect(()=>{
    setNote(published?.summary_note??"");
  },[period,start,published?.id,published?.updated_at]);

  const preview=useMemo(()=>buildFamilyReportPreview(items,completions,period,start,today),
    [items,completions,period,start,today]);
  const canGoBack=shiftLocalDate(start,period==="daily"?-1:-7)>=shiftLocalDate(today,-28);
  const canGoForward=shiftLocalDate(start,period==="daily"?1:7)<=reportPeriodStart(period,today);

  async function publish(){
    if(!careRecipientId||!canPublish||busy||loading)return;
    setBusy(true);setError("");setMessage("");
    try{
      await publishFamilyReport(careRecipientId,preview,note);
      setReports(await loadFamilyReportsForReview(careRecipientId));
      setMessage("Approved summary published. Authorized family members can now read it.");
    }catch(e){
      setError(e instanceof Error?e.message:"Could not approve the report.");
    }finally{setBusy(false);}
  }
  async function unshare(){
    if(!careRecipientId||!canPublish||busy||!published?.published)return;
    setBusy(true);setError("");setMessage("");
    try{
      await unpublishFamilyReport(careRecipientId,published.id);
      setReports(await loadFamilyReportsForReview(careRecipientId));
      setMessage("Family sharing stopped for this report.");
    }catch(e){setError(e instanceof Error?e.message:"Could not unshare the report.");}
    finally{setBusy(false);}
  }

  if(!canSee||!careRecipientId)return null;
  if(!canPublish)return <ShareGlass>
    <View style={S.row}><Icon name="shield-checkmark-outline" size={25}/>
      <Text style={[S.h3,{flex:1}]}>Daily and weekly family summaries</Text></View>
    <Text style={S.body}>The Primary Advocate reviews and approves which care
      summaries are shared. Co-Caregivers can record daily care through the normal care plan.</Text>
  </ShareGlass>;

  return <View style={{gap:13}}>
    <View style={{gap:5}}>
      <Text style={[S.eyebrow,{color:themeForeground(PURPLE),letterSpacing:2.2}]}>
        FAMILY VISIBILITY
      </Text>
      <Text style={{fontFamily:"Lora_500Medium",fontSize:25,
        color:themeForeground("#1A163B")}}>Daily & weekly sharing</Text>
      <Text style={S.body}>Review real care activity records, then approve exactly
        which non-clinical summary your family can read.</Text>
    </View>
    <ShareGlass>
      <View style={{flexDirection:"row",gap:9}}>
        <PeriodChoice label="Daily care" active={period==="daily"} onPress={()=>{
          setPeriod("daily");setSelectedOn(localDateKey(new Date()));setError("");setMessage("");
        }}/>
        <PeriodChoice label="Weekly summary" active={period==="weekly"} onPress={()=>{
          setPeriod("weekly");setSelectedOn(localDateKey(new Date()));setError("");setMessage("");
        }}/>
      </View>
      <View style={[S.between,{gap:10}]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous reporting period"
          accessibilityState={{disabled:!canGoBack}} disabled={!canGoBack}
          onPress={()=>setSelectedOn(shiftLocalDate(start,period==="daily"?-1:-7))}
          style={{width:42,height:42,borderRadius:18,backgroundColor:themeBackground("#F0E5F7"),
            alignItems:"center",justifyContent:"center",opacity:canGoBack?1:.4}}>
          <Icon name="chevron-back" size={22} color={themeForeground(PURPLE)}/>
        </Pressable>
        <View style={{flex:1,alignItems:"center",gap:4}}>
          <Text style={{fontFamily:"DMSans_600SemiBold",color:themeForeground("#211A3B"),
            fontSize:13.5,textAlign:"center"}}>{familyReportDateLabel(period,start)}</Text>
          <Text style={S.small}>{published?.published?"Shared with family":"Not shared with family"}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Next reporting period"
          accessibilityState={{disabled:!canGoForward}} disabled={!canGoForward}
          onPress={()=>setSelectedOn(shiftLocalDate(start,period==="daily"?1:7))}
          style={{width:42,height:42,borderRadius:18,backgroundColor:themeBackground("#F0E5F7"),
            alignItems:"center",justifyContent:"center",opacity:canGoForward?1:.4}}>
          <Icon name="chevron-forward" size={22} color={themeForeground(PURPLE)}/>
        </Pressable>
      </View>
      {loading?<ActivityIndicator color={C.purple}/>:
      <View style={{flexDirection:"row",gap:10}}>
        <View style={{flex:1,padding:14,borderRadius:20,backgroundColor:themeBackground("#F4ECFA"),gap:5}}>
          <Text style={[S.eyebrow,{fontSize:10}]}>PLANNED ROUTINES</Text>
          <Text style={[S.h2,{fontSize:23}]}>{preview.plannedCount}</Text>
        </View>
        <View style={{flex:1,padding:14,borderRadius:20,backgroundColor:themeBackground("#F0F8F3"),gap:5}}>
          <Text style={[S.eyebrow,{fontSize:10}]}>RECORDED DONE</Text>
          <Text style={[S.h2,{fontSize:23}]}>{preview.completedCount}</Text>
        </View>
      </View>}
      <Text style={[S.small,{lineHeight:19}]}>
        Only meal, mobility, hygiene, and comfort routine titles are included.
        Medication, monitoring, clinical notes, vitals, and private details are excluded.
        An unfinished activity means no completion was recorded, not necessarily missed care.
      </Text>
      {!loading&&<View style={{gap:9}}>
        <Text style={[S.h3,{fontSize:15}]}>Preview before approving</Text>
        {preview.activities.length?preview.activities.slice(0,8).map((a,i)=>
          <View key={a.date+":"+a.title+":"+i} style={{flexDirection:"row",gap:10,alignItems:"center"}}>
            <Icon name={a.completed?"checkmark-circle-outline":"ellipse-outline"} size={19}
              color={a.completed?C.green:themeForeground("#8F849B")}/>
            <Text style={[S.body,{flex:1,fontSize:13}]}>{a.title}
              {period==="weekly"?" · "+a.date.slice(5):""}
            </Text>
            <Text style={[S.small,{fontSize:11}]}>{a.completed?"Done":"Not recorded"}</Text>
          </View>
        ):<Text style={S.body}>There are no eligible routines in this period.
          You may still share a written summary.</Text>}
        {preview.activities.length>8&&<Text style={S.small}>
          Plus {preview.activities.length-8} more entries in the approved snapshot.</Text>}
      </View>}
      <Text style={[S.h3,{fontSize:14.5}]}>Message to family (optional)</Text>
      <TextInput accessibilityLabel="Approved daily or weekly summary for family"
        value={note} onChangeText={setNote} multiline maxLength={800}
        placeholder="A short update you are comfortable sharing with family…"
        placeholderTextColor={themeForeground("#8D8399")}
        textAlignVertical="top" style={{minHeight:93,borderRadius:19,padding:14,
          fontFamily:"DMSans_400Regular",fontSize:13.5,color:themeForeground("#1A163B"),
          backgroundColor:themeBackground("#FBF8FD"),borderWidth:1,
          borderColor:themeBorder("#E8DCEE")}}/>
      <Text style={[S.small,{textAlign:"right"}]}>{note.length}/800</Text>
      {Boolean(error)&&<Text accessibilityRole="alert" style={[S.body,{color:C.rose}]}>{error}</Text>}
      {Boolean(message)&&<Text accessibilityRole="alert" style={S.body}>{message}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel="Approve and publish family summary"
        disabled={loading||busy} onPress={()=>void publish()}
        style={{minHeight:53,borderRadius:25,justifyContent:"center",
          alignItems:"center",backgroundColor:themeAction(PURPLE),
          opacity:loading||busy?.55:1}}>
        <Text style={{fontFamily:"DMSans_600SemiBold",fontSize:14,
          color:themeForeground("#FFFFFF")}}>{busy?"Saving…":published?.published?
            "Review and republish summary":"Approve & share with family"}</Text>
      </Pressable>
      {published?.published&&<Pressable accessibilityRole="button" onPress={()=>void unshare()}
        disabled={busy} style={{paddingVertical:12,alignItems:"center"}}>
        <Text style={{fontFamily:"DMSans_600SemiBold",fontSize:13.5,
          color:themeForeground("#9C466E")}}>Stop sharing this report</Text>
      </Pressable>}
    </ShareGlass>
  </View>;
}
