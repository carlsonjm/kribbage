import QtQml
import "../engine/game.mjs" as Game
import "../engine/ai.mjs" as Ai

// Proves the engine runs inside Qt's own JavaScript engine, the one the
// Plasma app will use: plays computer-vs-computer games and prints totals.
QtObject {
    Component.onCompleted: {
        let wins = [0, 0];
        for (let seed = 1; seed <= 100; seed++) {
            const g = Game.newGame({ seed: seed });
            while (g.phase !== "over") {
                if (g.phase === "discard") {
                    for (const p of [0, 1])
                        Game.discard(g, p, Ai.chooseDiscard(g.hands[p], g.dealer === p, p ? "sharp" : "steady"));
                } else if (g.phase === "play") {
                    const p = g.turn;
                    if (Game.mustSayGo(g, p)) Game.sayGo(g, p);
                    else Game.play(g, p, Ai.choosePlay(g, p, p ? "sharp" : "steady"));
                } else {
                    Game.nextShow(g);
                }
                Game.takeEvents(g);
            }
            wins[g.winner]++;
        }
        console.log("QML engine OK: steady " + wins[0] + ", sharp " + wins[1]);
        Qt.exit(0);
    }
}
