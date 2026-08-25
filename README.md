# ElderTale

> **Log Horizon** | *We built an entire 3D web-native game engine because we couldn't stop thinking about getting trapped in a hyper-optimized MMORPG.*

---

## ⚡ WHAT THE HELL IS THIS?

**ElderTale** is a lightweight, ultra-fast 3D web experience running direct in your browser—zero installs, zero downloads, and absolute zero patience for 80GB game launchers. 

Inspired directly by the legendary anime **Log Horizon**, this project recreates the spirit of the fictional turn-of-the-century MMORPG that started it all. We took modern open-web tech—**Three.js**, **TypeScript**, and **@pixiv/three-vrm**—and slapped together a custom architecture capable of handling humanoid VRM avatars, procedural rolling topographies, dynamic surface height sampling, and custom Mixamo animation retargeting. 

You load the URL, spawn into the world, and immediately start sprinting, jumping, and crouching across low-poly terrain without blowing up your GPU.

---

## 🌀 THE VISION (GETTING TRAPPED IN THE GAME, BUT MAKE IT IN VITE)

In *Log Horizon*, half a million gamers get pulled into the world of ElderTale during its twelfth expansion pack. We aren't locking you into a virtual reality nightmare (yet), but we *are* proving that the modern web browser is criminally underrated as a first-class gaming environment.

Why rely on monolithic desktop game engines when raw browser primitives, WebGL, and custom math functions can render an interactive world at native 60+ FPS? The vision is simple: zero-friction access, instant loading, complete avatar freedom, and an engine light enough to run on a potato while looking surprisingly clean.

---

## 🧠 THE MISSION (ACCURATE TECH BS THAT ACTUALLY WORKS)

* **Zero-Engine Bloat:** No massive engine binaries, no multi-gigabyte asset bundles, and no 10-minute compilation screens. Just pure, handcrafted TypeScript orchestrating Three.js scenes and WebGL render loops.
* **Open Avatar Interoperability:** Full native support for the **VRM 0.x** standard. You bring your own 3D anime avatar, and the engine handles bone transforms, T-pose normalization, shadow casting, and lighting seamlessly.
* **Mixamo Animation Pipeline:** An automated retargeting system that strips horizontal root-motion drift, maps Mixamo FBX skeletal animations onto VRM humanoids on the fly, and eliminates bone-snapping garbage.
* **Contextual State Machine:** Smooth, mathematically blended transitions between Idle, Walk, Run, Crouch, Crouch-Walk, and three distinct jump variations (Standing Jump, Walking Jump, and Running Jump).
* **Sine-Wave Procedural Topography:** Rolling hill terrain generated on the fly via mathematical trigonometric height functions (`sin(x) * cos(z)`), allowing real-time vertical height-sampling so the player naturally traverses slopes and valleys.
* **Circle-Radius Bounding Collisions:** Dynamic collision detection system that tracks scattered 3D props (rocks, trees) and water features (lakes), blocking player movement before mesh clipping occurs.
* **Third-Person Orbit Controls:** Mouse pointer-lock integration tied to a dynamic spring camera that automatically adjusts target height depending on whether the player is standing or crouching.

---

## 🔥 CORE PILLARS

* **Instant Load Times:** Click the link, boom—you are in the world. No splash screens, no asset verification queues.
* **Zero Root-Drift:** Animation states stay locked to user input vectors instead of letting raw animation files drag the avatar into unintended coordinate space.
* **Extensible Architecture:** Built from the ground up to serve as a high-performance foundation for future web-native RPG systems, spell indicators, spatial audio, and multiplayer networking layers.