import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useAppearance } from "../appearance";
import { useCare } from "../store";
import { useNav } from "./MainScreens";
import { Icon } from "../ui";
import type { RootStack } from "../navigation";
import type { CareSpace } from "../careTeam";
import {
  chatCareSpaces, chatConversations, chatConversationById, chatCurrentUser, chatDelete,
  chatEdit, chatMarkRead, chatOpen, chatPage, chatPeople, chatReadStates,
  chatSearch, chatSend, chatSignalTyping, chatSubscribe, chatTypingStates, chatUnreadCount,
  mergeChatMessages, type ChatConversation, type ChatMessage, type ChatPerson, type ChatRead, type ChatTyping,
} from "../careChat";

const PURPLE = "#70338F";
const timeLabel = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const abbreviated = (value: string) => value.trim().split(/\s+/).map(x => x[0] ?? "").slice(0,2).join("").toUpperCase() || "•";
const notifyError = "Something went wrong. Check your connection and try again.";

function Avatar({ person, name, size = 38 }: { person?: ChatPerson; name: string; size?: number }) {
  const path = person?.avatar_url;
  if (path && /^https:\/\//i.test(path)) {
    return <Image source={{ uri: path }} style={{ width: size, height: size, borderRadius: size/2 }} />;
  }
  return <View style={{ width: size, height: size, borderRadius: size/2,
    backgroundColor: "#DCC8EF", alignItems: "center", justifyContent: "center" }}>
    <Text style={{ color: "#58277C", fontSize: size*0.31, fontWeight: "700" }}>{abbreviated(name)}</Text>
  </View>;
}

