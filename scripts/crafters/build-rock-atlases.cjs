// Run from the repo root with node scripts/crafters/build-rock-atlases.cjs.
const { mkdir } = require("node:fs/promises");
const { join } = require("node:path");
const sharp = require("sharp");
const atlas = require("../../lib/crafters/rock-atlas.json");
const { shapes, inclusions, crystals } = require("./rock-geometry.cjs");

const output = join(__dirname, "../../public/crafters/rocks");
const { tileWidth, tileHeight } = atlas;
const width = 160;
const height = 128;

// Top light, body, shaded side, ink, exposed material, and inclusion palette.
const palettes = {
  granite: ["#bbc1b8", "#828d88", "#536463", "#344649", "#a4b6ad"],
  coal: ["#838eac", "#525c79", "#343b59", "#242a43", "#8895ac", "#343d56", "#171d30", "#707e96"],
  copper: ["#c99a75", "#986d58", "#654c46", "#483641", "#f2a877", "#f4a269", "#b3513c", "#ffdf9c"],
  tin: ["#b3c9ce", "#7f9ca7", "#4f697c", "#334959", "#c2e7ee", "#f5ffff", "#8dc2d8", "#fbffff"],
  iron: ["#a3918f", "#6e626d", "#464354", "#322d41", "#bac0d0", "#a6b4c8", "#56657d", "#e0e7f1"],
  crystal: ["#a2a2d1", "#656593", "#3c4269", "#2d2c52", "#bcaeff"],
  "false-glint": ["#b3a68c", "#81786e", "#565157", "#443b42", "#bcb4a5", "#f7b87b", "#ab7056", "#ffe5a6"],
  "shiny-surface": ["#a7bdb2", "#758d87", "#456467", "#314c53", "#a2b4ad", "#e8ffe9", "#83b9b0", "#f1ffef"],
  "crystal-shell": ["#b2afd4", "#78788c", "#4a5067", "#35394f", "#a6a4ad", "#c7e2ff", "#7776ca", "#e0f7ff"],
};

const path = (d, fill, attrs = "") => `<path d="${d}" fill="${fill}" ${attrs}/>`;
const trace = (d, stroke, size, attrs = "") => path(d, "none",
  `stroke="${stroke}" stroke-width="${size}" stroke-linecap="round" stroke-linejoin="round" ${attrs}`);
const ellipse = (cx, cy, rx, ry, fill, attrs = "") =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${attrs}/>`;
const gradient = (id, a, b, x = 30, y = 17, bottom = 102) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x}" y1="${y}" x2="${x + 30}" y2="${bottom}"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const art = (content, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs>${content}</svg>`;

function outline(points) {
  const near = ([x, y], [otherX, otherY]) => `${Math.round(x * .84 + otherX * .16)} ${Math.round(y * .84 + otherY * .16)}`;
  return points.map((point, i) => {
    const previous = points.at(i - 1);
    const next = points[(i + 1) % points.length];
    return `${i ? "L" : "M"}${near(point, previous)}Q${point.join(" ")} ${near(point, next)}`;
  }).join(" ") + "Z";
}

function wornOutline(points, damage) {
  if (damage < 2) return outline(points);
  const [shoulder, upper, crown, slope, wall, foot, heel, base, left, ramp] = points;
  const chip = [
    [shoulder[0] + 8, shoulder[1] + 6], [shoulder[0] + 10, shoulder[1] - 5],
  ];
  if (damage === 2) return outline([shoulder, ...chip, upper, crown, slope, wall, foot, heel, base, left, ramp]);
  return outline([
    shoulder, ...chip, upper, [upper[0] + 7, upper[1] + 5], [crown[0] - 9, crown[1] - 1], crown, slope, wall,
    [foot[0] - 9, foot[1] - 4], [foot[0] - 12, foot[1] + 8], heel, base,
    [left[0] + 10, left[1] - 7], left, ramp,
  ]);
}

function sparkle(x, y, size, color = "#fff9da") {
  return `<g transform="translate(${x} ${y}) scale(${size / 8})">${path("M0-8 1.6-1.7 7 0 1.6 1.7 0 8-1.6 1.7-7 0-1.6-1.7Z", color)}</g>`;
}

