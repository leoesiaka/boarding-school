# Nigeria Boarding School Simulation — Unity Heights

**Enhanced playable build · 3D browser school-life game**

Unity Heights is an original, fictional Nigerian secondary boarding school you can explore in third person. Roam the campus, enter buildings, talk with students and staff, follow a school-day routine, play Nigerian playground games against schoolmate characters, earn pocket money, and save your term locally.

## Run the game

1. Extract the ZIP to a folder.
2. On Windows, double-click `start-game.bat`; it starts a local server and opens the game in your browser. On macOS/Linux, run `./start-game.sh` in a terminal and visit `http://localhost:8000`.
3. The game loads Three.js and web fonts from CDNs, so the first run requires internet access.
4. Pick your student name, complexion and hairstyle, then choose **Start Your Term**.

For the most reliable local launch, open a terminal inside the extracted folder and run:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`. You can also open the folder in VS Code and use Live Server.

## Controls

### Desktop

- **WASD / arrow keys:** walk
- **Mouse drag on the 3D world:** look around
- **Shift:** run
- **E / Enter:** interact with a nearby person, door, desk or bunk
- **T:** school timetable
- **J:** journal
- **M:** campus directory and map
- **G:** schoolyard games
- **Esc:** close a panel or pause
- **1–5:** choose conversation options
- **3D CAMPUS:** switch to a labelled overhead 3D campus view; use the mouse wheel to zoom

### Touchscreen

Use the virtual joystick on the left to move. The on-screen buttons provide run, interact, campus directory, timetable/day and games controls. The compass-style button at the top switches between the student camera and overhead campus view.

## What is in this build

### Campus and interiors

- Expanded 3D grounds, campus gate, Nigerian flag, multiple footpaths and roads, landscaped trees, benches, central quad and a marked sports field.
- Separate, enterable buildings: Administration / Principal's Office, Mathematics Classroom, English Classroom, Science Laboratory, Assembly Hall, Great Hall, School Library, Blue House Hostel, Green House Hostel, Dining Hall, School Clinic, Staff School, Arts & Culture Room, ICT & Physics Lab, Campus Shop, Quiet Prayer Hall, Printing Press and Production Workshop.
- A labelled overhead 3D campus mode, a separate drawn campus map with student markers, a directory, and quick travel to building entrances.

### School life

- Custom-assembled 3D student and staff characters, with variations in complexion, hairstyles, uniforms and roles.
- Contextual conversations with classmates, teachers, prefects, the principal and campus staff. The dialogue includes quick replies and typed questions.
- A timetable with assembly, classes, breaks, meals, study, games and lights-out; time advances through the school day.
- Enterable hostels with bunks and lockers, study desks, dining, the shop, character relationships, pocket money, energy, knowledge, conduct, reputation, XP, levels and a term checklist.
- Sleep to move into a fresh day, restore energy, and continue your school story.

### Nigerian schoolyard games

- **Penalty shoot-out:** five shots against a schoolmate and a simulated goalkeeper.
- **Ayo Olopon:** turn-based seed-sowing strategy against a student AI.
- **Suwe:** a numbered chalk-hop course.
- **Ten-ten:** a clap, step and turn rhythm challenge.

Winning games can increase reputation, friendship, XP and pocket money. Pocket money can be spent at the campus shop on snacks, exercise books and a football. Progress is stored with browser `localStorage` and stays on that device/browser.


## Visual overhaul (v2)

Reworked to match a warm, hazy Nigerian-campus look:

- **Buildings:** painted plaster walls with rain streaks and grime, dark-red or navy plinth stripe, barred windows (some with red curtains), painted double doors, name signs above the door, and shrubs at the foundations. Windows and signs now sit on the outside of the walls.
- **Roofs:** terracotta and dark-red corrugated hip roofs on the two-storey blocks, gable roofs with fascia boards on the small buildings, and flat concrete roofs with parapets and water tanks on the workshops. Hostels, dining hall, library, administration and the halls are two storeys.
- **Ground:** olive grass with dry patches, gravel roads with oil stains and patches, orange laterite shoulders and scattered laterite decals, and a worn football pitch.
- **Trees:** low-poly umbrella trees and drooping-frond palms, plus a few hundred instanced trees around the campus edge.
- **Sky and light:** gradient sky dome with drifting clouds, soft haze fog, warmer sun, and street lamps along the main avenue.
- **Characters and UI:** a green plumbob floats over every NPC. On mobile, a location pill shows where you are, for example "Campus road · near Dining Hall".

All textures are generated in code, so there are no extra asset files. To add your own photo textures later, replace the generators in the `GEN` object in `game.js`.

## Character overhaul (v3)

Every person in the game has been rebuilt as a realistic-proportion human (about seven heads tall) instead of the old big-head figures. The new builder lives in **`characters.js`** and is loaded before `game.js`.

- **Anatomy:** neck, jaw and chin, cheekbones, nose with nostrils, upper and lower lips, eyes with lids, irises and brows, ears, shoulders, elbows, hands with fingers and thumbs, knees, shoes with soles.
- **Boys and girls, men and women:** different body shapes, heights and builds. Students are shorter than teachers, and each person has slight height variation.
- **Uniforms:** white shirts with house ties (Blue and Green House), navy trousers, shorts or pleated skirts, socks and black shoes. Prefects wear sashes.
- **Staff outfits:** rolled-sleeve shirts and ties, a lab coat, cardigans, a blazer, a nurse's uniform and cap, kitchen and workshop aprons, Ankara-print head ties and skirts.
- **Hair:** low cut, fade, short curls, short twists, afro, cornrows, braids, afro puffs, bun, head ties and hijabs. Beards, moustaches, goatees and glasses for staff.
- **Player choice:** the title screen now asks whether you are a boy or a girl, and offers all of the hairstyles above.
- **Performance:** each person is baked into roughly 36 merged meshes (the old builder used around 100 separate meshes), so a full classroom stays cheap.

### Real lessons in the classrooms

Walk into Mathematics, English, the Science Lab, the ICT Lab, Staff School (Civic Education) or the Arts & Culture Room and a lesson is already running:

1. The teacher **writes the lesson on the chalkboard**, line by line, while the class copies it down.
2. The teacher **turns and explains**, gesturing, with a speech bubble above their head.
3. The teacher **walks the room**, stopping to point at or lean over a student's work.
4. The teacher **asks a question**; several students raise their hands, one is chosen and answers, and the teacher responds.
5. The board is wiped and the cycle repeats.

Ten students sit at desks (or stand at the lab benches and art tables), a mix of boys and girls. They write notes, look at the teacher, glance around and raise their hands. You can still talk to any teacher or student mid-lesson. Teachers have a new subject each (Mr. Okafor, Mrs. Balogun, Dr. Eze, Mr. Lawal, Mrs. Nwosu, Mr. Adebayo), and students in the dining hall now sit and eat.

Lessons currently run whenever you enter a classroom. Fourteen new students were added so each class and corner of the campus has its own faces; the old clones are gone.

### Tuning
- Look and outfit of everyone: the `npcDefs` object in `game.js` (colours, hair, gender, glasses and so on).
- Lesson text, board writing and teacher routes: the `LESSONS` object in `game.js`.
- Pose and animation behaviour: `update()` in `characters.js`.

## Publishing the static build

The folder is a static website: upload its contents to a static host such as Netlify, Cloudflare Pages or GitHub Pages, or serve it from your own web server. Keep `index.html`, `style.css`, `characters.js`, `game.js` and the README together. No account, API key or database is required for the current offline-local gameplay.

## Important scope notes

This is an expanded game prototype, not yet a finished AAA commercial game. Its characters are procedural 3D models built in code, with realistic proportions but not photorealistic scans; movement and conversations are locally simulated. The mini-game rivals are AI schoolmate characters, **not real online players**—online multiplayer would require networking, hosted game sessions, moderation and a backend, which are not included in this static build. A public launch is possible as a static browser game, but commercial release would need more QA, art/animation polish, audio, performance tuning and explicit multiplayer work if live play is required.
