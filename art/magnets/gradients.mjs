// Shared resin gradients (docs/agent-guide-resin-magnet.md §2.1).
// One light from the top-left; every magnet uses these materials.

export const GRADIENTS = `
<linearGradient id="scGold" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FFF3B8"/><stop offset=".45" stop-color="#F2C443"/><stop offset="1" stop-color="#B8860B"/>
</linearGradient>
<radialGradient id="scGoldRadial" cx=".35" cy=".3" r=".85">
  <stop offset="0" stop-color="#FFF8D2"/><stop offset=".55" stop-color="#F2C443"/><stop offset="1" stop-color="#B8860B"/>
</radialGradient>
<linearGradient id="scGlass" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#F2FBFF"/><stop offset=".45" stop-color="#BDDFF0"/><stop offset="1" stop-color="#7FAFC8"/>
</linearGradient>
<linearGradient id="scSteel" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#F7F8F9"/><stop offset=".45" stop-color="#B9C0C6"/><stop offset="1" stop-color="#6F767D"/>
</linearGradient>
<linearGradient id="scBlue" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#A7D8FA"/><stop offset=".45" stop-color="#3B8FD6"/><stop offset="1" stop-color="#1E5E9E"/>
</linearGradient>
<linearGradient id="scBlueDeep" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#6EB8F0"/><stop offset=".5" stop-color="#2F80C9"/><stop offset="1" stop-color="#174B7E"/>
</linearGradient>
<linearGradient id="scRed" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FFAAA0"/><stop offset=".5" stop-color="#D9564A"/><stop offset="1" stop-color="#8E2A22"/>
</linearGradient>
<linearGradient id="scGreen" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#B8F2BE"/><stop offset=".5" stop-color="#3BA55D"/><stop offset="1" stop-color="#1F6B3A"/>
</linearGradient>
<linearGradient id="scYellow" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FFF7C4"/><stop offset=".5" stop-color="#F2D24B"/><stop offset="1" stop-color="#C9A227"/>
</linearGradient>
<radialGradient id="scYellowRadial" cx=".35" cy=".3" r=".85">
  <stop offset="0" stop-color="#FFFBDA"/><stop offset=".55" stop-color="#F4D84F"/><stop offset="1" stop-color="#C9A227"/>
</radialGradient>
<linearGradient id="scPurple" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#D8C2F7"/><stop offset=".5" stop-color="#8E6FD0"/><stop offset="1" stop-color="#5B3FA0"/>
</linearGradient>
<linearGradient id="scWhite" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#F3F1EA"/><stop offset="1" stop-color="#D8D5CC"/>
</linearGradient>
<linearGradient id="scPaper" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FFFDF7"/><stop offset="1" stop-color="#EFE5D3"/>
</linearGradient>
<linearGradient id="scNavy" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#7D93C4"/><stop offset=".5" stop-color="#3D5A98"/><stop offset="1" stop-color="#1F3566"/>
</linearGradient>
<linearGradient id="scPink" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FFDCE7"/><stop offset=".5" stop-color="#E88AA0"/><stop offset="1" stop-color="#B95670"/>
</linearGradient>
<linearGradient id="scTeal" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#B8F4EC"/><stop offset=".5" stop-color="#2A9D8F"/><stop offset="1" stop-color="#16685F"/>
</linearGradient>

<!-- Cute originals: pastel plush, satin ribbon, toy bread and lavender -->
<linearGradient id="cuPink" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FFE7EF"/><stop offset=".5" stop-color="#F2A9BE"/><stop offset="1" stop-color="#C4708A"/>
</linearGradient>
<linearGradient id="cuPinkDeep" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#F9C3D1"/><stop offset=".5" stop-color="#DE8AA4"/><stop offset="1" stop-color="#A9536D"/>
</linearGradient>
<radialGradient id="cuPinkRadial" cx=".35" cy=".3" r=".85">
  <stop offset="0" stop-color="#FFF2F6"/><stop offset=".55" stop-color="#F4BBC9"/><stop offset="1" stop-color="#D0879C"/>
</radialGradient>
<linearGradient id="cuCream" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FFFDF9"/><stop offset=".55" stop-color="#F9EEE8"/><stop offset="1" stop-color="#E4D0C8"/>
</linearGradient>
<linearGradient id="cuToast" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FCE9BC"/><stop offset=".5" stop-color="#E7BC70"/><stop offset="1" stop-color="#B9832F"/>
</linearGradient>
<linearGradient id="cuStrawberry" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FF9E90"/><stop offset=".5" stop-color="#E4544A"/><stop offset="1" stop-color="#A32B27"/>
</linearGradient>
<linearGradient id="cuLav" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#EFE4FC"/><stop offset=".5" stop-color="#BFA6E8"/><stop offset="1" stop-color="#7E63B5"/>
</linearGradient>
<linearGradient id="cuMint" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#E2F8EA"/><stop offset=".5" stop-color="#A8E0C0"/><stop offset="1" stop-color="#6BB491"/>
</linearGradient>
<linearGradient id="ktCardboard" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#E6CDA5"/><stop offset=".5" stop-color="#C9A77A"/><stop offset="1" stop-color="#9C7648"/>
</linearGradient>
<linearGradient id="ktBurlap" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FFF6E8"/><stop offset=".5" stop-color="#E8D3B0"/><stop offset="1" stop-color="#C6A87C"/>
</linearGradient>
<linearGradient id="ktBasket" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#D0965C"/><stop offset=".5" stop-color="#A66B3A"/><stop offset="1" stop-color="#6E421F"/>
</linearGradient>
<linearGradient id="ktBread" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FFE7B5"/><stop offset=".5" stop-color="#D9A05A"/><stop offset="1" stop-color="#A86A2E"/>
</linearGradient>
<linearGradient id="ktShell" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FFFBF2"/><stop offset=".5" stop-color="#F3E3C6"/><stop offset="1" stop-color="#D8C2A0"/>
</linearGradient>
<linearGradient id="ktWine" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#5A8668"/><stop offset=".5" stop-color="#2F4F3A"/><stop offset="1" stop-color="#1B3024"/>
</linearGradient>
<linearGradient id="ktMilk" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#F3F7FA"/><stop offset="1" stop-color="#D8E4EC"/>
</linearGradient>
`;
