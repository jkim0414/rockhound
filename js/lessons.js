// Field Guide: one chapter unlocks each time a new expedition (stage) opens.
import { CRYSTAL_SYSTEMS } from "./data.js";
import { crystalSVG } from "./shapes.js";

const tryIt = html => `<div class="tryit"><b>🔬 Try it!</b> ${html}</div>`;
const word = (w, say) => `<b class="vocab">${w}</b>${say ? ` <span class="say">(${say})</span>` : ""}`;

const rockCycle = `
<svg class="diagram" viewBox="-34 0 408 300" role="img" aria-label="The rock cycle">
  <defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="dl-fill"/></marker></defs>
  <g class="node n-ig"><rect x="110" y="8" width="120" height="44" rx="10"/><text x="170" y="35" text-anchor="middle">IGNEOUS</text></g>
  <g class="node n-sed"><rect x="216" y="204" width="120" height="44" rx="10"/><text x="276" y="231" text-anchor="middle">SEDIMENTARY</text></g>
  <g class="node n-met"><rect x="4" y="204" width="120" height="44" rx="10"/><text x="64" y="231" text-anchor="middle">METAMORPHIC</text></g>
  <g class="node n-mag"><ellipse cx="170" cy="140" rx="46" ry="24"/><text x="170" y="145" text-anchor="middle">MAGMA</text></g>
  <path class="dl" marker-end="url(#ah)" d="M232 44 Q300 100 286 198"/>
  <text class="dt" x="296" y="104">weathering,</text><text class="dt" x="296" y="118">then layers</text>
  <path class="dl" marker-end="url(#ah)" d="M214 232 L130 232"/>
  <text class="dt" x="172" y="226" text-anchor="middle">heat + squeezing</text>
  <path class="dl" marker-end="url(#ah)" d="M70 200 Q80 160 124 146"/>
  <text class="dt" x="104" y="182">melting</text>
  <path class="dl" marker-end="url(#ah)" d="M170 114 L170 56"/>
  <text class="dt" x="200" y="88" text-anchor="middle">cooling</text>
  <path class="dl thin" marker-end="url(#ah)" d="M108 40 Q30 90 50 198"/>
  <text class="dt" x="42" y="96" text-anchor="end">heat +</text><text class="dt" x="40" y="110" text-anchor="end">squeezing</text>
  <path class="dl thin" marker-end="url(#ah)" d="M110 250 Q170 296 232 252"/>
  <text class="dt" x="170" y="290" text-anchor="middle">weathering, then layers</text>
</svg>`;

