# Kribbage

Two-handed Cribbage for KDE Plasma: you against the computer, first to 121.

Status (30 Oct 2026): the rules, the computer player and the Fate meter are
done and tested. The look is being settled in a playable 3D prototype
(https://claude.ai/artifact/XUsJtvepNXREVwYv9cph6Q, copy in `design/`), approved
on 31 Oct 2026. Next: the Plasma screens, with the trail drawn in Qt Quick 3D.

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
- `qml/GameController.qml` – joins the screens to the rules and paces the
  computer's moves. Draws nothing.
- `qml/Main.qml`, `src/main.cpp`, `CMakeLists.txt` – the Kirigami app.
- `packaging/` – desktop entry, AppStream metainfo, Flatpak manifest.
- `design/` – the approved look (31 Oct 2026): `trail-prototype.html` is the
  playable reference the Plasma screens are built to; `peg-lineup.html` is the
  peg study it chose from (Brass, Classic, Fireflies, Toadstools, Crystals).
- `test/` – node tests. `tools/` – runs the engine and controller inside
  Qt's own JavaScript engine (needs PySide6).

## Checks

    node --test test/*.test.mjs
    QT_QPA_PLATFORM=offscreen python3 tools/qmlrun.py tools/QmlSmoke.qml
    QT_QPA_PLATFORM=offscreen python3 tools/qmlrun.py tools/ControllerSmoke.qml

Qt's JavaScript engine has no object spread (`{ ...x }`); use
`Object.assign` in `engine/`.