function shard(x, y, tipX, tipY, size, small = false) {
  const middleX = Math.round((x + tipX) / 2);
  const middleY = Math.round((y + tipY) / 2);
  const left = [middleX - size * .57, middleY - 8];
  const right = [middleX + size * .48, middleY - 7];
  const footLeft = [x - size * .57, y - 7];
  const footRight = [x + size * .48, y - 3];
  const tip = [tipX, tipY];
  const mid = [middleX, middleY - 4];
  const root = [x, y];
  const shell = `M${footLeft} ${left} ${tip} ${right} ${footRight} ${root}Z`;
  return path(shell, "#7966cb", 'stroke="#413767" stroke-width="3" stroke-linejoin="round"') +
    path(`M${footLeft} ${left} ${mid} ${root}Z`, small ? "#bd9cf1" : "#a58beb") +
    path(`M${left} ${tip} ${right} ${mid}Z`, small ? "#e5d9ff" : "#d9fbff") +
    path(`M${mid} ${right} ${footRight} ${root}Z`, "#645fc1") +
    path(`M${left} ${tip} ${mid}Z`, "#9de2f7", 'opacity=".8"') +
    trace(`M${tip} ${mid} ${root}`, "#eef7ff", 1.35, 'opacity=".78"');
}

function crystalCluster(variant) {
  const cluster = crystals[variant];
  return [0, 3, 2, 1].map((index) => shard(...cluster[index], index === 0 || index === 3)).join("") +
    sparkle(variant === 2 ? 92 : 120, variant === 1 ? 28 : 22, 7, "#f0e9ff") +
    sparkle(variant === 1 ? 23 : 43, variant === 2 ? 28 : 33, 4, "#c9f7fc");
}

function surface(id, variant, colors) {
  const [, , , ink, , , , spec] = colors;
  if (id === "granite") {
    const flecks = [
      "M34 70 44 61 56 63 53 69 44 74Z M102 51 112 48 121 54 116 59 106 58Z M104 83 116 78 123 81 116 86Z M58 84 65 80 70 84 65 88Z",
      "M41 61 53 51 62 53 59 61 49 65Z M82 47 89 44 95 46 92 52 83 52Z M98 74 111 69 121 74 114 81 102 81Z M49 88 58 83 64 87 59 91Z",
      "M28 77 41 68 50 67 50 73 39 79Z M58 59 68 54 77 56 72 61 63 63Z M97 55 110 50 123 54 118 60 105 60Z M89 84 100 80 112 83 105 88 95 88Z",
    ];
    return path(flecks[variant], "#d5dbcb", 'opacity=".71"') +
      trace(variant === 1 ? "M29 78 41 73 53 74 M112 88 125 84" : "M54 76 63 71 70 74 M118 67 128 72", "#495b58", 2.8, 'opacity=".52"');
  }
  if (id === "crystal") {
    return path("M27 80 47 70 61 63 97 67 120 71 137 82 125 90 105 83 85 92 61 83 43 89Z", "#4d4778", 'opacity=".9"') +
      crystalCluster(variant) + trace("M41 88 55 81 M99 88 112 83 125 87", "#a69be8", 2.2, 'opacity=".7"');
  }
  const [islands, details] = inclusions[id][variant];
  const patina = id === "copper"
    ? trace(islands, "#557f72", 6, 'opacity=".8"')
    : "";
  const border = id === "shiny-surface" || id === "crystal-shell" ? "" : `stroke="${ink}" stroke-width="2" stroke-linejoin="round"`;
  const flashes = id === "shiny-surface"
    ? sparkle(variant === 0 ? 68 : 102, variant === 0 ? 52 : 45, 9) + sparkle(variant === 0 ? 118 : 122, variant === 0 ? 68 : 80, 5)
    : id === "false-glint"
      ? sparkle(variant === 0 ? 84 : 109, variant === 0 ? 48 : 55, 5, "#ffeac3")
      : "";
  const shellFacets = id === "crystal-shell"
    ? path(variant === 0
      ? "M39 43 44 56 63 29Z M63 29 80 56 80 37Z M99 31 96 70 112 64Z M122 40 112 64 134 73Z"
      : "M39 47 51 54 61 30Z M61 30 80 57 77 33Z M96 26 97 66 114 61Z M118 34 130 72 139 48Z",
    "#7de4e0", 'opacity=".37"') : "";
  return patina + path(islands, "url(#ore)", border) + shellFacets +
    trace(details, spec, id === "tin" ? 1.7 : 2.2, 'opacity=".9"') + flashes;
}