export const LESSONS = [
  { id: "start", stage: 1, icon: "⛏️", title: "How to Be a Rockhound",
    body: `
<p>Welcome, rockhound! A <b>rockhound</b> is someone who hunts for rocks, minerals, and gems — and learns to read the stories inside them.</p>
<p>Here is how your expedition works:</p>
<ol>
  <li><b>Pick a mystery rock.</b> There is a specimen hidden inside every one.</li>
  <li><b>Crack it with three hammer strikes.</b> Each strike is a math problem. Solve it and the rock cracks a little more.</li>
  <li><b>Add your find to the collection</b> and read its field card.</li>
</ol>
<p>The math gets harder as you travel to new places, and the specimens get rarer.</p>
<h3>What if I get one wrong?</h3>
<p>Then the rock just needs another tap! Real geologists test, check, and test again — it is how science works. You can try as many times as you like, ask for a hint, or see how to solve it. A miss never costs you anything.</p>
<h3>Ranks</h3>
<p>Finish every specimen in an expedition and you earn a new rank, from <b>Pebble Pup</b> all the way to <b>Master Geologist</b>. Every new rank also unlocks a new chapter of this Field Guide.</p>` },

  { id: "sorting", stage: 1, icon: "🗂️", title: "Mineral, Rock, Crystal, or Gem?",
    body: `
<p>People mix these four words up all the time. A geologist never does.</p>
<p>A ${word("mineral")} is one pure substance. To count as a mineral, something must pass <b>five tests</b>:</p>
<ol>
  <li>It is made by <b>nature</b>, not in a factory.</li>
  <li>It is <b>solid</b>.</li>
  <li>It was <b>never alive</b> (and was not made by a living thing).</li>
  <li>It has its <b>own recipe</b> — a chemical formula.</li>
  <li>Its atoms are stacked in a <b>repeating pattern</b>.</li>
</ol>
<p>A ${word("crystal")} is the shape a mineral grows into because of that repeating pattern. A cube of salt is cube-shaped because its atoms are stacked in cubes. So <i>crystal</i> is not a different thing from <i>mineral</i> — it is the mineral's shape.</p>
<p>A ${word("rock")} is a mixture of mineral grains stuck together. Granite is a rock. Look closely and you can see its three main minerals: quartz, feldspar, and mica. Minerals are the ingredients; a rock is the cookie.</p>
<p>A ${word("gem")} is any mineral (and a few other things) that is beautiful, tough, and rare enough to be worn as jewelry. Ruby is a gem — and it is also the mineral corundum.</p>
<h3>The sorting tree</h3>
<p>Your whole collection is sorted by asking one question at a time. Every specimen fits in exactly one box.</p>
<div class="tree">
  <div class="tq">Is it ONE substance, or a MIXTURE?</div>
  <div class="tcols">
    <div><div class="tb">One substance</div><div class="tq small">Crystal pattern inside, and never alive?</div>
      <div class="tcols"><div><div class="tb">Yes</div><div class="tl k-minerals">MINERAL</div></div><div><div class="tb">No</div><div class="tl k-mineraloids">MINERALOID</div></div></div></div>
    <div><div class="tb">Mixture</div><div class="tq small">Did it form on Earth?</div>
      <div class="tcols"><div><div class="tb">Yes</div><div class="tl k-rocks">ROCK</div></div><div><div class="tb">No</div><div class="tl k-space">SPACE ROCK</div></div></div></div>
  </div>
</div>
<p>After that, minerals are sorted by <b>what they are made of</b>, and rocks are sorted by <b>how they formed</b>.</p>` },

  { id: "clues", stage: 2, icon: "🔍", title: "The Mineral Detective's Clues",
    body: `
<p>Color is the worst clue for naming a mineral. Quartz can be clear, purple, pink, yellow, or black! Geologists use better clues. Every mineral field card in your collection lists them.</p>
<h3>1. Hardness</h3>
<p>In 1812, Friedrich Mohs picked ten minerals and put them in order. A harder mineral can scratch a softer one, but never the other way around. This is the ${word("Mohs scale", "MOZE")}:</p>
<table class="mohs">
  <tr><td>1</td><td>Talc</td><td rowspan="2" class="tool">A fingernail (2.5) scratches these</td></tr>
  <tr><td>2</td><td>Gypsum</td></tr>
  <tr><td>3</td><td>Calcite</td><td class="tool">A copper coin (3.5) scratches it</td></tr>
  <tr><td>4</td><td>Fluorite</td><td rowspan="2" class="tool">A steel nail (5.5) scratches these</td></tr>
  <tr><td>5</td><td>Apatite</td></tr>
  <tr><td>6</td><td>Orthoclase</td><td rowspan="5" class="tool">These scratch glass</td></tr>
  <tr><td>7</td><td>Quartz</td></tr>
  <tr><td>8</td><td>Topaz</td></tr>
  <tr><td>9</td><td>Corundum</td></tr>
  <tr><td>10</td><td>Diamond</td></tr>
</table>
<h3>2. Luster</h3>
<p>${word("Luster")} is how a mineral shines. <b>Metallic</b> minerals shine like metal. Others can be <b>glassy</b>, <b>pearly</b>, <b>silky</b>, <b>waxy</b>, <b>greasy</b>, <b>dull</b>, or <b>adamantine</b> — the brilliant sparkle of a diamond.</p>
<h3>3. Streak</h3>
<p>Rub a mineral on a rough white tile and it leaves a line of powder. That is its ${word("streak")}. The streak can be a different color from the mineral! Brassy-yellow pyrite leaves a greenish-black streak. Real gold leaves a golden one.</p>
<h3>4. Crystal shape</h3>
<p>Every mineral's atoms stack in one of seven patterns, called crystal systems. You will learn all seven in a later chapter.</p>
<h3>5. How it breaks</h3>
<p>Some minerals split along flat, smooth surfaces. That is called ${word("cleavage")}. Mica peels into sheets. Halite breaks into cubes. Others, like quartz, break with curved surfaces like chipped glass. That is called ${word("fracture")}.</p>
<h3>6. Heft</h3>
<p>${word("Specific gravity")} tells you how heavy a mineral is compared with the same amount of water. Quartz is 2.65, so it is 2.65 times as heavy as water. Gold is 19.3!</p>
${tryIt("Find a rock outside. Can your fingernail scratch it? Can a coin? Can it scratch an old glass jar? (Ask a grown-up first.) You just measured its hardness.")}` },

  { id: "cycle", stage: 3, icon: "♻️", title: "The Rock Cycle",
    body: `
<p>Rocks seem to last forever, but they are always slowly changing. Any kind of rock can turn into any other kind. Geologists call this the ${word("rock cycle")}.</p>
${rockCycle}
<p>There are exactly three ways to make a rock, so there are three families of rocks:</p>
<ul>
  <li><b>Igneous rocks</b> form when melted rock cools and hardens. Melted rock underground is called ${word("magma")}. When it reaches the surface it is called ${word("lava")}.</li>
  <li><b>Sedimentary rocks</b> form when wind, water, and ice break rocks into bits called ${word("sediment")}. The bits pile up in layers and get pressed and glued into new rock.</li>
  <li><b>Metamorphic rocks</b> form when a rock is squeezed and heated deep underground until it changes — but does not melt. ${word("Metamorphic", "met-uh-MOR-fik")} means “changed form.”</li>
</ul>
<p>The cycle has no beginning and no end. A grain of sand on a beach today might have been part of a mountain, then a sandstone, then a quartzite, then a mountain again.</p>
<p>What powers the cycle? Two engines: the <b>heat inside the Earth</b>, which melts and squeezes rock, and the <b>Sun</b>, which drives the wind and rain that wear rock away.</p>
${tryIt("Next time you see a rock, ask the first question a geologist asks: was it <b>melted</b>, <b>layered</b>, or <b>squeezed</b>?")}` },

  { id: "igneous", stage: 4, icon: "🌋", title: "Igneous Rocks: Born from Fire",
    body: `
<p>${word("Igneous", "IG-nee-us")} comes from the Latin word for fire. Every igneous rock was once so hot that it was liquid.</p>
<p>To name an igneous rock, a geologist asks two questions.</p>
<h3>Question 1: Where did it cool?</h3>
<p>Crystals need <b>time</b> to grow. Magma trapped deep underground cools very slowly, sometimes for a million years, so its crystals grow big enough to see. These rocks are called ${word("intrusive")}.</p>
<p>Lava at the surface cools in days or even seconds. The crystals stay tiny. These rocks are called ${word("extrusive")}. If lava cools instantly, no crystals form at all and you get glass: obsidian.</p>
<h3>Question 2: What is it made of?</h3>
<p>Magma with lots of silica makes light-colored rock. Magma with lots of iron and magnesium makes dark, heavy rock.</p>
<p>Put the two questions together and you get a neat table. Each column is the <b>same recipe</b>, cooled two different ways:</p>
<table class="grid">
  <tr><th></th><th>Light<br><small>lots of silica</small></th><th>Medium</th><th>Dark<br><small>lots of iron</small></th></tr>
  <tr><th>Cooled slowly<br><small>big crystals</small></th><td>Granite</td><td>Diorite</td><td>Gabbro</td></tr>
  <tr><th>Cooled quickly<br><small>tiny crystals</small></th><td>Rhyolite</td><td>Andesite</td><td>Basalt</td></tr>
</table>
<p>So granite and rhyolite are twins. So are gabbro and basalt. Same ingredients, different cooling speed!</p>
<p>What about the bubbly ones? Pumice and scoria are lava that was full of gas, like a shaken soda, when it froze.</p>
${tryIt("Look at a kitchen countertop made of granite. Can you find three different minerals? Glassy gray is quartz, pink or white is feldspar, and black is mica or hornblende.")}` },

  { id: "sedimentary", stage: 5, icon: "🏖️", title: "Sedimentary Rocks: Layers of Time",
    body: `
<p>Sedimentary rocks are made of pieces. They form in layers, with the oldest layer on the bottom. Reading the layers is like reading the pages of a history book — and they are the only rocks that hold <b>fossils</b>.</p>
<p>Sedimentary rocks are sorted by where their pieces came from.</p>
<h3>1. Clastic: broken bits of older rock</h3>
<p>${word("Clastic")} rocks are named by the <b>size</b> of the bits:</p>
<table class="grid">
  <tr><th>Size of the bits</th><th>Rock</th></tr>
  <tr><td>Pebbles (rounded)</td><td>Conglomerate</td></tr>
  <tr><td>Pebbles (sharp)</td><td>Breccia</td></tr>
  <tr><td>Sand</td><td>Sandstone</td></tr>
  <tr><td>Mud and clay</td><td>Shale</td></tr>
</table>
<p>Size is a clue to the past. It takes fast, strong water to carry pebbles, so conglomerate means a rushing river. Mud only settles in still water, so shale means a quiet lake or deep sea.</p>
<h3>2. Chemical: minerals left behind by water</h3>
<p>Water carries dissolved minerals. When the water dries up or cools down, the minerals come out and form rock. Travertine grows around hot springs this way.</p>
<h3>3. Biochemical: made by living things</h3>
<p>Limestone, chalk, and coquina are made from shells and skeletons. Coal is made from ancient plants.</p>
<p>How do loose bits become hard rock? Two steps. First, ${word("compaction")}: the weight of new layers squeezes the bits together. Then, ${word("cementation")}: minerals in the water glue them tight.</p>
${tryIt("Fill a jar with water, sand, soil, and tiny pebbles. Shake it and let it sit. Which settles first? You just made sedimentary layers.")}` },

  { id: "metamorphic", stage: 6, icon: "🥨", title: "Metamorphic Rocks: Squeezed and Baked",
    body: `
<p>Take any rock, bury it deep under a mountain range, and squeeze and heat it for millions of years. It will not melt — but its minerals will change and regrow. It becomes a metamorphic rock.</p>
<p>Every metamorphic rock has a ${word("parent rock")}: the rock it used to be.</p>
<table class="grid">
  <tr><th>Parent rock</th><th>becomes…</th></tr>
  <tr><td>Shale</td><td>Slate → Phyllite → Schist → Gneiss</td></tr>
  <tr><td>Limestone</td><td>Marble</td></tr>
  <tr><td>Sandstone</td><td>Quartzite</td></tr>
  <tr><td>Peridotite</td><td>Serpentinite</td></tr>
  <tr><td>Basalt (very deep)</td><td>Eclogite</td></tr>
</table>
<p>Metamorphic rocks are sorted by one question: <b>did the squeezing make layers?</b></p>
<h3>Foliated: yes, layers</h3>
<p>When flat minerals like mica are squeezed, they all turn sideways and line up, like a deck of cards. This is called ${word("foliation")}. The more heat and squeezing, the bigger the crystals grow. That is why shale turns into slate, then phyllite, then schist, then gneiss. Geologists call how far it went the ${word("grade")}.</p>
<h3>Non-foliated: no layers</h3>
<p>Some rocks are made of minerals that are not flat, like calcite or quartz. When they are baked, the crystals just grow bigger and lock together. Marble and quartzite have no layers.</p>
<p>Metamorphic rocks are messages from deep underground. A garnet in schist tells a geologist exactly how hot and how deep that rock once was.</p>
${tryIt("Stack some playing cards or coins loosely in a pile of clay and press down. Watch them all turn flat. That is foliation!")}` },

  { id: "crystals", stage: 7, icon: "🔷", title: "The Seven Crystal Shapes",
    body: `
<p>Why is salt always a cube? Because inside a salt crystal, the atoms are stacked in a cube pattern, repeated billions of times. The outside shape is a giant copy of the tiny pattern inside.</p>
<p>There are only <b>seven</b> basic ways for atoms to stack. They are called the seven ${word("crystal systems")}. Every mineral in the world belongs to exactly one.</p>
<div class="systems">${CRYSTAL_SYSTEMS.map(c => `<div class="sys">${crystalSVG(c.id, 64)}<div><b>${c.name}</b><br>${c.note}</div></div>`).join("")}</div>
<p>The systems go from most <b>symmetrical</b> (cubic — the same in every direction) to least symmetrical (triclinic — different in every direction).</p>
<p>Real crystals do not always look like these simple boxes. A cubic mineral can grow as a cube (pyrite), an eight-sided ${word("octahedron")} (diamond), or a twelve-sided ${word("dodecahedron")} (garnet). But measure the angles between the faces and the hidden pattern always shows.</p>
<p>What about things with no pattern at all? Opal and obsidian have jumbled atoms. They are called ${word("amorphous", "uh-MOR-fus")}, which means “without form.” That is why opal is a mineraloid, not a mineral.</p>
${tryIt("Use the <b>Crystal shape</b> lens in your collection to see which of your minerals share a system. Do the cubic ones have anything in common?")}` },

  { id: "families", stage: 8, icon: "🧪", title: "Mineral Families: Sorting by Chemistry",
    body: `
<p>There are more than 6,000 known minerals. Mineralogists sort them the way a chemist would: by what they are made of.</p>
<p>Most minerals have two parts: a <b>metal</b> part and a <b>partner</b>. Minerals are sorted by the partner, because minerals with the same partner behave alike.</p>
<table class="grid">
  <tr><th>Family</th><th>The partner</th><th>Example</th></tr>
  <tr><td>Native elements</td><td>none — one element alone</td><td>Gold, Au</td></tr>
  <tr><td>Sulfides</td><td>sulfur, S</td><td>Pyrite, FeS₂</td></tr>
  <tr><td>Oxides</td><td>oxygen, O</td><td>Hematite, Fe₂O₃</td></tr>
  <tr><td>Halides</td><td>chlorine or fluorine</td><td>Halite, NaCl</td></tr>
  <tr><td>Carbonates</td><td>CO₃</td><td>Calcite, CaCO₃</td></tr>
  <tr><td>Borates</td><td>boron + oxygen</td><td>Borax</td></tr>
  <tr><td>Sulfates</td><td>SO₄</td><td>Gypsum</td></tr>
  <tr><td>Phosphates</td><td>PO₄</td><td>Apatite</td></tr>
  <tr><td>Silicates</td><td>silicon + oxygen</td><td>Quartz, SiO₂</td></tr>
</table>
<h3>Reading a formula</h3>
<p>A formula is a recipe. <b>FeS₂</b> means one atom of iron (Fe) for every two atoms of sulfur (S). <b>CaCO₃</b> means one calcium, one carbon, and three oxygens.</p>
<h3>Silicates: the biggest family</h3>
<p>Oxygen and silicon are the two most common elements in Earth's crust, so silicates make up about nine-tenths of it. Their building block is a tiny pyramid: one silicon atom with four oxygen atoms around it. It is called the ${word("silica tetrahedron", "teh-truh-HEE-drun")}.</p>
<p>The pyramids can link together in different ways, and the way they link decides how the mineral behaves:</p>
<ul>
  <li><b>Islands</b> (alone) → hard, chunky crystals like garnet</li>
  <li><b>Pairs</b> → epidote</li>
  <li><b>Rings</b> → six-sided columns like beryl</li>
  <li><b>Chains</b> → long crystals like hornblende</li>
  <li><b>Sheets</b> → minerals that peel, like mica</li>
  <li><b>Frameworks</b> (linked every way) → tough, blocky quartz and feldspar</li>
</ul>
<p>That is the secret of mica: it peels into sheets because its atoms are built in sheets!</p>` },

  { id: "gems", stage: 9, icon: "💍", title: "What Makes a Gem?",
    body: `
<p>Out of thousands of minerals, only about a hundred are used as gems. To be a gem, a stone needs three things:</p>
<ol>
  <li><b>Beauty</b> — color, sparkle, or a special effect like the flash of opal.</li>
  <li><b>Durability</b> — hard enough not to scratch. Dust is mostly quartz (hardness 7), so the best gems are harder than 7.</li>
  <li><b>Rarity</b> — hard to find.</li>
</ol>
<h3>Species and varieties</h3>
<p>Here is a surprise: many famous gems are the <b>same mineral</b> wearing different colors. The mineral is called the ${word("species")}. Each color is called a ${word("variety")}.</p>
<table class="grid">
  <tr><th>Species</th><th>Varieties</th></tr>
  <tr><td>Corundum</td><td>Ruby (red), Sapphire (every other color)</td></tr>
  <tr><td>Beryl</td><td>Emerald (green), Aquamarine (blue)</td></tr>
  <tr><td>Quartz</td><td>Amethyst, Citrine, Rose Quartz, Smoky Quartz, Agate, Jasper, Carnelian, Tiger's Eye</td></tr>
  <tr><td>Olivine</td><td>Peridot</td></tr>
</table>
<p>The color usually comes from a tiny trace of another element. Just one chromium atom for every hundred aluminum atoms turns gray corundum into red ruby.</p>
<h3>Weighing gems</h3>
<p>Gems are weighed in ${word("carats")}. Five carats make one gram. The word comes from carob seeds, which ancient traders used as tiny weights.</p>
<h3>The big four</h3>
<p>Diamond, ruby, sapphire, and emerald are called the <b>precious stones</b>. Every other gem is called semi-precious — though some, like benitoite, are far rarer than diamond.</p>
<h3>Gems that are not minerals</h3>
<p>Pearl, amber, and jet were made by living things. Opal has no crystal pattern. Lapis lazuli is a rock. They are all gems — but none of them is a mineral!</p>` },

  { id: "space", stage: 10, icon: "☄️", title: "Rocks from Space",
    body: `
<p>About 48 tons of space rock fall toward Earth every day. Most of it is dust that burns up high in the air. A few pieces make it all the way to the ground.</p>
<h3>Three words to keep straight</h3>
<ul>
  <li>A ${word("meteoroid")} is a rock floating in space.</li>
  <li>A ${word("meteor")} is the streak of light it makes when it burns through the air — a shooting star.</li>
  <li>A ${word("meteorite")} is a piece that lands on the ground.</li>
</ul>
<h3>Where do they come from?</h3>
<p>Most meteorites are chips of ${word("asteroids")}, the rocky leftovers from when the planets formed 4.56 billion years ago. Some large asteroids got hot enough to melt. Their heavy metal sank to the middle and made a core, just like inside the Earth. Later, collisions smashed them to pieces.</p>
<p>That is why meteorites are sorted into three kinds:</p>
<table class="grid">
  <tr><th>Kind</th><th>Made of</th><th>Comes from</th></tr>
  <tr><td>Stony</td><td>rock</td><td>asteroids that never melted, or the outside of ones that did</td></tr>
  <tr><td>Stony-iron</td><td>half rock, half metal</td><td>the boundary between core and mantle</td></tr>
  <tr><td>Iron</td><td>iron and nickel metal</td><td>the core of a shattered asteroid</td></tr>
</table>
<p>A very few meteorites were blasted off the Moon or Mars by giant impacts and drifted to Earth.</p>
<h3>Why scientists love them</h3>
<p>Earth's own first rocks were melted and recycled long ago. Meteorites are the only pieces left from the very beginning of the solar system. Holding a chondrite is holding something older than the Earth.</p>
<h3>Is it a meteorite?</h3>
<p>Real meteorites are usually heavy for their size, attract a magnet, and have a thin black crust from burning through the air. They do <b>not</b> have bubbles in them.</p>` },
];

export const LESSON_BY_ID = Object.fromEntries(LESSONS.map(l => [l.id, l]));
