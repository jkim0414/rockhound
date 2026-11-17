// Small inline SVG drawings: crystal-system wireframes and the mystery rock.

const poly = pts => pts.map(p => p.join(",")).join(" ");
function box(front, [dx, dy]) {
  const back = front.map(([x, y]) => [x + dx, y + dy]);
  return `<polygon points="${poly(back)}" class="cb"/>` +
    front.map((p, i) => `<line x1="${p[0]}" y1="${p[1]}" x2="${back[i][0]}" y2="${back[i][1]}" class="cb"/>`).join("") +
    `<polygon points="${poly(front)}" class="cf"/>`;
}

const SHAPES = {
  cubic: box([[8, 22], [36, 22], [36, 50], [8, 50]], [14, -12]),
  tetragonal: box([[16, 16], [36, 16], [36, 56], [16, 56]], [10, -9]),
  orthorhombic: box([[4, 30], [44, 30], [44, 52], [4, 52]], [12, -14]),
  monoclinic: box([[18, 18], [42, 18], [32, 54], [8, 54]], [12, -9]),
  triclinic: box([[18, 24], [48, 18], [38, 50], [6, 56]], [6, -12]),
  trigonal: `<polygon points="30,14 56,25 56,43 30,54 4,43 4,25" class="cf"/><polyline points="4,25 30,36 56,25" class="cf" fill="none"/><line x1="30" y1="36" x2="30" y2="54" class="cf"/>`,
  hexagonal: `<polygon points="50,14 40,8 20,8 10,14 20,20 40,20" class="cf"/><polyline points="10,14 10,46 20,52 40,52 50,46 50,14" class="cf" fill="none"/><line x1="20" y1="20" x2="20" y2="52" class="cf"/><line x1="40" y1="20" x2="40" y2="52" class="cf"/>`,
  none: `<path d="M12 40 q4 -22 20 -24 q18 -2 20 16 q2 18 -18 20 q-18 2 -22 -12z" class="cf"/><text x="31" y="41" text-anchor="middle" font-size="13" class="ct">no crystals</text>`,
};

export function crystalSVG(id, size = 54) {
  return `<svg class="crystal" width="${size}" height="${size}" viewBox="0 0 60 62" aria-hidden="true">${SHAPES[id] || SHAPES.none}</svg>`;
}

// Mystery rock. `cracks` 0-3 shows that many cracks; hue tints the stone.
const ROCK_TINTS = [["#8d7b6a", "#6f5f51", "#a8957f"], ["#77808c", "#5b636e", "#96a0ad"], ["#8a6f7e", "#6b5562", "#a88c9b"]];
export function mysteryRock(variant = 0, cracks = 0) {
  const [mid, dark, light] = ROCK_TINTS[variant % 3];
  const c = [
    `<path class="crack" d="M96 22 l-8 22 l12 14 l-10 20"/>`,
    `<path class="crack" d="M40 62 l22 6 l10 -12 l18 22 l-6 18"/>`,
    `<path class="crack" d="M150 70 l-22 4 l-14 18 l-22 -6 M90 78 l-12 30 l10 22"/>`,
  ].slice(0, cracks).join("");
  return `<svg class="mrock v${variant % 3}" viewBox="0 0 190 150" aria-hidden="true">
    <ellipse cx="96" cy="138" rx="74" ry="8" fill="rgba(0,0,0,.28)"/>
    <path d="M30 108 L18 74 L38 36 L82 14 L132 20 L166 52 L174 92 L150 126 L92 136 L48 128 Z" fill="${mid}" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M38 36 L82 14 L132 20 L104 46 L62 50 Z" fill="${light}" opacity=".75"/>
    <path d="M104 46 L132 20 L166 52 L140 74 Z" fill="${light}" opacity=".4"/>
    <path d="M30 108 L62 50 L104 46 L140 74 L150 126 L92 136 L48 128 Z" fill="${dark}" opacity=".28"/>
    <text x="96" y="100" text-anchor="middle" font-size="46" font-weight="800" fill="#fff" opacity=".85" class="qmark">?</text>
    ${c}</svg>`;
}
