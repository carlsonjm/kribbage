# Kribbage

Two-handed Cribbage for KDE Plasma: you against the computer, first to 121.

Status (31 Oct 2026): the rules, the computer player, the Fate meter and
match play are done and tested. The look was approved on 31 Oct 2026 as a
playable 3D prototype (https://claude.ai/artifact/XUsJtvepNXREVwYv9cph6Q, copy
in `design/`), and the Plasma screens are built to it: the trail in Qt Quick
3D, the table over it in Qt Quick. Full games and matches play through in
the PySide6 previews; the Plasma build itself has not yet run on a desktop.

## Layout

- `engine/` – the rules, as plain JavaScript modules with no dependencies.
  The same files run in the Qt app and in node.
  - `cards.mjs` – cards, deck, seeded shuffle
  - `score.mjs` – counting a hand or crib (as readable lines) and the play
  - `game.mjs` – one game start to finish: deal, crib, starter and his
    heels, the play with go and last card, the show, skunks
  - `ai.mjs` – the computer at three strengths: easy, steady, sharp
  - `match.mjs` – best of 3, 5 or 7; skunks count two games, double skunks three
  - `fate.mjs` – the Fate meter: bad luck fills it, and a full meter can be
    called on at the cut to turn the best card for your hand. Kept beside
    the game so the rules stay standard and Fate can be switched off.
- `board/` – the trail board as numbers and shapes, plain JavaScript like
  `engine/`:
  - `trail.mjs` – the path, every hole, skunk lines, the three places
    (Forest, Autumn, Winter) and the lie of the ground in each
  - `meshes.mjs` – shapes as flat vertex arrays (cylinders, cones, spheres…)
  - `scene.mjs` – the ground, trees, pegs and wildlife built from them
  - `ground.mjs` – paints the ground and the trail with its holes
- `qml/GameController.qml` – joins the screens to the rules and paces the
  computer's moves. Draws nothing. Waits while the screen animates (`hold`).
- `qml/GameView.qml` – the game screen: plays each event in turn with its
  animation, and lays the panels over the trail.
- `qml/scene/` – the 3D trail (`TrailScene`), pegs (`PegUnit`), and the
  campfire, critter and birds (`Ambient`).
- `qml/table/` – cards, buttons, panels, the menu and the corner map.
- `src/meshgeometry.*` – hands meshes from `board/` to Qt Quick 3D as raw
  bytes, in its own small QML module (`co.goodinput.Kribbage.Mesh`).
- `qml/Main.qml`, `src/main.cpp`, `CMakeLists.txt` – the Kirigami app.
- `packaging/` – desktop entry, AppStream metainfo, Flatpak manifest.
- `design/` – the approved look (31 Oct 2026): `trail-prototype.html` is the
  playable reference the Plasma screens are built to; `peg-lineup.html` is the
  peg study it chose from (Brass, Classic, Fireflies, Toadstools, Crystals).
- `test/` – node tests. `tools/` – runs the engine, controller and screens
  inside Qt with PySide6, using a Python copy of MeshGeometry
  (`tools/meshgeometry.py`; keep it in step with `src/`).

## Checks

    node --test test/*.test.mjs
    QT_QPA_PLATFORM=offscreen python3 tools/qmlrun.py tools/QmlSmoke.qml
    QT_QPA_PLATFORM=offscreen python3 tools/qmlrun.py tools/ControllerSmoke.qml
    # The screens (needs a display; xvfb-run works):
    xvfb-run -a python3 tools/scenerun.py tools/ScenePreview.qml trail.png 8000 --place=autumn
    xvfb-run -a python3 tools/scenerun.py tools/AppPreview.qml app.png 6000
    xvfb-run -a python3 tools/scenerun.py tools/AppDrive.qml drive.png 0 --fast --length=3

Qt's JavaScript engine has no object spread (`{ ...x }`); use
`Object.assign` in `engine/`.
