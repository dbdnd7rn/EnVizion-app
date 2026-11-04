import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Svg, { Defs, LinearGradient, Stop, Rect, Line, Text as SvgText } from "react-native-svg";
import { supabase } from "../supabase";
import { askCareAI } from "../assistant/careAI";
import type { CareTrends } from "../assistant/validateAssistantDraft";
import { themeBackground, themeBorder, themeForeground } from "../themeColors";

/** Latest chart only; refresh is scoped to this mounted profile and never stored as a care record. */
export function AICareTrends({ initial, careRecipientId }: {initial: CareTrends; careRecipientId: string}) {
  const focused = useIsFocused();
  const [data, setData] = useState<CareTrends | undefined>(initial);
  const [metric, setMetric] = useState<"notes" | "completedReminders">("notes");
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const [problem, setProblem] = useState("");
  const active = useRef(true);
  const inFlight = useRef(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    if (!active.current || inFlight.current || AppState.currentState === "background" || (typeof document !== "undefined" && document.hidden)) return;
    inFlight.current = true; const id = ++sequence.current; setLoading(true);
    try {
      const result = await askCareAI({message:"Show care trends",history:[],careRecipientId,includeCareData:true});
      if (!active.current || sequence.current !== id) return;
      setData(result.trends);
      setProblem(result.trends ? "" : "Chart unavailable. Try refreshing again.");
    } catch {
      if (active.current && sequence.current === id) { setData(undefined); setProblem("Couldn't refresh authorized records. Check your connection and access, then retry."); }
    } finally { inFlight.current = false; if (active.current && sequence.current === id) setLoading(false); }
  }, [careRecipientId]);
  useEffect(() => {
    active.current = focused;
    if (!focused) { sequence.current++; setLoading(false); return; }
    void refresh();
    const channel = ["care_communications", "care_reminders"].reduce((subscription, table) =>
      subscription.on("postgres_changes", {event:"*",schema:"public",table,filter:`care_recipient_id=eq.${careRecipientId}`}, () => { void refresh(); }),
      supabase.channel(`assistant-trends:${careRecipientId}`));
    channel.subscribe(status => { if (active.current) setLive(status === "SUBSCRIBED"); });
    const foreground = AppState.addEventListener("change", status => { if (status === "active") void refresh(); });
    const visibility = () => { if (!document.hidden) void refresh(); };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", visibility);
    const timer = setInterval(() => { void refresh(); }, 30000);
    return () => {
      active.current = false; sequence.current++; clearInterval(timer); foreground.remove();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", visibility);
      void supabase.removeChannel(channel);
    };
  }, [focused, refresh, careRecipientId]);
  const label = metric === "notes" ? "Care notes recorded" : "Reminders completed";
  const total = data?.days.reduce((sum, d) => sum + d[metric], 0) || 0;
  const maximum = Math.max(1, ...(data?.days.map(d => d[metric]) || []));
  const color = themeForeground("#70338F");
  return <View style={{padding:16, gap:14, borderRadius:20, backgroundColor:themeBackground("#F7F0FB"), borderWidth:1,borderColor:themeBorder("#E5D9ED"), width:"100%", minWidth:240}}>
    <Text style={{fontFamily:"Lora_500Medium",fontSize:22,color:themeForeground("#19143F")}}>Your care rhythm</Text>
    <Text style={{color:themeForeground("#69617E"),fontSize:12}}>Past 7 days · Today is partial</Text>
    <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
      {(["notes","completedReminders"] as const).map(key => <Pressable key={key} accessibilityRole="button" accessibilityState={{selected:metric===key}} onPress={()=>setMetric(key)} style={{minHeight:44,padding:12,borderRadius:16,borderWidth:1,borderColor:themeBorder("#CDB4DC"),backgroundColor:themeBackground(metric===key?"#EADAF5":"#FFFFFF")}}>
        <Text style={{color,fontFamily:"DMSans_600SemiBold"}}>{key==="notes"?"Care notes":"Completed reminders"}</Text>
      </Pressable>)}
    </View>
    {data && <>
      <Text style={{fontSize:28,color,fontFamily:"DMSans_700Bold"}}>{total} <Text style={{fontSize:13}}>{label.toLowerCase()}</Text></Text>
      <View accessible accessibilityLabel={`${label}. ${data.days.map(d=>`${d.date}: ${d[metric]}`).join(". ")}`}>
        <Svg width="100%" height={184} viewBox="0 0 308 184" accessible={false}>
          <Defs><LinearGradient id="careBar" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#AD7ACE"/><Stop offset="1" stopColor="#70338F"/></LinearGradient></Defs>
          <Line x1="0" y1="145" x2="308" y2="145" stroke={themeBorder("#CDB4DC")}/>
          {data.days.map((d,i)=>{
            const h=108*d[metric]/maximum;
            return <React.Fragment key={d.date}>
              {h>0 && <Rect x={i*44+9} y={145-h} width={26} height={h} rx={7} fill="url(#careBar)"/>}
              <SvgText x={i*44+22} y={134-h} textAnchor="middle" fill={color} fontSize={12}>{d[metric]}</SvgText>
              <SvgText x={i*44+22} y={169} textAnchor="middle" fill={themeForeground("#69617E")} fontSize={11}>{d.date.slice(5).replace("-","/")}</SvgText>
            </React.Fragment>;
          })}
        </Svg>
      </View>
      {total===0 && <Text style={{color:themeForeground("#69617E")}}>No matching activity recorded in this period.</Text>}
      <Text style={{color:themeForeground("#69617E"),fontSize:11,lineHeight:17}}>Updated {new Date(data.updatedAt).toLocaleTimeString()} · {data.timezone}. {live ? "Live updates connected; also checks every 30 seconds while visible." : "Checks every 30 seconds while visible."} Counts reflect saved records, not health outcomes.</Text>
    </>}
    {!!problem && <Text accessibilityRole="alert" style={{color:themeForeground("#9E3156")}}>{problem}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel="Refresh care activity chart" disabled={loading} onPress={()=>void refresh()} style={{minHeight:44,justifyContent:"center",alignItems:"center",borderRadius:14,backgroundColor:themeBackground("#EADAF5")}}><Text style={{color,fontFamily:"DMSans_600SemiBold"}}>{loading?"Updating…":"Refresh chart"}</Text></Pressable>
  </View>;
}
