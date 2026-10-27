import React, { useEffect, useId, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useAppearance } from "../appearance";

export const SPECIALIST_PALETTES = [
  { accent: "#7952B8", pale: "#F1E6FB", secondary: "#BEA0E8", title: "Primary care" },
  { accent: "#CF4E96", pale: "#FCE9F4", secondary: "#F0A6C8", title: "Cardiology" },
  { accent: "#B04E9C", pale: "#FBE9F5", secondary: "#EFA9C5", title: "Hematology & oncology" },
  { accent: "#647ED3", pale: "#EAF1FF", secondary: "#9AB6EE", title: "Nephrology" },
  { accent: "#8A58BF", pale: "#F1E8FD", secondary: "#B69DEB", title: "Neurology" },
  { accent: "#AE6CBA", pale: "#FFF0EA", secondary: "#EAB5CE", title: "Endocrinology" },
  { accent: "#5D90CD", pale: "#E8F5FD", secondary: "#9BC7EE", title: "Pulmonology" },
  { accent: "#698F98", pale: "#EAF6F0", secondary: "#AED4BC", title: "Rheumatology" },
] as const;

export const SPECIALIST_QUESTIONS: ReadonlyArray<ReadonlyArray<{ text: string; icon: string }>> = [
  [
    { text: "What is the next step in our care plan?", icon: "chatbubbles-outline" },
    { text: "Which concerns should primary care coordinate first?", icon: "git-network-outline" },
    { text: "When should we come back or call you?", icon: "calendar-outline" },
  ],
  [
    { text: "What symptoms should prompt us to call right away?", icon: "heart-outline" },
    { text: "What do these heart test results mean?", icon: "pulse-outline" },
    { text: "How will you coordinate with the rest of the care team?", icon: "people-outline" },
  ],
  [
    { text: "What is the goal of this treatment plan?", icon: "flag-outline" },
    { text: "Which side effects should we watch for closely?", icon: "shield-checkmark-outline" },
    { text: "When should we call between visits?", icon: "call-outline" },
  ],
  [
    { text: "What is the next step in our care plan?", icon: "chatbubble-ellipses-outline" },
    { text: "What should we know about fluids, diet, or medicines?", icon: "water-outline" },
    { text: "What changes should prompt us to call?", icon: "call-outline" },
  ],
  [
    { text: "How should we track changes in memory or movement?", icon: "document-text-outline" },
    { text: "What changes should prompt an urgent call?", icon: "call-outline" },
    { text: "What can make daily activities safer?", icon: "shield-checkmark-outline" },
  ],
  [
    { text: "What measurements should we track at home?", icon: "stats-chart-outline" },
    { text: "How do we follow the medicine and monitoring plan?", icon: "calendar-outline" },
    { text: "When should we contact your team?", icon: "call-outline" },
  ],
  [
    { text: "What breathing changes should prompt us to seek help?", icon: "alert-circle-outline" },
    { text: "How should we use or check breathing equipment?", icon: "fitness-outline" },
    { text: "What should we do before our next visit?", icon: "clipboard-outline" },
  ],
  [
    { text: "What should we track about pain or stiffness?", icon: "document-text-outline" },
    { text: "What daily activities or movement might help?", icon: "walk-outline" },
    { text: "Which changes should we report to your team?", icon: "call-outline" },
  ],
];

export const SPECIALIST_NOTES = [
  "Primary care helps connect the care plan, medicines, and referrals.",
  "Your cardiology team can explain your personal heart-care and follow-up plan.",
  "Your specialist team can explain treatment goals, side effects, and whom to contact.",
  "Ask your kidney care team for an individual plan about tests, medicines, and fluids.",
  "Your neurology team can explain changes in thinking, sensation, and movement.",
  "Your endocrinology team can help tailor hormone and blood-glucose monitoring.",
  "Your breathing care team can advise on your individual symptoms and equipment.",
  "Your rheumatology team can explain a care plan for joints and inflammatory symptoms.",
] as const;

