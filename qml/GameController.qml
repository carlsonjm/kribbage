import QtQml
import "../engine/game.mjs" as Game
import "../engine/ai.mjs" as Ai
import "../engine/cards.mjs" as Cards
import "../engine/score.mjs" as Score
import "../engine/fate.mjs" as Fate
import "../engine/match.mjs" as Match

// Sits between the screens and the rules. The screens read `game` and
// call the person's moves; the computer's moves come from a timer so each
// one lands at a pace the eye can follow. Nothing here draws anything.
QtObject {
    id: controller

    // Seats: 0 is the person, 1 the computer.
    readonly property int you: 0
    readonly property int computer: 1

    property string level: "steady"
    // How long the computer waits before each move, in ms.
    property int pace: 800
    // Set while the screens are still showing what happened, so the
    // computer waits its turn instead of racing ahead of the animation.
    property bool hold: false
    onHoldChanged: if (!hold) computerTimer.restart()

    property var game: null
    // The Fate meter beside the game (fate.mjs), and its own dice so the
    // cut stays repeatable from the seed.
    property var fate: Fate.newFate()
    property var fateRandom: null
    // The match this game belongs to: best of 3, 5 or 7 (match.mjs).
    property var match: Match.newMatch(7)
    readonly property bool matchOver: revision >= 0 && match.winner !== null
    // True when the last starter was chosen by Fate, for the glow.
    property bool fatedStarter: false
    // Bumped after every change so bindings on `game` re-read it.
    property int revision: 0

    readonly property string phase: revision >= 0 && game ? game.phase : ""
    readonly property bool yourTurn: revision >= 0 && !!game && game.phase === "play" && game.turn === you
    readonly property bool youMustSayGo: revision >= 0 && !!game && Game.mustSayGo(game, you)
    readonly property bool fateOn: revision >= 0 && fate.on
    readonly property real fateLevel: revision >= 0 ? fate.level : 0
    // The game is paused at the cut, waiting for "Call on Fate" or "Just cut".
    readonly property bool fateReady: revision >= 0 && !!game && game.phase === "cut" && Fate.isFull(fate)

    // One signal per thing that happened, in order, for the screens to
    // animate: deal, discard, cut, starter, play, go, reset, score, show, over.
    signal happened(var event)
    signal refused(string reason)

    // Starts a match of `bestOf` games and deals its first.
    function newMatch(bestOf, seed) {
        match = Match.newMatch(bestOf === undefined ? match.bestOf : bestOf);
        newGame(seed);
    }

    function setMatchLength(bestOf) {
        Match.setLength(match, bestOf);
        revision++;
    }

    // Deals the next game of the match; the loser of the last one deals.
    function nextGame(seed) {
        if (!game || game.phase !== "over" || match.winner !== null)
            return;
        newGame(seed, 1 - game.winner);
    }

    function newGame(seed, dealer) {
        const s = seed === undefined ? Date.now() : seed;
        game = Game.newGame({ seed: s, manualCut: true, dealer: dealer === undefined ? null : dealer });
        fateRandom = Cards.rng(s ^ 0x0fa7e);
        fate.level = 0;
        fatedStarter = false;
        changed();
    }

    function discard(cards) {
        act(function () { Game.discard(game, you, cards); });
    }

    function play(card) {
        act(function () { Game.play(game, you, card); });
    }

    function sayGo() {
        act(function () { Game.sayGo(game, you); });
    }

    function nextShow() {
        act(function () { Game.nextShow(game); });
    }

    // At a full meter: Fate picks the starter, or the cut falls as it may
    // and the meter waits for a later hand.
    function callFate() {
        act(function () { cut(true); });
    }

    function justCut() {
        act(function () { cut(false); });
    }

    function setFateOn(on) {
        Fate.setOn(fate, on);
        revision++;
        computerTimer.restart();
    }

    function cut(call) {
        const c = Fate.chooseCut(fate, game, call, fateRandom);
        fatedStarter = c.fated;
        Game.cutAt(game, c.index);
    }

    function playable(seat) {
        return game ? Game.playable(game, seat) : [];
    }

    function count() {
        return game ? Game.count(game) : 0;
    }

    // What the four cards left would score with no starter, for the crib
    // helper while the person chooses.
    function keptWorth(hand, toss) {
        return Score.handTotal(Cards.without(hand, toss), null);
    }

    function act(move) {
        try {
            move();
        } catch (e) {
            refused(e.message);
            return;
        }
        changed();
    }

    function changed() {
        const events = Game.takeEvents(game);
        for (let i = 0; i < events.length; i++) {
            if (events[i].type === "deal")
                fatedStarter = false;
            Fate.noteEvent(fate, events[i]);
            if (events[i].type === "over")
                Match.recordGame(match, events[i].winner, events[i].skunk);
            happened(events[i]);
        }
        revision++;
        computerTimer.restart();
    }

    // The computer acts whenever the game is waiting on it.
    function computerStep() {
        if (!game)
            return false;
        if (game.phase === "discard" && !game.discarded[computer]) {
            Game.discard(game, computer, Ai.chooseDiscard(game.hands[computer], game.dealer === computer, level));
            return true;
        }
        // Whoever cuts, the cut happens on its own unless a full meter is
        // waiting for the person.
        if (game.phase === "cut" && !Fate.isFull(fate)) {
            cut(false);
            return true;
        }
        if (game.phase === "play" && game.turn === computer) {
            if (Game.mustSayGo(game, computer))
                Game.sayGo(game, computer);
            else
                Game.play(game, computer, Ai.choosePlay(game, computer, level));
            return true;
        }
        return false;
    }

    property Timer computerTimer: Timer {
        interval: controller.pace
        onTriggered: {
            if (controller.hold)
                return;
            if (controller.computerStep())
                controller.changed();
        }
    }
}
