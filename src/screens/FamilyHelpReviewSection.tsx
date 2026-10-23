import React,{useCallback,useState} from "react";
import {ActivityIndicator,Pressable,Text,View} from "react-native";
import {useFocusEffect} from "@react-navigation/native";
import {useCare} from "../store";
import {C,S,Card,Icon,Button} from "../ui";
import {loadFamilyHelpOffers,practicalHelpLabels,reviewFamilyHelpOffer,type FamilyHelpOffer} from "../familyHelp";

export function FamilyHelpReviewSection(){
  const {state}=useCare();
  const [offers,setOffers]=useState<FamilyHelpOffer[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState("");
  const refresh=useCallback(async()=>{
    if(!state.careRecipientId){setOffers([]);return;}
    setOffers(await loadFamilyHelpOffers(state.careRecipientId));
  },[state.careRecipientId]);
  useFocusEffect(useCallback(()=>{
    let active=true;
    setLoading(true);setError("");
    void refresh().catch(e=>{
      if(active)setError(e instanceof Error?e.message:"Could not load family offers.");
    }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[refresh]));
  if(state.accessRole!=="owner"&&state.accessRole!=="caregiver")return null;
  const pending=offers.filter(o=>o.status==="offered");
  async function decide(id:string,status:"accepted"|"declined"){
    if(busy)return;
    setBusy(id);setError("");
    try{await reviewFamilyHelpOffer(id,status);await refresh();}
    catch(e){setError(e instanceof Error?e.message:"Could not update the offer.");}
    finally{setBusy(null);}
  }
  return <View style={{gap:14}}>
    <Text style={[S.eyebrow,{letterSpacing:2}]}>FAMILY PARTICIPATION</Text>
    <Text style={S.h2}>Offers of practical help</Text>
    <Text style={S.body}>Review non-clinical support offered by family members. Accepting an offer does not assign a clinical task.</Text>
    {loading&&<ActivityIndicator color={C.purple}/>}
    {Boolean(error)&&<Text accessibilityRole="alert" style={{color:C.rose}}>{error}</Text>}
    {!loading&&!offers.length&&<Card><Text style={S.body}>No family offers yet.</Text></Card>}
    {!loading&&pending.map(o=><Card key={o.id}>
      <View style={S.between}>
        <Icon name="hand-left-outline"/>
        <Text style={[S.h3,{flex:1}]}>{practicalHelpLabels[o.help_type]}</Text>
      </View>
      {Boolean(o.note)&&<Text style={S.body}>{o.note}</Text>}
      <Text style={S.small}>{new Date(o.created_at).toLocaleString()}</Text>
      <View style={{flexDirection:"row",gap:10}}>
        <View style={{flex:1}}><Button title={busy===o.id?"Reviewing…":"Accept"}
          disabled={busy!==null} onPress={()=>void decide(o.id,"accepted")}/></View>
        <View style={{flex:1}}><Button title="Decline" secondary disabled={busy!==null}
          onPress={()=>void decide(o.id,"declined")}/></View>
      </View>
    </Card>)}
    {!loading&&offers.length>0&&!pending.length&&<Card>
      <Text style={S.body}>All offers have been reviewed.</Text>
    </Card>}
  </View>;
}
