import QtQml
import "../qml"
import "../engine/ai.mjs" as Ai

// Drives the controller the way the screens will, with the computer's
// own choices standing in for the person's taps, until games finish.
QtObject {
    id: root
    property int games: 0
    property int target: 20
    property int matches: 0
    property var tally: ({ score: 0, play: 0, go: 0, reset: 0, show: 0, over: 0, called: 0, fated: 0 })

    property GameController c: GameController {
        pace: 0
        level: "sharp"
        onHappened: (event) => {
            if (event.type in root.tally) root.tally[event.type]++;
            if (event.type === "starter" && root.c.fatedStarter) root.tally.fated++;
        }
        onRefused: (reason) => { console.log("REFUSED " + reason); Qt.exit(1); }
        onRevisionChanged: personTimer.restart()
    }

    property Timer personTimer: Timer {
        interval: 0
        onTriggered: {
            const g = root.c.game;
            if (g.phase === "over") {
                root.games++;
                if (root.games >= root.target) {
                    if (root.tally.fated === 0) { console.log("Fate never chose a card"); Qt.exit(1); return; }
                     console.log("controller OK: " + root.games + " games, " + root.matches + " matches, " + JSON.stringify(root.tally));
                    Qt.exit(0);
                    return;
                }
                if (root.c.matchOver) {
                    root.matches++;
                    root.c.newMatch(root.matches % 2 ? 3 : 5, root.games + 500);
                } else {
                    root.c.nextGame(root.games + 500);
                }
            } else if (g.phase === "discard" && !g.discarded[0]) {
                const toss = Ai.chooseDiscard(g.hands[0], g.dealer === 0, "steady");
                if (root.c.keptWorth(g.hands[0], toss) < 0) Qt.exit(1);
                root.c.discard(toss);
            } else if (root.c.fateReady) {
                // Call on it twice in three, to cover both buttons.
                if (root.tally.called++ % 3 < 2) root.c.callFate();
                else root.c.justCut();
            } else if (root.c.youMustSayGo) {
                root.c.sayGo();
            } else if (root.c.yourTurn) {
                root.c.play(Ai.choosePlay(g, 0, "steady"));
            } else if (g.phase === "show") {
                root.c.nextShow();
            }
        }
    }

    Component.onCompleted: c.newMatch(3, 1)
}