export function CareTeamChatScreen() {
  const nav = useNav();
  const route = useRoute<RouteProp<RootStack, "CareTeamChat">>();
  const { dark } = useAppearance();
  const { state } = useCare();
  const { width } = useWindowDimensions();
  const palette = {
    page: dark ? "#191720" : "#FCF9F6",
    card: dark ? "#292332" : "#FFFFFF",
    panel: dark ? "#332B40" : "#F5EDFA",
    bubble: dark ? "#3B304A" : "#F1E7F8",
    mine: dark ? "#774A9F" : PURPLE,
    ink: dark ? "#E8E0F0" : "#2B2037",
    secondary: dark ? "#BEB3CB" : "#74667F",
    border: dark ? "#4A3A58" : "#E9DDEE",
    mineText: "#FBF8FF",
  };
  const [spaces, setSpaces] = useState<CareSpace[]>([]);
  const [recipientId, setRecipientId] = useState<string | null>(route.params?.careRecipientId ?? state.careRecipientId);
  const [userId, setUserId] = useState("");
  const [people, setPeople] = useState<ChatPerson[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [unread, setUnread] = useState<Record<string,number>>({});
  const [selected, setSelected] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reads, setReads] = useState<ChatRead[]>([]);
  const [typing, setTyping] = useState<ChatTyping[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [error, setError] = useState("");
  const nonceRef = useRef<string | null>(null);
  const lastTyping = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const activeId = selected?.id ?? null;

  const personName = useCallback((id: string) => people.find(p=>p.user_id===id)?.full_name?.trim() || (id===userId ? "You" : "Care teammate"), [people,userId]);
  const myPerson = people.find(p => p.user_id === userId);
  const recipientName = spaces.find(p=>p.careRecipientId===recipientId)?.careRecipientName || state.careRecipientName || "Care profile";

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [id, list] = await Promise.all([chatCurrentUser(), chatCareSpaces()]);
        if (!mounted) return;
        setUserId(id);
        setSpaces(list.filter(p => p.role !== "patient" || p.careRecipientId === recipientId));
        if (route.params?.conversationId) {
          const convo = await chatConversationById(route.params.conversationId);
          if (!mounted) return;
          if (!convo) { setError("This conversation is no longer available to your account."); return; }
          setRecipientId(convo.care_recipient_id);
          setSelected(convo);
        } else if (!recipientId && list.length) {
          setRecipientId(list[0].careRecipientId);
        }
      } catch {
        if (mounted) setError("Could not load care profiles. Please sign in again.");
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted=false; };
  }, []);

  const loadRooms = useCallback(async (id: string) => {
    try {
      const groupId = await chatOpen(id);
      const [roster, rooms] = await Promise.all([chatPeople(id),chatConversations(id)]);
      // 'open' is idempotent and creates the shared group if this profile has no chat yet.
      if (!rooms.some(r=>r.id===groupId)) throw new Error("Group conversation unavailable");
      setPeople(roster);
      setConversations(rooms);
      if (userId) {
        const counts = await Promise.all(rooms.map(async room => {
          const states = await chatReadStates(room.id);
          const last = states.find(s=>s.user_id===userId)?.last_read_at ?? null;
          return [room.id, await chatUnreadCount(room.id,last,userId)] as const;
        }));
        setUnread(Object.fromEntries(counts));
      }
    } catch {
      setError("You may no longer have access to this care team. Try refreshing.");
      setPeople([]); setConversations([]);
    }
  }, [userId]);

  useEffect(() => {
    if (recipientId && userId) void loadRooms(recipientId);
  }, [recipientId,userId,loadRooms]);

  const updateStatus = useCallback(async (id: string) => {
    try {
      const [nextReads,nextTyping] = await Promise.all([chatReadStates(id),chatTypingStates(id)]);
      setReads(nextReads); setTyping(nextTyping);
    } catch { /* Access is rechecked on the next authoritative message fetch. */ }
  }, []);

  const refreshMessages = useCallback(async (id: string, markRead: boolean) => {
    try {
      const latest = await chatPage(id);
      setMessages(current => mergeChatMessages(current,latest));
      if (markRead) await chatMarkRead(id);
      await updateStatus(id);
      if (recipientId && userId) void loadRooms(recipientId);
    } catch {
      setError("Your conversation may have changed permissions. Please reopen it.");
      setSelected(null); setMessages([]);
    }
  }, [recipientId,userId,loadRooms,updateStatus]);

  useEffect(() => {
    if (!activeId) { setMessages([]); setReads([]); setTyping([]); return; }
    let alive = true;
    setLoadingMessages(true); setMessages([]); setSearch(""); setSearchResults(null);
    const load = async () => {
      try {
        const initial = await chatPage(activeId);
        if (!alive) return;
        setMessages(initial); setHasEarlier(initial.length===40);
        await chatMarkRead(activeId);
        if (alive) await updateStatus(activeId);
      } catch {
        if (alive) { setError("Could not open this conversation. Your access may have changed."); setSelected(null); }
      } finally { if (alive) setLoadingMessages(false); }
    };
    void load();
    const unsubscribe = chatSubscribe(activeId,
      () => { if (alive) void refreshMessages(activeId,true); },
      () => { if (alive) void updateStatus(activeId); });
    const foreground = AppState.addEventListener("change", status => {
      if (alive && status==="active") void refreshMessages(activeId,true);
    });
    return () => { alive=false; unsubscribe(); foreground.remove(); };
  }, [activeId,refreshMessages,updateStatus]);

  useEffect(() => {
    if (!activeId) return;
    const t = setInterval(() => setTyping(current=>[...current]), 2500);
    return () => clearInterval(t);
  }, [activeId]);

  const openRoom = (room: ChatConversation) => {
    setError(""); setSelected(room); setDraft(""); setReplyTo(null); setEditing(null);
    setSearch(""); nonceRef.current=null;
    setUnread(prev=>({ ...prev,[room.id]:0 }));
  };

  const startDirect = async (peerId: string) => {
    if (!recipientId || !userId || peerId===userId) return;
    setBusy(true); setError("");
    try {
      const id=await chatOpen(recipientId,peerId);
      const rooms=await chatConversations(recipientId);
      setConversations(rooms);
      const room=rooms.find(c=>c.id===id);
      if (room) openRoom(room);
    } catch { setError("That caregiver may no longer be authorized to chat."); }
    finally { setBusy(false); }
  };

  const send = async () => {
    if (!selected || !draft.trim() || busy) return;
    if (draft.trim().length>2000) { setError("Messages must be 2,000 characters or less."); return; }
    setBusy(true); setError("");
    try {
      if (editing) await chatEdit(editing.id,draft);
      else {
        const nonce=nonceRef.current ?? (Date.now().toString(36)+"-"+Math.random().toString(36).slice(2)+"-"+Math.random().toString(36).slice(2));
        nonceRef.current=nonce;
        const sent=await chatSend(selected.id,draft,nonce,replyTo?.id);
        setMessages(current=>mergeChatMessages(current,[sent]));
      }
      nonceRef.current=null; setDraft(""); setEditing(null); setReplyTo(null);
      await refreshMessages(selected.id,true);
    } catch { setError("Your message was not saved. Try sending again."); }
    finally { setBusy(false); }
  };

  const remove = async (message: ChatMessage) => {
    if (busy || message.sender_id!==userId) return;
    setBusy(true);
    try { await chatDelete(message.id); if (selected) await refreshMessages(selected.id,true); }
    catch { setError("Could not remove the message."); }
    finally { setBusy(false); }
  };

  const searchHistory = async () => {
    if (!selected) return;
    setError("");
    try { setSearchResults(search.trim() ? await chatSearch(selected.id,search) : null); }
    catch { setError("Search is unavailable right now."); }
  };
  const loadEarlier = async () => {
    if (!selected || busy || !messages.length) return;
    setBusy(true);
    try {
      const older=await chatPage(selected.id,messages[0].created_at);
      setHasEarlier(older.length===40);
      setMessages(current=>mergeChatMessages(older,current));
    } catch { setError("Could not load earlier messages."); }
    finally { setBusy(false); }
  };

  const noteTyping = (value: string) => {
    setDraft(value); nonceRef.current=null;
    if (!selected || !value.trim() || Date.now()-lastTyping.current<3000) return;
    lastTyping.current=Date.now();
    void chatSignalTyping(selected.id).catch(()=>{});
  };

  const card=(extra:object={})=>({
    backgroundColor:palette.card,borderRadius:23,borderWidth:1,borderColor:palette.border,
    padding:16, ...(Platform.OS==="web" ? {boxShadow:dark?"0 8px 30px rgba(0,0,0,0.14)":"0 8px 28px rgba(90,52,110,0.07)"} : {elevation:1}), ...extra,
  } as any);
  const activePeer=selected?.kind==="direct" ? (selected.direct_user_a===userId?selected.direct_user_b:selected.direct_user_a) : null;
  const chatTitle=selected?.kind==="group" ? recipientName+" · Care team" : activePeer ? personName(activePeer) : "Care Team Chat";
  const shown=searchResults??messages;
  const recentlyTyping=typing.filter(t=>t.user_id!==userId && Date.now()-new Date(t.typed_at).getTime()<6500);
  const otherRead=reads.filter(r=>r.user_id!==userId);
  const wide=Math.min(width,860);
  const topButton=(label:string,icon:"arrow-back-outline"|"search-outline"|"close-outline",action:()=>void)=>
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={{width:40,height:40,alignItems:"center",justifyContent:"center",borderRadius:20,backgroundColor:palette.panel}}>
      <Icon name={icon} size={22} color={palette.ink}/>
    </Pressable>;

  return <SafeAreaView edges={["top","bottom"]} style={{flex:1,backgroundColor:palette.page}}>
    <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={{flex:1}} keyboardVerticalOffset={Platform.OS==="ios"?10:0}>
      <View style={{flex:1,width:"100%",maxWidth:wide,alignSelf:"center"}}>
        <View style={{flexDirection:"row",alignItems:"center",gap:12,padding:16,paddingBottom:12}}>
          {topButton("Back", "arrow-back-outline", () => selected ? setSelected(null) : nav.goBack())}
          <View style={{flex:1}}>
            <Text style={{color:palette.ink,fontSize:21,fontWeight:"700"}} numberOfLines={1}>
              {selected ? chatTitle : "Care Team Chat"}
            </Text>
            <Text style={{color:palette.secondary,fontSize:12,marginTop:3}}>
              {selected ? "Private space for authorized caregivers" : "Real people, shared care · Separate from the AI Assistant"}
            </Text>
          </View>
          {selected ? topButton("Close conversation","close-outline",()=>setSelected(null)) : <View style={{width:36,height:36,borderRadius:18,backgroundColor:palette.panel,justifyContent:"center",alignItems:"center"}}><Icon name="chatbubbles-outline" color={palette.mine} size={19}/></View>}
        </View>
        {Boolean(error) && <Text accessibilityRole="alert" style={{marginHorizontal:16,marginBottom:8,color:dark?"#F3B7CA":"#A52D57",fontSize:13}}>{error}</Text>}
        {!selected ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:16,paddingBottom:38,gap:16}}>
          <View style={card({backgroundColor:palette.panel,padding:20})}>
            <Text style={{color:palette.ink,fontSize:22,fontWeight:"700"}}>Better care starts with a conversation.</Text>
            <Text style={{color:palette.secondary,lineHeight:21,marginTop:7}}>Share updates, ask questions, and stay close to your team — without leaving EnVizion Life.</Text>
          </View>
          {loading && <ActivityIndicator color={palette.mine}/>}
          {!!spaces.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:3}}>
            {spaces.map(p=><Pressable key={p.careRecipientId} accessibilityRole="button" onPress={()=>{setRecipientId(p.careRecipientId);setSelected(null);setError("");}}
              style={{paddingHorizontal:15,paddingVertical:10,borderRadius:18,backgroundColor:recipientId===p.careRecipientId?palette.mine:palette.card,borderWidth:1,borderColor:palette.border}}>
              <Text style={{color:recipientId===p.careRecipientId?palette.mineText:palette.ink,fontWeight:"600"}}>{p.careRecipientName}</Text>
            </Pressable>)}
          </ScrollView>}
          {!recipientId && !loading && <View style={card()}><Text style={{color:palette.ink}}>Create or join a care profile in Care team & sharing to start chatting.</Text></View>}
          {recipientId && <>
            <Text style={{fontWeight:"700",fontSize:16,color:palette.ink}}>Conversations</Text>
            {conversations.map(room=>{
              const peer=room.kind==="direct"?(room.direct_user_a===userId?room.direct_user_b:room.direct_user_a):null;
              const label=room.kind==="group"?recipientName+" · Group chat":peer?personName(peer):"Private chat";
              return <Pressable key={room.id} accessibilityRole="button" accessibilityLabel={"Open "+label} onPress={()=>openRoom(room)} style={card({flexDirection:"row",alignItems:"center",gap:12})}>
                <Avatar person={people.find(p=>p.user_id===peer)} name={room.kind==="group"?recipientName:label} size={47}/>
                <View style={{flex:1,gap:4}}>
                  <Text numberOfLines={1} style={{color:palette.ink,fontWeight:"700",fontSize:15}}>{label}</Text>
                  <Text style={{color:palette.secondary,fontSize:12}}>{room.kind==="group"?"Everyone on this care team":"Private, just between you two"}</Text>
                </View>
                {(unread[room.id]||0)>0 && <View style={{backgroundColor:palette.mine,borderRadius:13,minWidth:25,height:25,alignItems:"center",justifyContent:"center",paddingHorizontal:5}}><Text style={{color:palette.mineText,fontWeight:"700",fontSize:12}}>{unread[room.id]>99?"99+":unread[room.id]}</Text></View>}
                <Icon name="chevron-forward-outline" color={palette.secondary} size={19}/>
              </Pressable>;
            })}
            <Text style={{fontWeight:"700",fontSize:16,color:palette.ink,marginTop:7}}>Start a private chat</Text>
            <Text style={{color:palette.secondary,fontSize:12}}>Only currently authorized teammates appear here.</Text>
            {people.filter(p=>p.user_id!==userId).map(p=><Pressable key={p.user_id} disabled={busy} onPress={()=>void startDirect(p.user_id)} accessibilityRole="button"
              accessibilityLabel={"Start private conversation with "+personName(p.user_id)}
              style={card({flexDirection:"row",alignItems:"center",gap:12})}>
              <Avatar person={p} name={personName(p.user_id)} size={42}/>
              <Text style={{color:palette.ink,fontWeight:"600",flex:1}}>{personName(p.user_id)}</Text>
              <Icon name="chatbubble-ellipses-outline" color={palette.mine} size={21}/>
            </Pressable>)}
            {!people.filter(p=>p.user_id!==userId).length && <Text style={{color:palette.secondary,fontSize:13}}>Once another caregiver accepts an invitation, you can chat privately here.</Text>}
          </>}
        </ScrollView> : <>
          <View style={{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:16,paddingBottom:10}}>
            <TextInput value={search} onChangeText={setSearch} onSubmitEditing={()=>void searchHistory()}
              placeholder="Search conversation history" placeholderTextColor={palette.secondary}
              style={{flex:1,backgroundColor:palette.panel,color:palette.ink,borderRadius:16,paddingHorizontal:14,paddingVertical:10,fontSize:13}}/>
            <Pressable onPress={()=>void searchHistory()} accessibilityRole="button" accessibilityLabel="Search messages" style={{padding:9}}><Icon name="search-outline" color={palette.mine} size={22}/></Pressable>
            {searchResults && <Pressable onPress={()=>{setSearch("");setSearchResults(null);}} accessibilityLabel="Clear search" accessibilityRole="button" style={{padding:5}}><Icon name="close" color={palette.secondary}/></Pressable>}
          </View>
          {loadingMessages && <ActivityIndicator color={palette.mine}/>}
          <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={Platform.OS==="ios"} style={{flex:1}}
            contentContainerStyle={{paddingHorizontal:16,paddingVertical:15,flexGrow:1,justifyContent:"flex-end",gap:11}}
            onContentSizeChange={()=>{if(!searchResults && !hasEarlier) scrollRef.current?.scrollToEnd({animated:false});}}>
            {hasEarlier && !searchResults && <Pressable onPress={()=>void loadEarlier()} disabled={busy} style={{alignSelf:"center",padding:12}}>
              <Text style={{color:palette.mine,fontWeight:"600"}}>Load earlier messages</Text>
            </Pressable>}
            {!shown.length && <View style={card({alignItems:"center",marginTop:24})}>
              <Icon name="chatbubbles-outline" color={palette.mine} size={34}/>
              <Text style={{color:palette.ink,fontWeight:"700",marginTop:8}}>{searchResults?"No matching messages":"Start your conversation"}</Text>
              <Text style={{color:palette.secondary,textAlign:"center",marginTop:5}}>{searchResults?"Try another search term.":"Your messages are private to authorized members of this conversation."}</Text>
            </View>}
            {shown.map(m=>{
              const mine=m.sender_id===userId, deleted=!!m.deleted_at;
              const sender=personName(m.sender_id);
              const replied=messages.find(x=>x.id===m.reply_to);
              const seenBy=mine?otherRead.filter(r=>new Date(r.last_read_at).getTime()>=new Date(m.created_at).getTime()).length:0;
              return <View key={m.id} style={{maxWidth:"88%",alignSelf:mine?"flex-end":"flex-start",gap:4}}>
                {!mine && <View style={{flexDirection:"row",alignItems:"center",gap:7,marginBottom:2}}>
                  <Avatar person={people.find(p=>p.user_id===m.sender_id)} name={sender} size={23}/>
                  <Text style={{color:palette.secondary,fontSize:12,fontWeight:"600"}}>{sender}</Text>
                </View>}
                <View style={{paddingHorizontal:14,paddingVertical:11,borderRadius:18,borderBottomRightRadius:mine?5:18,borderBottomLeftRadius:mine?18:5,
                  backgroundColor:mine?palette.mine:palette.bubble}}>
                  {replied && <Text numberOfLines={2} style={{color:mine?"#EEDFF7":palette.secondary,fontSize:11,marginBottom:7,paddingLeft:8,borderLeftWidth:2,borderLeftColor:mine?"#EEDFF7":palette.mine}}>
                    ↳ {personName(replied.sender_id)}: {replied.deleted_at?"Message removed":replied.body}
                  </Text>}
                  <Text style={{fontSize:14,lineHeight:21,color:mine?palette.mineText:palette.ink,fontStyle:deleted?"italic":"normal"}}>{deleted?"Message removed":m.body}</Text>
                  <Text style={{marginTop:5,fontSize:10,color:mine?"#EBDCF5":palette.secondary,textAlign:"right"}}>
                    {timeLabel(m.created_at)}{m.edited_at&&!deleted?" · edited":""}{mine&&seenBy?" · Read":""}
                  </Text>
                </View>
                {!deleted && !searchResults && <View style={{flexDirection:"row",gap:12,justifyContent:mine?"flex-end":"flex-start",paddingHorizontal:4}}>
                  <Pressable onPress={()=>{setReplyTo(m);setEditing(null);setDraft("");}} accessibilityRole="button" accessibilityLabel="Reply to message"><Text style={{color:palette.secondary,fontSize:11}}>Reply</Text></Pressable>
                  {mine && <>
                    <Pressable onPress={()=>{setEditing(m);setReplyTo(null);setDraft(m.body??"");}} accessibilityRole="button" accessibilityLabel="Edit your message"><Text style={{color:palette.secondary,fontSize:11}}>Edit</Text></Pressable>
                    <Pressable onPress={()=>void remove(m)} accessibilityRole="button" accessibilityLabel="Remove your message"><Text style={{color:palette.secondary,fontSize:11}}>Remove</Text></Pressable>
                  </>}
                </View>}
              </View>;
            })}
          </ScrollView>
          {!!recentlyTyping.length && <Text style={{paddingHorizontal:18,paddingBottom:4,color:palette.secondary,fontSize:12}}>
            {recentlyTyping.map(t=>personName(t.user_id)).join(", ")} typing…
          </Text>}
          <View style={{paddingHorizontal:15,paddingTop:10,paddingBottom:Platform.OS==="web"?14:8,borderTopWidth:1,borderTopColor:palette.border,backgroundColor:palette.card}}>
            {(replyTo||editing) && <View style={{flexDirection:"row",alignItems:"center",padding:9,marginBottom:8,backgroundColor:palette.panel,borderRadius:13}}>
              <Text numberOfLines={1} style={{flex:1,color:palette.secondary,fontSize:12}}>{editing?"Editing your message":`Replying to ${personName(replyTo!.sender_id)}: ${replyTo!.body??""}`}</Text>
              <Pressable onPress={()=>{setReplyTo(null);setEditing(null);setDraft("");}} accessibilityLabel="Cancel reply or edit" accessibilityRole="button"><Icon name="close-circle-outline" color={palette.secondary} size={22}/></Pressable>
            </View>}
            <View style={{flexDirection:"row",gap:10,alignItems:"flex-end"}}>
              <TextInput multiline value={draft} maxLength={2000} onChangeText={noteTyping} editable={!busy}
                accessibilityLabel="Message your care team" placeholder="Write a private message…" placeholderTextColor={palette.secondary}
                style={{flex:1,minHeight:46,maxHeight:130,paddingVertical:12,paddingHorizontal:15,borderRadius:20,
                  backgroundColor:palette.panel,color:palette.ink,textAlignVertical:"top",fontSize:14}}/>
              <Pressable onPress={()=>void send()} disabled={!draft.trim()||busy}
                accessibilityLabel={editing?"Save edited message":"Send message"} accessibilityRole="button"
                style={{width:46,height:46,borderRadius:17,backgroundColor:palette.mine,alignItems:"center",justifyContent:"center",opacity:busy||!draft.trim()?0.5:1}}>
                <Icon name={editing?"checkmark":"arrow-up"} color={palette.mineText} size={22}/>
              </Pressable>
            </View>
            <Text style={{color:palette.secondary,fontSize:10,marginTop:7}}>Care Team Chat does not change medications, care plans, or clinical observations. Not for emergencies.</Text>
          </View>
        </>}
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
