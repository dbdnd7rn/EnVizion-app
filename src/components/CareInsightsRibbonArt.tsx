import React from "react";
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

export function CareInsightsRibbonArt() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 270 220"
      accessibilityElementsHidden
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="careRibbonA" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.92} />
          <Stop offset="0.2" stopColor="#F0E3FF" stopOpacity={0.94} />
          <Stop offset="0.55" stopColor="#C99AF5" stopOpacity={0.91} />
          <Stop offset="1" stopColor="#7440AE" stopOpacity={0.96} />
        </LinearGradient>
        <LinearGradient id="careRibbonB" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor="#7542AC" stopOpacity={0.94} />
          <Stop offset="0.46" stopColor="#D8BDF8" stopOpacity={0.86} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.82} />
        </LinearGradient>
        <LinearGradient id="careRibbonC" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FAF6FF" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#D5B7F6" stopOpacity={0.85} />
          <Stop offset="1" stopColor="#9A62D0" stopOpacity={0.84} />
        </LinearGradient>
      </Defs>

      <Ellipse cx="157" cy="203" rx="66" ry="10" fill="#6D35A4" opacity={0.1} />

      <Path
        d="M65 40C109 49 134 81 175 85C207 88 236 69 268 35C247 88 210 117 167 106C126 96 94 66 65 40Z"
        fill="url(#careRibbonA)"
        stroke="#9E6ACE"
        strokeWidth="1.5"
      />
      <Path
        d="M96 71C126 104 141 146 185 173C208 186 233 184 261 163C235 202 195 211 161 190C120 166 110 118 96 71Z"
        fill="url(#careRibbonB)"
        stroke="#7140A5"
        strokeWidth="1.5"
      />
      <Path
        d="M10 83C40 57 74 54 105 71C129 84 148 110 172 118C138 128 105 120 78 101C56 86 35 79 10 83Z"
        fill="url(#careRibbonC)"
        stroke="#9F72C6"
        strokeWidth="1.2"
        opacity={0.94}
      />
      <Path
        d="M149 16C183 28 213 50 244 47C255 46 263 43 270 37C250 72 215 82 184 68C165 59 153 38 149 16Z"
        fill="url(#careRibbonC)"
        stroke="#BB96DE"
        strokeWidth="1.1"
        opacity={0.76}
      />

      <Path
        d="M80 47C112 56 133 83 175 89C206 94 229 79 249 60"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4.4"
        strokeLinecap="round"
        opacity={0.5}
      />
      <Path
        d="M115 81C135 110 150 148 186 168"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
        opacity={0.42}
      />
      <Path
        d="M25 80C57 67 82 70 105 82"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3.2"
        strokeLinecap="round"
        opacity={0.48}
      />

      <Path
        d="M79 40C108 50 129 72 164 82C185 88 204 86 222 77"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity={0.8}
      />
      <Path
        d="M108 73C130 101 142 135 172 157"
        fill="none"
        stroke="#FDF9FF"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity={0.7}
      />
    </Svg>
  );
}