/** Each specialty has a *different* recognizable vector illustration, not the same doctor reused. */
function Symbol({ index, accent, secondary, dark }: {
  index: number; accent: string; secondary: string; dark: boolean;
}) {
  const white = dark ? "#2E263A" : "#FFFFFF";
  switch (index) {
    case 0: return <G>
      <Rect x="76" y="34" width="108" height="137" rx="19" fill={white} opacity=".90" />
      <Rect x="104" y="22" width="53" height="23" rx="10" fill={accent} />
      {[78, 107, 136].map((y, i) => <G key={y}>
        <Path d={`M96 ${y}l8 8 14-16`} stroke={accent} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <Rect x="128" y={y-2} width={i===1?38:31} height="7" rx="4" fill={secondary} opacity=".8"/>
      </G>)}
      <Circle cx="188" cy="125" r="36" fill={secondary} opacity=".94"/>
      <Path d="M176 125h24M188 113v24" stroke={white} strokeWidth="7" strokeLinecap="round"/>
      <Circle cx="74" cy="55" r="19" fill={secondary} opacity=".7"/>
      <Circle cx="53" cy="78" r="13" fill={accent} opacity=".4"/>
    </G>;
    case 1: return <G>
      <Path d="M130 166C84 132 52 108 52 74C52 49 70 31 95 31C114 31 125 41 130 52C136 41 150 31 169 31C195 31 212 49 212 74C212 108 181 133 130 166Z"
        fill={secondary} stroke={accent} strokeWidth="5" strokeLinejoin="round"/>
      <Path d="M67 100H103L116 74 132 131 147 92 159 106H194" stroke="#FFFFFF" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <Circle cx="216" cy="152" r="21" fill={white} stroke={accent} strokeWidth="5"/>
      <Path d="M194 143C187 134 190 121 201 116" stroke={accent} strokeWidth="5" fill="none" strokeLinecap="round"/>
    </G>;
    case 2: return <G>
      <Path d="M119 35C139 28 158 49 149 71C140 91 101 121 85 155C76 176 93 186 108 173C126 159 138 127 149 103C163 125 174 155 194 172C208 183 225 166 214 150C193 119 170 94 159 73C148 53 158 37 179 37"
        fill="none" stroke={accent} strokeWidth="18" strokeLinecap="round"/>
      <Path d="M121 39C133 48 143 64 149 85" stroke={secondary} strokeWidth="10" fill="none" strokeLinecap="round"/>
      <Ellipse cx="60" cy="106" rx="21" ry="11" fill={secondary} transform="rotate(-20 60 106)"/>
      <Ellipse cx="206" cy="102" rx="24" ry="12" fill={secondary} transform="rotate(24 206 102)"/>
      <Ellipse cx="78" cy="167" rx="14" ry="8" fill={accent} opacity=".65"/>
      <Ellipse cx="199" cy="43" rx="14" ry="8" fill={accent} opacity=".55"/>
    </G>;
    case 3: return <G>
      <Path d="M105 40C79 25 49 42 47 71C44 98 64 116 78 120C93 124 98 142 91 156C86 164 96 167 107 155C132 131 131 74 105 40Z"
        fill={secondary} stroke={accent} strokeWidth="5" strokeLinejoin="round"/>
      <Path d="M155 40C181 25 211 42 213 71C216 98 196 116 182 120C167 124 162 142 169 156C174 164 164 167 153 155C128 131 129 74 155 40Z"
        fill={secondary} stroke={accent} strokeWidth="5" strokeLinejoin="round"/>
      <Path d="M109 96C122 106 130 111 130 132V180M151 96C138 106 130 111 130 132" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round"/>
      <Path d="M53 144c-13 22 3 30 13 30s24-12 13-30l-13-19Z" fill="#8ABCEB" opacity=".9"/>
      <Circle cx="195" cy="159" r="12" fill="#8ABCEB" opacity=".65"/>
    </G>;
    case 4: return <G>
      <Path d="M122 45C95 20 53 45 56 77C34 90 41 126 62 136C55 169 91 186 122 157C130 166 135 170 139 159C167 180 208 157 197 130C220 108 207 87 200 79C203 43 161 24 137 45"
        fill={secondary} opacity=".91" stroke={accent} strokeWidth="5"/>
      <Path d="M129 48V162M90 54c-16 21 17 30 5 52M69 112c26-14 29 13 31 27M175 54c14 22-17 30-6 50M196 115c-25-13-28 9-31 27"
        stroke={accent} strokeWidth="5" strokeLinecap="round" fill="none"/>
      <Circle cx="129" cy="45" r="10" fill={white} stroke={accent} strokeWidth="4"/>
      <Circle cx="48" cy="86" r="7" fill={accent} opacity=".6"/>
      <Circle cx="217" cy="152" r="7" fill={accent} opacity=".6"/>
    </G>;
    case 5: return <G>
      <Path d="M103 62L143 39 184 62 184 106 143 128 103 106Z" fill={secondary} opacity=".66" stroke={accent} strokeWidth="5"/>
      <Path d="M103 62l40 22 41-22M143 84v44" fill="none" stroke={accent} strokeWidth="5" strokeLinejoin="round"/>
      <Path d="M143 39V18M103 106l-26 18M184 106l27 18M143 128v31" stroke={accent} strokeWidth="5" strokeLinecap="round"/>
      {[[143,18],[77,124],[211,124],[143,159]].map(([cx,cy],i)=><Circle key={i} cx={cx} cy={cy} r={i?14:12} fill={i%2?accent:secondary}/>)}
      <Ellipse cx="66" cy="59" rx="12" ry="19" fill={secondary} opacity=".5"/>
      <Circle cx="196" cy="40" r="10" fill={accent} opacity=".4"/>
    </G>;
    case 6: return <G>
      <Path d="M122 30v52c-14-24-31-38-44-35C48 55 39 106 48 144C56 180 91 187 113 168C123 158 122 140 122 118V80"
        fill={secondary} stroke={accent} strokeWidth="5" strokeLinejoin="round"/>
      <Path d="M138 30v52c14-24 31-38 44-35 30 8 39 59 30 97-8 36-43 43-65 24-10-10-9-28-9-50V80"
        fill={secondary} stroke={accent} strokeWidth="5" strokeLinejoin="round"/>
      <Path d="M130 26v83M116 96l-36 28M144 96l36 28M85 126l-20 18M175 126l20 18"
        stroke={white} strokeWidth="6" fill="none" strokeLinecap="round"/>
      <Path d="M56 23C38 28 34 43 44 55M209 23c18 5 22 20 12 32" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" opacity=".6"/>
    </G>;
    default: return <G>
      <Path d="M106 20v60c0 12-18 18-23 30-8 15 0 29 18 32 11 2 18-2 28-6 11 5 19 9 30 6 17-4 25-18 17-32-6-12-23-18-23-30V20"
        fill={secondary} stroke={accent} strokeWidth="5"/>
      <Path d="M102 153v28M156 153v28" stroke={accent} strokeWidth="18" strokeLinecap="round"/>
      <Path d="M86 121h88" stroke={white} strokeWidth="8" strokeLinecap="round"/>
      <Circle cx="130" cy="124" r="15" fill={accent} opacity=".83"/>
      <Path d="M59 70c-17 17-19 36-8 54M199 70c17 17 19 36 8 54" stroke={accent} strokeWidth="5" fill="none" strokeLinecap="round" opacity=".45"/>
      <Circle cx="215" cy="47" r="12" fill={secondary} opacity=".8"/>
    </G>;
  }
}

