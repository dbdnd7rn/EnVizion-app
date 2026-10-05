import React from "react";
import { Platform } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";

export function NotificationGlassBell({ size = 176 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 180 180"
      {...(Platform.OS === "web"
        ? { "aria-hidden": true }
        : { accessibilityElementsHidden: true })}
    >
      <Defs>
        <LinearGradient id="bellBody" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.96" />
          <Stop offset="0.28" stopColor="#EFE0FF" stopOpacity="0.92" />
          <Stop offset="0.62" stopColor="#C18AF3" stopOpacity="0.88" />
          <Stop offset="1" stopColor="#8D48DA" stopOpacity="0.82" />
        </LinearGradient>
        <LinearGradient id="bellRim" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.98" />
          <Stop offset="0.45" stopColor="#E9D3FF" stopOpacity="0.95" />
          <Stop offset="1" stopColor="#A45DE7" stopOpacity="0.84" />
        </LinearGradient>
        <LinearGradient id="metalStroke" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.5" stopColor="#CDA4F7" />
          <Stop offset="1" stopColor="#6E2FAE" />
        </LinearGradient>
        <RadialGradient id="bubble" cx="35%" cy="25%" r="75%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.98" />
          <Stop offset="0.35" stopColor="#E8CDFF" stopOpacity="0.94" />
          <Stop offset="1" stopColor="#A75AE3" stopOpacity="0.88" />
        </RadialGradient>
        <RadialGradient id="clapper" cx="35%" cy="25%" r="75%">
          <Stop offset="0" stopColor="#F9EDFF" />
          <Stop offset="1" stopColor="#9148CE" />
        </RadialGradient>
        <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#B76BE8" stopOpacity="0.2" />
          <Stop offset="1" stopColor="#B76BE8" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Circle cx="92" cy="88" r="80" fill="url(#halo)" />
      <Ellipse cx="90" cy="151" rx="47" ry="8" fill="#7A40A8" opacity="0.1" />

      <G>
        <Path
          d="M77 39c1-12 8-20 18-20 11 0 18 8 19 20"
          fill="none"
          stroke="url(#metalStroke)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <Path
          d="M79 39c2-8 7-13 16-13 8 0 14 5 16 13"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.68"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <Path
          d="M48 111c10-10 15-24 17-44 2-23 16-37 36-37 20 0 34 15 36 37 2 20 7 34 17 44 5 5 2 12-5 13-36 7-73 7-109 0-7-1-9-8-4-13h12Z"
          fill="url(#bellBody)"
          stroke="url(#metalStroke)"
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
        <Path
          d="M57 109c12-13 16-27 18-45 2-14 10-24 21-27"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.82"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <Path
          d="M54 117c25 7 60 8 92 0"
          fill="none"
          stroke="url(#bellRim)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <Path
          d="M57 115c25 5 58 6 86 0"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.62"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <Circle
          cx="99"
          cy="132"
          r="14"
          fill="url(#clapper)"
          stroke="url(#metalStroke)"
          strokeWidth="2.4"
        />
        <Circle cx="95" cy="128" r="5" fill="#FFFFFF" opacity="0.44" />
        <Circle
          cx="143"
          cy="49"
          r="22"
          fill="url(#bubble)"
          stroke="url(#metalStroke)"
          strokeWidth="2.2"
        />
        <Circle cx="136" cy="42" r="7" fill="#FFFFFF" opacity="0.56" />
        <Path
          d="M69 54c5-11 14-17 25-19"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.65"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <Path
          d="M127 78c2 13 6 23 13 31"
          fill="none"
          stroke="#DDAEFF"
          strokeOpacity="0.48"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}
