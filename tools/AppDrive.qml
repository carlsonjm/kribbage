import QtQuick
import "../qml"

// Plays the game screen as a person would, for checks and pictures
// (tools/scenerun.py tools/AppDrive.qml out.png 0 [--fast] [--hands=N]).
// Lays the first two cards in the crib, plays the first legal card, calls
// on Fate when it is full, and asks for a picture at each new moment.
Window {
    id: window
    signal snap(string name)
    signal finished()
    function option(name, fallback) {
        const args = Qt.application.arguments;
        for (let i = 0; i < args.length; i++) {
            if (args[i] === "--" + name) return "1";
            if (args[i].indexOf("--" + name + "=") === 0) return args[i].slice(name.length + 3);
        }
        return fallback;
    }
    readonly property bool fast: option("fast", "") === "1"
    readonly property int hands: Number(option("hands", "2"))
    width: 1440
    height: 820
    visible: true
    color: "#141414"

    GameView {
        id: view
        anchors.fill: parent
        reducedMotion: window.fast
        Component.onCompleted: {
            if (window.fast) {
                controller.pace = 20;
                view.startMatch(Number(window.option("length", "1")));
            }
        }
    }
    readonly property var controller: view.controller

    property var seen: ({})
    property int shows: 0
    property int fates: 0
    function once(name) {
        if (fast || seen[name]) return;
        const s = seen; s[name] = true; seen = s;
        snap(name);
    }
    Timer {
        interval: window.fast ? 30 : 500
        running: true
        repeat: true
        onTriggered: {
            const c = window.controller, g = c && c.game;
            if (!g || view.running || view.dealing) return;
            const hand = g.handNumber;
            if (hand > window.hands && !window.fast) { window.finished(); return; }
            if (view.phase === "discard") {
                if (view.picked.length < 2) { view.choose(view.sorted(g.hands[0])[view.picked.length === 0 ? 0 : 3]); return; }
                window.once("discard-" + hand);
                view.act();
            } else if (view.phase === "cut" && view.awaitingFate) {
                window.fates++;
                window.once("fate-" + hand);
                view.act();
            } else if (view.phase === "play" && c.yourTurn) {
                window.once("play-" + hand);
                if (c.youMustSayGo) view.act(); else view.choose(c.playable(0)[0]);
            } else if (view.phase === "show" && view.receipt) {
                window.once("show-" + hand + "-" + g.showStep);
                view.hilite = view.receipt.lines.length ? 0 : -1;
                window.once("show-" + hand + "-" + g.showStep + "-line");
                window.shows++;
                view.act();
            } else if (view.phase === "over") {
                console.log("over", JSON.stringify(g.scores), "hands", hand, "fates", window.fates, "shows", window.shows, "shown", JSON.stringify(view.shownScores));
                window.snap("over");
                window.finished();
            }
        }
    }
}