function fractures(stage, variant, colors) {
  if (!stage) return "";
  const route = stage === 1
    ? "M83 21 78 43 88 54 80 64 M87 54 98 51 105 54"
    : stage === 2
      ? "M83 21 78 43 88 54 80 65 89 77 78 88 84 96 M88 54 101 49 113 55 126 51 M81 65 68 61 57 71 46 69 37 74"
      : "M83 18 77 42 90 54 80 65 91 77 77 90 85 106 80 115 M89 54 102 47 115 55 129 49 144 49 M81 65 66 60 55 71 43 67 20 78 M90 77 107 76 120 89 145 93 M56 71 57 83 47 92 50 105";
  const widened = stage === 3 ? 7.2 : stage === 2 ? 4.9 : 3.1;
  const transform = ["", "translate(158 1) scale(-1 1)", "translate(-3 -3)"][variant];
  return `<g transform="${transform}">` +
    trace(route, colors[4], widened + 2.2, `transform="translate(0 1.6)" opacity="${stage === 3 ? .97 : .73}"`) +
    trace(route, colors[3], widened) +
    (stage < 3 ? "" : trace("M88 54 80 65 90 77 78 90 M102 48 115 54 128 50 M53 72 43 69 24 77",
      colors[4], 1.75, 'opacity=".85"')) + "</g>";
}

function unstable(id) {
  if (id === "coal") {
    return path("M112 54 122 50 129 57 125 62 115 63Z M98 68 107 65 113 71 108 76 100 76Z",
      "#252435", 'stroke="#a18d9c" stroke-width="1.5"') +
      trace("M119 48Q121 44 117 41 M105 64Q109 59 104 56", "#e9c8ce", 2.8, 'opacity=".58"');
  }
  const seam = id === "iron" ? "M30 57 46 48 59 51 67 45 84 47" : "M91 75 105 70 115 77 127 73 139 81";
  return trace(seam, "#523446", 5.5) + trace(seam, "#d38383", 2.3, 'opacity=".9"');
}

function fragment(x, y, size, angle, colors, mineral = false) {
  const [light, body, shade, ink, exposed] = colors;
  return `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${size})">` +
    path("M-14 3-10-6 2-10 13-4 15 4 9 8-8 8Z", body, `stroke="${ink}" stroke-width="2" stroke-linejoin="round"`) +
    path("M-12 2-9-5 2-8 11-3 6 0Z", light) +
    path("M-12 3 6 0 13 4 8 7-8 7Z", shade) +
    (mineral ? trace("M-6 0 1-3 7-2", exposed, 2.8) : "") + "</g>";
}

