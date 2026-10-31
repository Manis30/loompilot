import React from 'react';

interface GarmentVisual3DProps {
  designCode?: string;
  size?: 'hero' | 'thumb';
  className?: string;
  photoUrl?: string;
  usePhoto?: boolean;
}

/**
 * 3D-Styled Garment Visualizations for LoomPilot Textile Configurator
 * Transparent background, 3D lighting, fabric weave gradients, realistic garment silhouettes.
 * Directly matches the 3D floating object aesthetic from order.mp4.
 */
export const GarmentVisual3D: React.FC<GarmentVisual3DProps> = ({
  designCode = 'FS-A-01',
  size = 'hero',
  className = '',
  photoUrl,
  usePhoto = false
}) => {
  if (usePhoto && photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`Garment ${designCode}`}
        className={className}
        style={{
          width: size === 'hero' ? '82%' : '100%',
          maxHeight: size === 'hero' ? 360 : 44,
          objectFit: 'contain',
          filter: size === 'hero' ? 'drop-shadow(0 20px 30px rgba(0,0,0,0.25))' : 'none',
          borderRadius: size === 'hero' ? 18 : 8
        }}
      />
    );
  }

  // Design A: Crisp 3D Oxford Formal Shirt (Violet/Lavender Accent Vibe)
  if (designCode === 'FS-A-01' || designCode.includes('FS') || designCode.includes('Shirt') && !designCode.includes('CS')) {
    if (size === 'thumb') {
      return (
        <svg viewBox="0 0 100 100" width="38" height="38" className={className} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
          <defs>
            <linearGradient id="thumbShirtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="50%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
            <linearGradient id="thumbCollarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
          </defs>
          {/* Shirt Body */}
          <path d="M22 30 L32 18 L68 18 L78 30 L74 84 L26 84 Z" fill="url(#thumbShirtGrad)" />
          {/* Sleeves */}
          <path d="M22 30 L8 50 L18 56 L26 42 Z" fill="#cbd5e1" />
          <path d="M78 30 L92 50 L82 56 L74 42 Z" fill="#cbd5e1" />
          {/* Placket */}
          <rect x="47" y="26" width="6" height="58" fill="#ffffff" />
          {/* Collar */}
          <polygon points="35,18 50,30 45,34 32,24" fill="url(#thumbCollarGrad)" stroke="#94a3b8" strokeWidth="0.8" />
          <polygon points="65,18 50,30 55,34 68,24" fill="url(#thumbCollarGrad)" stroke="#94a3b8" strokeWidth="0.8" />
          {/* Buttons */}
          <circle cx="50" cy="38" r="1.5" fill="#64748b" />
          <circle cx="50" cy="50" r="1.5" fill="#64748b" />
          <circle cx="50" cy="62" r="1.5" fill="#64748b" />
          <circle cx="50" cy="74" r="1.5" fill="#64748b" />
        </svg>
      );
    }

    return (
      <svg
        viewBox="0 0 400 420"
        className={className}
        style={{
          width: '88%',
          maxWidth: 420,
          height: 'auto',
          filter: 'drop-shadow(0 25px 35px rgba(13, 26, 44, 0.28))'
        }}
      >
        <defs>
          <linearGradient id="shirtBodyGrad" x1="15%" y1="10%" x2="85%" y2="90%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#f1f5f9" />
            <stop offset="75%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>

          <linearGradient id="shirtLeftSleeveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="50%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>

          <linearGradient id="shirtRightSleeveGrad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>

          <linearGradient id="collarGradLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>

          <linearGradient id="collarGradRight" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>

          <radialGradient id="buttonShine" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#94a3b8" />
          </radialGradient>

          <filter id="garmentDepth" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* Left Sleeve with 3D Fold */}
        <g id="left-sleeve">
          <path
            d="M 105 110 L 40 215 C 38 220, 48 235, 78 245 L 115 175 L 118 135 Z"
            fill="url(#shirtLeftSleeveGrad)"
            stroke="#94a3b8"
            strokeWidth="1.2"
          />
          {/* Left Cuff */}
          <path
            d="M 40 215 C 45 220, 65 235, 78 245 L 84 240 C 72 230, 52 215, 46 210 Z"
            fill="#ffffff"
            stroke="#94a3b8"
            strokeWidth="1"
          />
          <circle cx="62" cy="230" r="3" fill="url(#buttonShine)" stroke="#64748b" strokeWidth="0.8" />
        </g>

        {/* Right Sleeve with 3D Fold */}
        <g id="right-sleeve">
          <path
            d="M 295 110 L 360 215 C 362 220, 352 235, 322 245 L 285 175 L 282 135 Z"
            fill="url(#shirtRightSleeveGrad)"
            stroke="#94a3b8"
            strokeWidth="1.2"
          />
          {/* Right Cuff */}
          <path
            d="M 360 215 C 355 220, 335 235, 322 245 L 316 240 C 328 230, 348 215, 354 210 Z"
            fill="#ffffff"
            stroke="#94a3b8"
            strokeWidth="1"
          />
          <circle cx="338" cy="230" r="3" fill="url(#buttonShine)" stroke="#64748b" strokeWidth="0.8" />
        </g>

        {/* Main Torso / Shirt Body with Tailored Waist and Hem */}
        <g id="shirt-body">
          <path
            d="M 105 110 
               C 135 65, 265 65, 295 110 
               L 290 350 
               C 255 365, 215 368, 200 368 
               C 185 368, 145 365, 110 350 
               Z"
            fill="url(#shirtBodyGrad)"
            stroke="#94a3b8"
            strokeWidth="1.5"
            filter="url(#garmentDepth)"
          />

          {/* Draping Creases (3D Oxford Fabric Feel) */}
          <path d="M 125 150 Q 145 220 135 320" stroke="rgba(148, 163, 184, 0.4)" strokeWidth="2" fill="none" />
          <path d="M 275 150 Q 255 220 265 320" stroke="rgba(148, 163, 184, 0.4)" strokeWidth="2" fill="none" />
          <path d="M 180 340 Q 200 355 220 340" stroke="rgba(148, 163, 184, 0.3)" strokeWidth="1.5" fill="none" />
        </g>

        {/* Front Chest Pocket (Left Chest) */}
        <g id="chest-pocket">
          <path
            d="M 135 175 L 175 175 L 175 220 L 155 232 L 135 220 Z"
            fill="#f8fafc"
            stroke="#94a3b8"
            strokeWidth="1.2"
          />
          <line x1="135" y1="184" x2="175" y2="184" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2,2" />
        </g>

        {/* Central Button Placket */}
        <g id="button-placket">
          <path
            d="M 188 95 L 212 95 L 212 368 L 188 368 Z"
            fill="#ffffff"
            stroke="#94a3b8"
            strokeWidth="1"
          />
          {/* Placket Stitching Lines */}
          <line x1="191" y1="95" x2="191" y2="368" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="3,2" />
          <line x1="209" y1="95" x2="209" y2="368" stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="3,2" />

          {/* Mother of Pearl Buttons with 4-hole detail */}
          {[130, 180, 230, 280, 330].map((yVal, i) => (
            <g key={i}>
              <circle cx="200" cy={yVal} r="6" fill="url(#buttonShine)" stroke="#94a3b8" strokeWidth="1" />
              <circle cx="198" cy={yVal - 2} r="0.9" fill="#475569" />
              <circle cx="202" cy={yVal - 2} r="0.9" fill="#475569" />
              <circle cx="198" cy={yVal + 2} r="0.9" fill="#475569" />
              <circle cx="202" cy={yVal + 2} r="0.9" fill="#475569" />
              <line x1="198" y1={yVal - 2} x2="202" y2={yVal + 2} stroke="#475569" strokeWidth="0.6" />
              <line x1="202" y1={yVal - 2} x2="198" y2={yVal + 2} stroke="#475569" strokeWidth="0.6" />
            </g>
          ))}
        </g>

        {/* Collar Stand & Inner Neck Band */}
        <ellipse cx="200" cy="85" rx="42" ry="16" fill="#475569" />
        <ellipse cx="200" cy="82" rx="38" ry="13" fill="#cbd5e1" />

        {/* 3D Spread Collar Wings */}
        <g id="collar-wings">
          {/* Left Collar Leaf */}
          <path
            d="M 148 78 L 200 120 L 178 135 L 138 94 Z"
            fill="url(#collarGradLeft)"
            stroke="#64748b"
            strokeWidth="1.4"
            filter="url(#garmentDepth)"
          />
          {/* Right Collar Leaf */}
          <path
            d="M 252 78 L 200 120 L 222 135 L 262 94 Z"
            fill="url(#collarGradRight)"
            stroke="#64748b"
            strokeWidth="1.4"
            filter="url(#garmentDepth)"
          />
          {/* Collar Edge Stitching */}
          <path d="M 152 82 L 196 117 L 180 128 L 144 94" fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2,2" />
          <path d="M 248 82 L 204 117 L 220 128 L 256 94" fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2,2" />
        </g>

        {/* Spec Watermark Label: 40s Oxford */}
        <text x="200" y="405" textAnchor="middle" fontSize="12" fontWeight="800" fill="#64748b" letterSpacing="1">
          40S COMBED COTTON · OXFORD WEAVE
        </text>
      </svg>
    );
  }

  // Design B: Tailored 3D Formal Pants / Trousers (Warm Golden Amber Vibe)
  if (designCode === 'FP-B-02' || designCode.includes('FP') || designCode.includes('Pants') || designCode.includes('Trousers')) {
    if (size === 'thumb') {
      return (
        <svg viewBox="0 0 100 100" width="38" height="38" className={className} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
          <defs>
            <linearGradient id="thumbPantsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="50%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>
          <path d="M28 20 L72 20 L76 86 L53 86 L50 48 L47 86 L24 86 Z" fill="url(#thumbPantsGrad)" />
          {/* Waistband */}
          <rect x="28" y="20" width="44" height="6" fill="#475569" />
          {/* Creases */}
          <line x1="38" y1="26" x2="36" y2="86" stroke="#64748b" strokeWidth="0.8" />
          <line x1="62" y1="26" x2="64" y2="86" stroke="#64748b" strokeWidth="0.8" />
        </svg>
      );
    }

    return (
      <svg
        viewBox="0 0 400 420"
        className={className}
        style={{
          width: '88%',
          maxWidth: 420,
          height: 'auto',
          filter: 'drop-shadow(0 25px 35px rgba(15, 23, 42, 0.32))'
        }}
      >
        <defs>
          <linearGradient id="pantsTwillGrad" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="35%" stopColor="#334155" />
            <stop offset="70%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          <linearGradient id="waistbandGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>

          <filter id="creaseShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="1" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Waistband with Tab Extension */}
        <g id="waistband">
          <path
            d="M 115 50 L 285 50 C 285 62, 280 66, 275 68 L 125 68 C 120 66, 115 62, 115 50 Z"
            fill="url(#waistbandGrad)"
            stroke="#1e293b"
            strokeWidth="1.5"
          />
          {/* Belt Loops */}
          {[135, 170, 200, 230, 265].map((xVal, i) => (
            <rect key={i} x={xVal} y="48" width="5" height="22" rx="1.5" fill="#334155" stroke="#1e293b" strokeWidth="0.8" />
          ))}
          {/* Tab Button */}
          <circle cx="195" cy="59" r="3.5" fill="#94a3b8" stroke="#1e293b" strokeWidth="1" />
        </g>

        {/* Slanted Side Pockets */}
        <path d="M 125 68 L 140 120" stroke="#1e293b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M 275 68 L 260 120" stroke="#1e293b" strokeWidth="1.8" fill="none" strokeLinecap="round" />

        {/* Front Fly Placket */}
        <path d="M 200 68 L 200 135 C 190 145, 185 145, 182 142" stroke="#1e293b" strokeWidth="1.6" fill="none" />

        {/* Left & Right Legs (Tapered Tailored Cut) */}
        <g id="trousers-legs">
          {/* Full Contour */}
          <path
            d="M 115 50 
               L 100 240 
               L 115 375 
               L 182 375 
               L 198 160 
               L 202 160 
               L 218 375 
               L 285 375 
               L 300 240 
               L 285 50 
               Z"
            fill="url(#pantsTwillGrad)"
            stroke="#1e293b"
            strokeWidth="1.5"
          />

          {/* Sharp Center Creases (Tailored 3D Ironed Crease) */}
          <g filter="url(#creaseShadow)">
            {/* Left Leg Crease */}
            <path
              d="M 152 68 L 146 200 L 148 375"
              stroke="#94a3b8"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
              opacity="0.8"
            />
            {/* Right Leg Crease */}
            <path
              d="M 248 68 L 254 200 L 252 375"
              stroke="#94a3b8"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
              opacity="0.8"
            />
          </g>

          {/* Crotch & Knee Flow Creases */}
          <path d="M 130 230 Q 150 245 165 235" stroke="rgba(15, 23, 42, 0.6)" strokeWidth="2" fill="none" />
          <path d="M 270 230 Q 250 245 235 235" stroke="rgba(15, 23, 42, 0.6)" strokeWidth="2" fill="none" />

          {/* Tailored Ankle Hem Turn-ups */}
          <rect x="115" y="365" width="67" height="10" rx="1.5" fill="#334155" stroke="#1e293b" strokeWidth="1" />
          <rect x="218" y="365" width="67" height="10" rx="1.5" fill="#334155" stroke="#1e293b" strokeWidth="1" />
        </g>

        {/* Spec Watermark Label: 240 GSM Twill */}
        <text x="200" y="405" textAnchor="middle" fontSize="12" fontWeight="800" fill="#64748b" letterSpacing="1">
          30S RING SPUN · 240 GSM HEAVY TWILL
        </text>
      </svg>
    );
  }

  // Design C: Casual Relaxed Chambray / Linen Shirt (Fresh Turquoise / Mint Vibe)
  if (size === 'thumb') {
    return (
      <svg viewBox="0 0 100 100" width="38" height="38" className={className} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
        <defs>
          <linearGradient id="thumbCasualGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="50%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>
        </defs>
        <path d="M24 30 L34 18 L66 18 L76 30 L72 82 L28 82 Z" fill="url(#thumbCasualGrad)" />
        <path d="M24 30 L10 48 L18 54 L26 42 Z" fill="#0f766e" />
        <path d="M76 30 L90 48 L82 54 L74 42 Z" fill="#0f766e" />
        <polygon points="34,18 50,30 42,34 30,24" fill="#ffffff" />
        <polygon points="66,18 50,30 58,34 70,24" fill="#ffffff" />
        <circle cx="50" cy="42" r="1.5" fill="#ffffff" />
        <circle cx="50" cy="56" r="1.5" fill="#ffffff" />
        <circle cx="50" cy="70" r="1.5" fill="#ffffff" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 400 420"
      className={className}
      style={{
        width: '88%',
        maxWidth: 420,
        height: 'auto',
        filter: 'drop-shadow(0 25px 35px rgba(15, 118, 110, 0.28))'
      }}
    >
      <defs>
        <linearGradient id="casualChambrayGrad" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#99f6e4" />
          <stop offset="35%" stopColor="#2dd4bf" />
          <stop offset="70%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>

        <linearGradient id="campCollarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ccfbf1" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>

        <radialGradient id="coconutButton" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="60%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#78350f" />
        </radialGradient>
      </defs>

      {/* Relaxed Sleeves (Rolled Cuffs) */}
      <g id="casual-sleeves">
        {/* Left Sleeve */}
        <path d="M 110 115 L 50 195 L 75 210 L 122 145 Z" fill="#0d9488" stroke="#115e59" strokeWidth="1.2" />
        {/* Left Rolled Cuff */}
        <path d="M 50 195 L 68 180 L 88 195 L 75 210 Z" fill="#ccfbf1" stroke="#0f766e" strokeWidth="1" />

        {/* Right Sleeve */}
        <path d="M 290 115 L 350 195 L 325 210 L 278 145 Z" fill="#0d9488" stroke="#115e59" strokeWidth="1.2" />
        {/* Right Rolled Cuff */}
        <path d="M 350 195 L 332 180 L 312 195 L 325 210 Z" fill="#ccfbf1" stroke="#0f766e" strokeWidth="1" />
      </g>

      {/* Casual Body with Organic Linen/Chambray Folds */}
      <g id="casual-body">
        <path
          d="M 110 115 
             C 135 75, 265 75, 290 115 
             L 282 355 
             C 245 368, 210 370, 200 370 
             C 190 370, 155 368, 118 355 
             Z"
          fill="url(#casualChambrayGrad)"
          stroke="#0f766e"
          strokeWidth="1.5"
        />

        {/* Linen Texture Highlights & Wrinkles */}
        <path d="M 130 160 Q 170 195 145 280" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="2" fill="none" />
        <path d="M 270 160 Q 230 195 255 280" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="2" fill="none" />
        <path d="M 160 320 Q 200 340 240 320" stroke="rgba(15, 118, 110, 0.5)" strokeWidth="2" fill="none" />
      </g>

      {/* Casual Patch Pocket with Button Tab */}
      <g id="casual-patch-pocket">
        <path d="M 138 180 L 175 180 L 175 222 L 156 232 L 138 222 Z" fill="#2dd4bf" stroke="#0f766e" strokeWidth="1.2" />
        <circle cx="156" cy="190" r="3" fill="url(#coconutButton)" stroke="#78350f" strokeWidth="0.8" />
      </g>

      {/* Center Placket */}
      <g id="casual-placket">
        <path d="M 190 90 L 210 90 L 210 370 L 190 370 Z" fill="#14b8a6" stroke="#0f766e" strokeWidth="1" />
        {/* Coconut Shell Buttons */}
        {[135, 185, 235, 285, 335].map((yVal, i) => (
          <g key={i}>
            <circle cx="200" cy={yVal} r="6.5" fill="url(#coconutButton)" stroke="#78350f" strokeWidth="1" />
            <circle cx="198" cy={yVal} r="1" fill="#451a03" />
            <circle cx="202" cy={yVal} r="1" fill="#451a03" />
          </g>
        ))}
      </g>

      {/* Open Camp / Resort Collar */}
      <g id="open-camp-collar">
        {/* Left Lapel */}
        <path d="M 145 85 L 200 135 L 170 145 L 130 100 Z" fill="url(#campCollarGrad)" stroke="#0f766e" strokeWidth="1.4" />
        {/* Right Lapel */}
        <path d="M 255 85 L 200 135 L 230 145 L 270 100 Z" fill="url(#campCollarGrad)" stroke="#0f766e" strokeWidth="1.4" />
      </g>

      {/* Spec Watermark Label: 50s Chambray */}
      <text x="200" y="405" textAnchor="middle" fontSize="12" fontWeight="800" fill="#0f766e" letterSpacing="1">
        50S COMPACT POPLIN · 160 GSM CHAMBRAY
      </text>
    </svg>
  );
};
export default GarmentVisual3D;

