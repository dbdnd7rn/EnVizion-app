import { themeTint } from "../themeColors";
import React from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

export function SpiritualLandscapeArt({ height = 300 }: { height?: number }) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      style={{ width: "100%", height }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 440 300"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id="spiritualSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFF9F3" />
            <Stop offset="0.5" stopColor="#F8ECF8" />
            <Stop offset="1" stopColor="#E6D3F2" />
          </LinearGradient>
          <LinearGradient id="spiritualHillFar" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#DFC9EE" />
            <Stop offset="1" stopColor="#C6A7DE" />
          </LinearGradient>
          <LinearGradient id="spiritualHillMid" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#CBAFDF" />
            <Stop offset="1" stopColor="#A889C6" />
          </LinearGradient>
          <LinearGradient id="spiritualHillNear" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#B798CF" />
            <Stop offset="1" stopColor="#8565A9" />
          </LinearGradient>
          <LinearGradient id="spiritualPath" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFDF4" />
            <Stop offset="1" stopColor="#F7EEDC" />
          </LinearGradient>
          <LinearGradient id="spiritualMist" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.62" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.5" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width="440" height="300" fill="url(#spiritualSky)" />
        <Circle cx="329" cy="83" r="34" fill="#FFE5A6" opacity="0.82" />
        <Circle cx="329" cy="83" r="50" fill="#FFF0C6" opacity="0.16" />

        <Path
          d="M0 120C53 141 83 138 128 120C179 100 212 130 262 126C315 122 358 93 440 105V188H0Z"
          fill="#EADBF3"
          opacity="0.92"
        />
        <Path
          d="M0 142C59 116 91 118 132 132C177 147 209 143 247 129C307 108 348 121 440 144V213H0Z"
          fill="url(#spiritualHillFar)"
        />
        <Path
          d="M0 171C42 152 78 144 113 155C157 169 190 189 243 173C302 156 345 143 440 167V235H0Z"
          fill="url(#spiritualHillMid)"
        />
        <Path
          d="M0 202C49 180 83 174 126 187C169 200 203 226 258 205C318 183 361 176 440 198V300H0Z"
          fill="url(#spiritualHillNear)"
        />

        <Path
          d="M365 154C331 163 300 165 288 176C277 186 299 191 323 196C348 201 350 210 330 218C306 228 270 229 253 241C238 252 259 262 286 270C308 276 320 284 320 300H369C369 278 347 265 318 255C293 247 291 241 310 234C340 222 377 218 379 204C381 191 350 185 333 181C319 177 320 172 336 169C348 166 360 163 373 158Z"
          fill="url(#spiritualPath)"
          opacity="0.98"
        />

        <Path
          d="M0 164C78 185 153 184 223 169C299 153 359 151 440 168"
          fill="none"
          stroke="url(#spiritualMist)"
          strokeWidth="12"
          opacity="0.35"
        />

        <G opacity="0.94">
          <Path d="M18 300C20 250 20 212 24 182" stroke={themeTint("#694781")} strokeWidth="3" fill="none" />
          <Path d="M24 222C12 211 8 200 10 190C22 194 29 205 24 222Z" fill="#75538F" />
          <Path d="M24 239C36 226 42 214 42 202C28 207 20 222 24 239Z" fill="#6E4B88" />
          <Path d="M24 263C9 251 3 238 4 226C18 232 28 246 24 263Z" fill="#80619A" />

          <Path d="M48 300C49 255 50 221 55 194" stroke="#805A99" strokeWidth="3" fill="none" />
          <Path d="M54 222C42 212 39 201 40 191C53 196 61 208 54 222Z" fill="#8965A0" />
          <Path d="M55 245C68 232 72 220 70 209C57 216 50 230 55 245Z" fill="#75538F" />
          <Path d="M54 265C41 257 34 245 34 234C48 238 58 250 54 265Z" fill="#9470AB" />

          <Path d="M78 300C79 266 82 241 87 218" stroke="#6D4A86" strokeWidth="2.5" fill="none" />
          <Ellipse cx="79" cy="233" rx="9" ry="16" fill={themeTint("#795690")} transform="rotate(-28 79 233)" />
          <Ellipse cx="94" cy="247" rx="9" ry="15" fill="#9470A8" transform="rotate(30 94 247)" />
          <Ellipse cx="75" cy="265" rx="8" ry="13" fill="#A17CB4" transform="rotate(-34 75 265)" />
        </G>

        <G opacity="0.64">
          <Path d="M403 300C402 270 400 242 396 219" stroke="#8A69A1" strokeWidth="2.5" fill="none" />
          <Ellipse cx="389" cy="237" rx="7" ry="13" fill="#A889BD" transform="rotate(-34 389 237)" />
          <Ellipse cx="407" cy="250" rx="8" ry="14" fill="#9673AC" transform="rotate(30 407 250)" />
          <Ellipse cx="393" cy="271" rx="7" ry="12" fill="#B191C2" transform="rotate(-30 393 271)" />
        </G>

        <G fill="#D9B9D9" opacity="0.75">
          <Circle cx="105" cy="244" r="3" />
          <Circle cx="114" cy="253" r="2.5" />
          <Circle cx="98" cy="262" r="2.5" />
          <Circle cx="372" cy="248" r="2.5" />
          <Circle cx="381" cy="258" r="3" />
          <Circle cx="360" cy="266" r="2.5" />
        </G>
      </Svg>
    </View>
  );
}