function bodyFrame(id, variant, damage, hazard) {
  const colors = palettes[id];
  const [light, body, shade, ink] = colors;
  const points = shapes[id][variant];
  const boulder = wornOutline(points, damage);
  const [shoulder, top, crown, slope, wall, foot, heel, base, left, ramp] = points;
  const chin = variant === 1 ? "77 90" : variant === 2 ? "65 91" : "83 90";
  const topFace = `M${ramp} ${shoulder} ${top} ${crown} ${slope} L109 56 75 54 53 64 37 68Z`;
  const rightFace = `M${slope} L109 56 116 72 ${chin} ${heel} ${foot} ${wall}Z`;
  const lowFace = `M${left} L37 85 59 93 ${chin} 112 88 ${foot} ${heel} ${base}Z`;
  const shadow = ellipse(81, 104, 68, 12, "#1a2432", 'opacity=".13"') +
    ellipse(81, 105, 57, 7, "#1d2330", 'opacity=".26"');
  const rock = path(boulder, "url(#body)", `stroke="${light}" stroke-opacity=".46" stroke-width="6" stroke-linejoin="round"`) +
    `<g clip-path="url(#rock)">` +
    path(topFace, light, 'opacity=".64"') + path(rightFace, shade, 'opacity=".55"') + path(lowFace, shade, 'opacity=".9"') +
    path("M26 77 43 69 48 75 40 85 29 88Z M119 64 134 65 141 76 129 78Z", ink, 'opacity=".14"') +
    trace(variant === 1 ? "M24 69 39 49 59 40 79 36 M38 87 55 94 69 95" : "M27 67 41 49 66 37 84 34 M95 93 114 90 126 85",
      light, 2.7, 'opacity=".58"') + "</g>" +
    trace(boulder, ink, 2.8);
  const features = id === "crystal" ? surface(id, variant, colors) : `<g clip-path="url(#rock)">${surface(id, variant, colors)}</g>`;
  const change = damage >= 2
    ? fragment(22, 108, damage === 3 ? .48 : .34, -17, colors) + (damage === 3 ? fragment(141, 104, .5, 20, colors, true) : "")
    : "";
  const hazardFeature = hazard ? `<g clip-path="url(#rock)">${unstable(id)}</g>` : "";
  return art(shadow + rock + features + hazardFeature + `<g clip-path="url(#rock)">${fractures(damage, variant, colors)}</g>` + change,
    gradient("body", light, body) + (colors[5] ? gradient("ore", colors[5], colors[6], 30, 46, 95) : "") +
    `<clipPath id="rock">${path(boulder, "#000")}</clipPath>`);
}

function rubbleFrame(id, variant) {
  const colors = palettes[id];
  const offset = [0, 7, -5][variant];
  const mineral = ["copper", "tin", "iron", "crystal", "coal"].includes(id);
  return art(ellipse(81, 103, 65, 12, "#24303c", 'opacity=".19"') +
    ellipse(81, 105, 50, 6, "#252633", 'opacity=".19"') +
    fragment(41 + offset, 94, 1.02, -13, colors, mineral) +
    fragment(119 - offset, 96, 1.17, 13, colors, mineral) +
    fragment(66 + offset, 106, .73, 8, colors) +
    fragment(27, 108, .43, 21, colors) + fragment(139, 109, .33, -22, colors) +
    fragment(98, 109, .39, -16, colors, mineral));
}

function emptySlot() {
  const colors = palettes.granite;
  return art(ellipse(80, 88, 56, 19, "#2e3340", 'opacity=".085"') +
    ellipse(80, 88, 43, 13, "#a5aaa0", 'opacity=".11"') +
    trace("M26 91Q31 101 55 104 M105 104Q123 102 133 94", "#818777", 1.4, 'opacity=".3"') +
    fragment(44, 98, .26, -10, colors) + fragment(121, 94, .2, 21, colors));
}

function stairs() {
  const colors = palettes.granite;
  const mouth = "M24 77 36 55 60 44 105 44 129 55 141 77 133 94 109 107 49 107 29 96Z";
  const inner = "M39 72 54 55 107 55 125 69 127 79 110 91 50 91 34 81Z";
  const steps = [
    ["M47 80 57 73 105 73 117 81 111 92 52 92Z", "#52616a", "M53 82 111 82"],
    ["M50 72 61 65 101 65 113 72 106 81 56 81Z", "#65737a", "M55 73 107 73"],
    ["M55 64 64 58 97 58 106 64 101 72 61 72Z", "#7a888a", "M60 64 101 64"],
    ["M60 57 69 51 93 51 101 57 96 64 65 64Z", "#8f9d9b", "M66 57 94 57"],
  ];
  return art(ellipse(81, 98, 68, 16, "#272931", 'opacity=".23"') +
    path(mouth, "url(#rim)", 'stroke="#41474f" stroke-width="3" stroke-linejoin="round"') +
    path("M29 82 48 94 111 94 136 81 133 94 109 106 49 106 29 96Z", "#626f71") +
    path(inner, "url(#opening)", 'stroke="#445052" stroke-width="3" stroke-linejoin="round"') +
    `<g clip-path="url(#mouth)">` + steps.map(([d, color, edge]) => path(d, color) + trace(edge, "#c7c9b2", 1.4, 'opacity=".88"')).join("") + "</g>" +
    trace("M39 62 58 51 100 50 M47 96 71 101 108 99 126 91", "#d0c9a8", 2.1, 'opacity=".83"') +
    fragment(28, 94, .42, -18, colors) + fragment(130, 99, .43, 15, colors) +
    fragment(88, 108, .3, -15, colors),
  gradient("rim", "#c2c1a3", "#7f9389", 30, 45, 105) +
    gradient("opening", "#364a53", "#202831", 55, 50, 92) + `<clipPath id="mouth">${path(inner, "#000")}</clipPath>`);
}