export function SpecialistArtwork({ index, height = 160, compact = false, motion = false }: {
  index: number; height?: number; compact?: boolean; motion?: boolean;
}) {
  const { dark } = useAppearance();
  // Every artwork has its own SVG resource ID. The list renders several
  // SVGs at once, so shared IDs can produce cross-card gradients on web.
  const reactId = useId();
  const gradientId = "specialistGlow" + reactId.replace(/[^a-zA-Z0-9_-]/g, "");
  const theme = SPECIALIST_PALETTES[index] ?? SPECIALIST_PALETTES[0];
  const [animate, setAnimate] = useState(false);
  const offset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) return;
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener?.("reduceMotionChanged", reduced => setAnimate(!reduced));
    const motionPreference = AccessibilityInfo.isReduceMotionEnabled?.();
    motionPreference?.then(reduced => {
      if (mounted) setAnimate(!reduced);
    }).catch(() => setAnimate(false));
    return () => { mounted = false; subscription?.remove(); };
  }, [motion]);
  useEffect(() => {
    if (!animate || !motion) { offset.stopAnimation(); offset.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(offset,{toValue:-5,duration:2200,easing:Easing.inOut(Easing.sin),useNativeDriver:Platform.OS!=="web"}),
      Animated.timing(offset,{toValue:0,duration:2200,easing:Easing.inOut(Easing.sin),useNativeDriver:Platform.OS!=="web"}),
    ]));
    animation.start();
    return () => { animation.stop(); offset.setValue(0); };
  }, [animate,motion,offset]);
  return <Animated.View pointerEvents="none" style={{width:"100%",height,transform:[{translateY:offset}]}}>
    <Svg width="100%" height="100%" viewBox="0 0 260 200" preserveAspectRatio="xMidYMid meet" accessibilityLabel={`${theme.title} illustration`}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <Stop offset="0" stopColor={dark?"#382D49":theme.pale}/>
          <Stop offset="1" stopColor={dark?"#564068":theme.secondary} stopOpacity=".5"/>
        </LinearGradient>
      </Defs>
      <Path d="M17 111C-3 70 31 22 79 24C111-7 169 3 188 29C236 25 265 62 249 106C267 145 234 194 176 187C135 210 95 192 67 184C22 188 0 155 17 111Z"
        fill={`url(#${gradientId})`} opacity={compact?".55":"1"}/>
      <Ellipse cx="45" cy="166" rx="11" ry="31" transform="rotate(-32 45 166)" fill={theme.secondary} opacity=".28"/>
      <Ellipse cx="226" cy="40" rx="12" ry="28" transform="rotate(34 226 40)" fill={theme.accent} opacity=".18"/>
      <Circle cx="220" cy="155" r="9" fill={theme.accent} opacity=".22"/>
      <Circle cx="27" cy="56" r="6" fill={theme.accent} opacity=".42"/>
      <Symbol index={index} accent={theme.accent} secondary={theme.secondary} dark={dark}/>
    </Svg>
  </Animated.View>;
}
