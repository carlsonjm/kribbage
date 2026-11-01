import QtQuick
import "../qml/scene"
import "../board/trail.mjs" as Trail

// The trail scene alone, for pictures (tools/scenerun.py). Options:
// --place=forest|autumn|winter  --peg=brass|slim|firefly|toadstool|crystal
// --at=HOLE (where the camera rests)  --scores=YOU,COMPUTER
Window {
    width: 1280
    height: 760
    visible: true

    function option(name, fallback) {
        const args = Qt.application.arguments;
        for (let i = 0; i < args.length; i++) {
            if (args[i].indexOf("--" + name + "=") === 0) return args[i].slice(name.length + 3);
        }
        return fallback;
    }

    TrailScene {
        id: scene
        anchors.fill: parent
        place: option("place", "forest")
        pegStyle: option("peg", "brass")
        Component.onCompleted: {
            const s = option("scores", "14,9").split(",").map(Number);
            setPegs(0, s[0], Math.max(0, s[0] - 4));
            setPegs(1, s[1], Math.max(0, s[1] - 4));
            rest(Trail.holeAt(0, Number(option("at", "12"))));
        }
    }
}