function explosion() {
  const soot = ["#8b7781", "#625765", "#473e51", "#362c3b", "#ee9578"];
  return art(ellipse(80, 91, 65, 22, "#3b2c3c", 'opacity=".21"') +
    path("M19 82 32 76 28 68 48 69 57 58 72 64 88 55 96 65 117 63 122 73 141 78 132 86 142 96 121 99 115 108 98 104 82 113 66 106 49 110 42 101 21 99 28 89Z", "#40323e", 'opacity=".47"') +
    ellipse(80, 85, 41, 16, "url(#pit)") +
    trace("M43 88 56 96 77 99 98 97 116 88", "#b28379", 2.7, 'opacity=".76"') +
    fragment(40, 95, .64, -22, soot) + fragment(126, 85, .72, 17, soot) + fragment(100, 108, .47, -13, soot) +
    trace("M58 83 66 86 63 91 M108 78 102 81 108 85 M82 95 89 92", "#f89d75", 2.6) +
    sparkle(54, 64, 4, "#ffbf8d") + sparkle(110, 63, 3, "#f99e7b") +
    ellipse(74, 73, 1.8, 1.6, "#f8ae80") + ellipse(95, 87, 1.6, 1.5, "#ffcd9e"),
  gradient("pit", "#634757", "#342a3b", 55, 67, 100));
}

function pickup(id) {
  const family = id === "stone" ? "granite" : id === "gem" ? "crystal" : id;
  const colors = palettes[family];
  if (id === "gem") {
    return art(ellipse(80, 101, 32, 7, "#232634", 'opacity=".18"') +
      shard(81, 98, 77, 30, 50) + shard(106, 96, 111, 54, 27, true) + sparkle(112, 43, 8));
  }
  return art(ellipse(80, 99, 42, 8, "#232634", 'opacity=".18"') +
    fragment(70, 75, 2.35, -12, colors, id !== "stone") + fragment(108, 87, 1.26, 13, colors, id !== "stone"));
}

async function renderAtlas(name, frames, columns) {
  const images = await Promise.all(frames.map(async (svg, i) => ({
    input: await sharp(Buffer.from(svg)).png().toBuffer(),
    left: i % columns * tileWidth,
    top: Math.floor(i / columns) * tileHeight,
  })));
  await sharp({
    create: {
      width: columns * tileWidth, height: Math.ceil(frames.length / columns) * tileHeight,
      channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(images).webp({ quality: 89, alphaQuality: 100 }).toFile(join(output, `${name}.webp`));
}

async function build() {
  await mkdir(output, { recursive: true });
  const frames = (id, variant, hazard = false) => [
    ...[0, 1, 2, 3].map((damage) => bodyFrame(id, variant, damage, hazard)),
    rubbleFrame(id, variant),
  ];
  for (const [id, family] of Object.entries(atlas.families)) {
    await renderAtlas(id, family.variants.flatMap((_, variant) => frames(id, variant)), atlas.frames.length);
  }
  await renderAtlas("hazards", Object.keys(atlas.hazards).flatMap((id) => frames(id, 0, true)), atlas.frames.length);
  await renderAtlas("terrain", [emptySlot(), stairs(), explosion()], atlas.terrain.length);
  await renderAtlas("resources", atlas.resources.map(pickup), atlas.resources.length);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
