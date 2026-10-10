import React from "react";
import { Platform } from "react-native";
import Svg, {
  Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop,
} from "react-native-svg";
import { useAppearance } from "../appearance";

/**
 * Scenic artwork for the home hero only. Kept separate from the actual
 * greeting, profile and controls so the UI remains fully accessible and live.
 */
export function HomeJourneyArtwork({ height = 420 }: { height?: number }) {
  const { dark } = useAppearance();

  return (
    <Svg
      width="100%"
      height={height}
      viewBox="0 0 440 420"
      preserveAspectRatio="xMidYMid slice"
      {...(Platform.OS === "web"
        ? { "aria-hidden": true }
        : { accessibilityElementsHidden: true })}
    >
      <Defs>
        <LinearGradient id="journeySky" x1="0%" y1="0%" x2="100%" y2="65%">
          <Stop offset="0%" stopColor={dark ? "#1B1725" : "#FFFDFC"} />
          <Stop offset="45%" stopColor={dark ? "#241C34" : "#FFF9F8"} />
          <Stop offset="79%" stopColor={dark ? "#483558" : "#F8E7FA"} />
          <Stop offset="100%" stopColor={dark ? "#644C82" : "#DFC4F5"} />
        </LinearGradient>
        <RadialGradient id="journeySunGlow" cx="80%" cy="48%" rx="49%" ry="47%">
          <Stop offset="0%" stopColor={dark ? "#B9A2D0" : "#FFF9D5"} stopOpacity={dark ? 0.36 : 0.98} />
          <Stop offset="39%" stopColor={dark ? "#77547F" : "#FFF0E1"} stopOpacity={dark ? 0.22 : 0.75} />
          <Stop offset="100%" stopColor="#F5E5F4" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="journeyHorizon" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={dark ? "#625276" : "#E4CAE9"} stopOpacity="0.48" />
          <Stop offset="100%" stopColor={dark ? "#4B3D66" : "#AE8ACF"} stopOpacity="0.72" />
        </LinearGradient>
        <LinearGradient id="journeyDistance" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={dark ? "#6C5A86" : "#C9A9E1"} stopOpacity="0.30" />
          <Stop offset="100%" stopColor={dark ? "#51406A" : "#C7A5DE"} stopOpacity="0.94" />
        </LinearGradient>
        <LinearGradient id="journeyNear" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={dark ? "#5B456E" : "#D7BDED"} stopOpacity="0.55" />
          <Stop offset="100%" stopColor={dark ? "#49305F" : "#B58AD7"} stopOpacity="0.94" />
        </LinearGradient>
        <LinearGradient id="journeyRiver" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#FFF1F6" stopOpacity="0.1" />
          <Stop offset="57%" stopColor={dark ? "#BE8FAF" : "#FFF1EC"} stopOpacity="0.88" />
          <Stop offset="100%" stopColor={dark ? "#E2B8D4" : "#FFF9DF"} />
        </LinearGradient>
        <LinearGradient id="journeyWave" x1="7%" y1="0%" x2="90%" y2="100%">
          <Stop offset="0%" stopColor={dark ? "#53436B" : "#F5E8F9"} stopOpacity="0.03" />
          <Stop offset="45%" stopColor={dark ? "#72518D" : "#E7CDF4"} stopOpacity={dark ? 0.48 : 0.7} />
          <Stop offset="100%" stopColor={dark ? "#432C61" : "#CBA8E9"} stopOpacity={dark ? 0.9 : 0.92} />
        </LinearGradient>
        <LinearGradient id="journeyWaveLight" x1="0%" y1="0%" x2="85%" y2="100%">
          <Stop offset="0%" stopColor={dark ? "#7D6295" : "#FDF5FC"} stopOpacity="0.02" />
          <Stop offset="55%" stopColor={dark ? "#604877" : "#F4E5FC"} stopOpacity="0.78" />
          <Stop offset="100%" stopColor={dark ? "#54396E" : "#DFBDF3"} stopOpacity="0.84" />
        </LinearGradient>
        <LinearGradient id="journeyLeftWash" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={dark ? "#1B1725" : "#FFFDFC"} stopOpacity="0.98" />
          <Stop offset="37%" stopColor={dark ? "#1B1725" : "#FFFDFC"} stopOpacity="0.79" />
          <Stop offset="75%" stopColor={dark ? "#1B1725" : "#FFFDFC"} stopOpacity="0.16" />
          <Stop offset="100%" stopColor={dark ? "#1B1725" : "#FFFDFC"} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect width="440" height="420" fill="url(#journeySky)" />
      <Rect width="440" height="420" fill="url(#journeySunGlow)" />

      {/* The long soft ridge, glowing sunrise and layered valley. */}
      <Path d="M0 63 C97 79 154 22 249 56 C326 83 373 67 440 32 L440 0 L0 0 Z" fill={dark ? "#775E93" : "#F6E5FC"} opacity="0.18" />
      <Ellipse cx="342" cy="193" rx="132" ry="87" fill={dark ? "#CFADBB" : "#FFF6DB"} opacity={dark ? 0.14 : 0.22} />
      <Circle cx="348" cy="185" r="39" fill={dark ? "#CEACB1" : "#FFF9DB"} opacity={dark ? 0.65 : 0.88} />

      <Path d="M118 243 C159 211 177 219 212 200 C243 212 265 175 293 190 C324 161 357 188 381 164 C401 161 416 149 440 143 L440 333 L110 333 Z" fill="url(#journeyHorizon)" />
      <Path d="M93 263 C153 245 178 216 221 228 C246 214 278 231 309 208 C340 218 365 184 400 194 C416 191 433 170 440 171 L440 344 L74 344 Z" fill="url(#journeyDistance)" />
      <Path d="M136 298 C209 250 225 269 261 244 C296 233 331 263 374 228 C391 233 410 203 440 216 L440 362 L110 362 Z" fill="url(#journeyNear)" />

      {/* Silhouettes are intentionally gentle and do not compete with the headline. */}
      <G fill={dark ? "#6D537D" : "#AE8FC3"} opacity="0.4">
        <Path d="M303 287 l-6 -16 6 6 -2 -12 6 12 5 -8 -5 18 Z" />
        <Path d="M334 268 l-7 -20 8 9 -2 -14 8 16 4 -7 -5 16 Z" />
        <Path d="M357 267 l-6 -16 6 7 -2 -12 7 15 5 -7 -6 13 Z" />
        <Path d="M390 250 l-5 -17 6 8 -2 -15 7 18 4 -8 -5 14 Z" />
        <Path d="M277 292 l-4 -12 5 7 -1 -13 6 13 3 -5 -4 10 Z" />
      </G>

      {/* Receding meandering care journey, with a low-contrast luminous edge. */}
      <Path
        d="M401 232 C375 237 353 244 372 253 C403 267 377 278 332 289 C278 303 278 324 351 339 C417 354 352 389 257 422"
        fill="none"
        stroke={dark ? "#9E799E" : "#F9DEF8"}
        strokeWidth="27"
        strokeLinecap="round"
        opacity="0.52"
      />
      <Path
        d="M401 232 C375 237 353 244 372 253 C403 267 377 278 332 289 C278 303 278 324 351 339 C417 354 352 389 257 422"
        fill="none"
        stroke="url(#journeyRiver)"
        strokeWidth="17"
        strokeLinecap="round"
      />
      <Path
        d="M401 232 C375 237 353 244 372 253 C403 267 377 278 332 289 C278 303 278 324 351 339 C417 354 352 389 257 422"
        fill="none"
        stroke={dark ? "#D8BED9" : "#FFFBEE"}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.72"
      />

      {/* Quiet birds and botanical accent from the reference. */}
      <G stroke={dark ? "#B89ED1" : "#9F78B6"} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.86">
        <Path d="M259 131 q9 -9 18 0 q8 -8 17 -3" />
        <Path d="M314 108 q9 -10 19 0 q10 -11 20 -4" />
      </G>
      <G fill={dark ? "#76508E" : "#8760A8"} opacity="0.76">
        <Path d="M423 332 Q413 298 420 270 Q438 276 423 332 Z" />
        <Path d="M430 346 Q431 307 443 286 Q458 308 430 346 Z" />
        <Path d="M412 351 Q394 336 393 307 Q414 308 412 351 Z" />
        <Path d="M439 374 Q445 344 461 337 Q464 358 439 374 Z" />
        <Path d="M416 375 Q397 363 391 344 Q410 342 416 375 Z" />
      </G>
      <Path d="M426 407 Q421 355 431 316" fill="none" stroke={dark ? "#806399" : "#8D67A9"} strokeWidth="3" opacity="0.63" />

      {/* Readability wash, then translucent glass ribbons in the foreground. */}
      <Rect width="440" height="420" fill="url(#journeyLeftWash)" />
      <Path d="M0 340 C83 325 122 372 210 365 C296 360 335 295 440 304 L440 420 L0 420 Z" fill="url(#journeyWaveLight)" opacity="0.73" />
      <Path d="M0 388 C105 347 174 394 263 359 C347 321 372 312 440 333 L440 420 L0 420 Z" fill="url(#journeyWave)" opacity="0.88" />
      <Path d="M0 386 C129 349 172 404 286 365 C350 344 393 325 440 339" fill="none" stroke={dark ? "#C2A0E2" : "#FFF9FF"} strokeWidth="2.1" opacity="0.75" />
      <Path d="M119 420 C226 392 292 369 354 357 C391 350 413 362 440 376" fill="none" stroke={dark ? "#AB86D0" : "#FDF1FF"} strokeWidth="1.5" opacity="0.62" />
    </Svg>
  );
}
