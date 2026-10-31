import QtQuick
import QtCore
import "scene"
import "table"
import "../board/trail.mjs" as Trail
import "../engine/game.mjs" as Game
import "../engine/score.mjs" as Score
import "../engine/cards.mjs" as Cards
import "../engine/match.mjs" as Match

// The whole game screen, built to the approved prototype
// (design/trail-prototype.html): the trail in 3D filling the window, with
// quiet glass panels over it for the scores, Fate, the map, the cards and
// the one button for what to do next.
//
// Everything the rules do arrives as events from GameController. They play
// here one at a time, each with its animation, and the computer waits
// (controller.hold) until the screen has caught up.
Rectangle {
    id: root

    // Less motion when the person asks for it: no flights, no deal.
    property bool reducedMotion: false
    readonly property alias controller: controller
    readonly property alias settings: saved

    color: theme.piano

    Style { id: theme }

    GameController {
        id: controller
        onHappened: (event) => root.enqueue(event)
        onRefused: (reason) => root.say(reason)
    }

    // What a new game will be, and how the trail looks, kept between runs.
    Settings {
        id: saved
        category: "Table"
        property string place: "forest"
        property string pegStyle: "brass"
        property bool fateOn: true
        property int length: 1
        property string level: "steady"
    }

    // ---- What the screen shows, which runs behind the rules while events play.
    property var shownScores: [0, 0]
    property var pileView: []          // [{ card, player }]
    property var receipt: null         // { step, player, cards, lines, total }
    property int hilite: -1            // a line of the receipt, lifted
    property var picked: []            // the two cards chosen for the crib
    property bool dealing: false
    property bool fatedStarter: false
    property bool running: false
    // The game object stays the same while its contents change, so
    // bindings that read inside it also read `rev` to hear each change.
    readonly property int rev: controller.revision
    readonly property var g: rev >= 0 ? controller.game : null
    readonly property string phase: controller.phase
    readonly property bool awaitingFate: controller.fateReady && !running

    function same(a, b) { return !!a && !!b && a.rank === b.rank && a.suit === b.suit; }
    function sorted(hand) {
        return hand.slice().sort(function (a, b) { return a.rank - b.rank || (a.suit < b.suit ? -1 : a.suit > b.suit ? 1 : 0); });
    }
    readonly property var rankLabels: ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
    readonly property var suitNames: ({ s: "spades", h: "hearts", d: "diamonds", c: "clubs" })
    readonly property var suitSymbols: ({ s: "♠", h: "♥", d: "♦", c: "♣" })

    // ---- Time: one clock for every wait, driven by the scene's frames.
    property var waits: []
    function wait(ms) {
        return new Promise(function (resolve) {
            const w = waits.slice();
            w.push({ at: scene.now + (reducedMotion ? Math.min(ms, 200) : ms), resolve: resolve });
            waits = w;
        });
    }
    Connections {
        target: scene
        function onNowChanged() {
            if (!root.waits.length) return;
            const due = [], rest = [];
            for (let i = 0; i < root.waits.length; i++) (root.waits[i].at <= scene.now ? due : rest).push(root.waits[i]);
            if (!due.length) return;
            root.waits = rest;
            for (let i = 0; i < due.length; i++) due[i].resolve();
        }
    }
    function fly(point, force) {
        return new Promise(function (resolve) { scene.lookAt(point, force, resolve); });
    }

    // ---- Events, one at a time. Each handler is a generator: it yields a
    // promise, and the runner carries on when the promise settles.
    property var queue: []
    property int generation: 0
    function enqueue(event) {
        const q = queue.slice();
        q.push(event);
        queue = q;
        if (!running) runQueue();
    }
    function runQueue() {
        running = true;
        controller.hold = true;
        const mine = generation;
        const next = function () {
            if (mine !== generation) return;
            if (!queue.length) { running = false; controller.hold = false; return; }
            const event = queue[0];
            queue = queue.slice(1);
            const steps = handle(event);
            const step = function (value) {
                if (mine !== generation) return;
                const r = steps.next(value);
                if (r.done) next(); else Promise.resolve(r.value).then(step);
            };
            step();
        };
        next();
    }
    // Drops whatever was still to play, for a new game.
    function abandon() {
        generation++;
        queue = [];
        waits = [];
        running = false;
        controller.hold = false;
    }

    function why(e) {
        if (e.reason === "hand") return "hand of " + e.points;
        if (e.reason === "crib") return "crib of " + e.points;
        if (e.reason === "go") return "one for the go";
        if (e.reason === "last card") return "one for last card";
        if (e.reason === "his heels") return "two for his heels";
        return e.lines.map(function (l) { return (l.kind === "run" ? "run of " + l.points : l.kind) + " for " + l.points; }).join(", ");
    }

    function* handle(e) {
        if (e.type === "deal") {
            pileView = []; receipt = null; picked = []; hilite = -1; fatedStarter = false;
            say(e.dealer === 0 ? "Your deal, so the crib is yours" : "The computer deals, so the crib is its");
            if (!reducedMotion) {
                dealing = true;
                dealer.dealerSeat = e.dealer;
                dealer.t0 = scene.now;
                yield wait(dealer.duration);
                dealing = false;
            }
            yield wait(200);
        } else if (e.type === "cut") {
            if (!controller.fateReady) {
                say(e.player === 0 ? "You cut the deck" : "The computer cuts the deck");
            }
        } else if (e.type === "starter") {
            fatedStarter = controller.fatedStarter;
            say((fatedStarter ? "Fate: the cut falls on the " : "Starter: ") + rankLabels[e.card.rank] + " of " + suitNames[e.card.suit]);
            yield wait(fatedStarter ? 1300 : 700);
        } else if (e.type === "play") {
            const p = pileView.slice();
            p.push({ card: e.card, player: e.player });
            pileView = p;
            yield wait(260);
        } else if (e.type === "go") {
            say(e.player === 0 ? "You say go" : "Computer says go");
            yield wait(800);
        } else if (e.type === "reset") {
            yield wait(900);
            pileView = [];
        } else if (e.type === "show") {
            const s = controller.game.show;
            receipt = { step: e.step, player: e.player, cards: s.cards.slice(), lines: s.lines, total: e.total };
            hilite = -1;
            yield wait(600);
        } else if (e.type === "score") {
            yield* peg(e.player, e.points, why(e));
        }
    }

    // Scoring: the back peg leapfrogs the front one, hole by hole, and the
    // camera follows when the move runs out of view.
    function* peg(player, n, reason) {
        if (n <= 0) return;
        const front = scene.fronts[player], back = scene.backs[player];
        yield fly(Trail.holeAt(player, front), false);
        const target = Math.min(121, front + n);
        if (reason) say((player === 0 ? "You: " : "Computer: ") + reason);
        const follow = fly(Trail.holeAt(player, target), false);
        const step = reducedMotion ? 0 : Math.max(40, Math.min(110, 1000 / (target - back)));
        for (let k = Math.max(back, 0) + 1; k <= target; k++) {
            if (k <= front && k !== target) continue;
            scene.stepBack(player, k);
            if (step) yield wait(step);
        }
        yield follow;
        scene.setPegs(player, target, front);
        gains.add(player, target, n);
        const s = shownScores.slice();
        s[player] = target;
        shownScores = s;
        yield wait(260);
    }

    // ---- Moves.
    function choose(c) {
        if (running || !g) return;
        if (phase === "discard") {
            const p = picked.slice();
            const i = p.findIndex(function (s) { return same(s, c); });
            if (i >= 0) p.splice(i, 1);
            else if (p.length < 2) p.push(c);
            else { p.shift(); p.push(c); }
            picked = p;
        } else if (phase === "play" && controller.yourTurn) {
            controller.play(c);
        }
    }
    function act() {
        if (running || !g) return;
        if (awaitingFate) { controller.callFate(); return; }
        if (phase === "discard") { const p = picked; picked = []; controller.discard(p); }
        else if (phase === "play") controller.sayGo();
        else if (phase === "show") { receipt = null; controller.nextShow(); }
        else if (phase === "over") {
            if (controller.matchOver || controller.match.bestOf === 1) startMatch(controller.match.bestOf);
            else { resetBoard(); controller.nextGame(); }
        }
    }
    function resetBoard() {
        abandon();
        shownScores = [0, 0];
        scene.setPegs(0, 0, 0);
        scene.setPegs(1, 0, 0);
        scene.rest(Trail.holeAt(0, 4));
        receipt = null; pileView = []; picked = []; hilite = -1;
    }
    function startMatch(length) {
        resetBoard();
        controller.newMatch(length);
    }

    // ---- A word about what just happened, at the top of the stage.
    function say(text) {
        eventText.text = text;
        eventPanel.opacity = 1;
        eventTimer.restart();
    }
    Timer { id: eventTimer; interval: 1900; onTriggered: eventPanel.opacity = 0 }

    // ---- Layout.
    // The header: the name, what kind of game this is, New game and Menu.
    Item {
        id: header
        x: 16
        width: parent.width - 32
        height: 64
        Row {
            anchors.verticalCenter: parent.verticalCenter
            spacing: 12
            Text { text: "Kribbage"; color: theme.ghost; font.pixelSize: 16; font.weight: Font.DemiBold; anchors.verticalCenter: parent.verticalCenter }
            Text {
                anchors.verticalCenter: parent.verticalCenter
                color: theme.ghostSoft
                font.pixelSize: 13
                text: (controller.match.bestOf === 1 ? "Single game" : "Best of " + controller.match.bestOf)
                    + " against " + (controller.level === "easy" ? "an easy" : "a " + controller.level) + " opponent"
            }
        }
        Row {
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            spacing: 12
            PillButton { primary: true; text: "New game"; onClicked: root.menuOpen = true }
            PillButton {
                text: "☰  Menu"
                Accessible.name: "Menu"
                onClicked: root.menuOpen = !root.menuOpen
            }
        }
    }
    property bool menuOpen: false

    Item {
        id: stage
        x: 16
        y: header.height
        width: parent.width - 32
        height: parent.height - header.height - 16
        clip: true
        readonly property bool narrow: width < 760
        readonly property real cw: Math.max(54, Math.min(100, root.width * 0.07))
        readonly property real pw: Math.max(40, Math.min(64, root.width * 0.046))

        TrailScene {
            id: scene
            anchors.fill: parent
            place: saved.place
            pegStyle: saved.pegStyle
            reducedMotion: root.reducedMotion
        }

        // Tapping the trail closes the menu.
        TapHandler { enabled: root.menuOpen; onTapped: root.menuOpen = false }

        // ---- Floating "+n" over the peg that just moved.
        Item {
            id: gains
            anchors.fill: parent
            property var list: []
            property int serial: 0
            function add(player, hole, n) {
                const h = Trail.holeAt(player, hole);
                const l = list.filter(function (f) { return scene.now - f.t0 < 1300; });
                l.push({ id: serial++, x: h.x, y: h.y, n: n, player: player, t0: scene.now });
                list = l;
            }
            Repeater {
                model: gains.list
                delegate: Rectangle {
                    required property var modelData
                    readonly property real t: (scene.now - modelData.t0) / 1300
                    readonly property point p: scene.project(modelData.x, modelData.y, 95 + Math.min(1, t) * 50)
                    visible: t < 1
                    x: p.x - width / 2
                    y: p.y
                    width: gainText.implicitWidth + 20
                    height: gainText.implicitHeight + 8
                    radius: 10
                    color: theme.glass
                    opacity: t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4)
                    Text {
                        id: gainText
                        anchors.centerIn: parent
                        text: "+" + modelData.n
                        color: modelData.player === 0 ? theme.you : theme.them
                        font.pixelSize: 30
                        font.weight: Font.DemiBold
                    }
                }
            }
        }

        // ---- Scores, the match and Fate, top left.
        Panel {
            id: scores
            x: 12
            y: 12
            width: scoreGrid.implicitWidth + 24
            height: scoreGrid.implicitHeight + 24
            Column {
                id: scoreGrid
                x: 12
                y: 12
                spacing: 6
                Repeater {
                    model: [[1, "Computer"], [0, "You"]]
                    Row {
                        required property var modelData
                        spacing: 12
                        Rectangle { width: 10; height: 10; radius: 5; anchors.verticalCenter: parent.verticalCenter; color: modelData[0] === 0 ? theme.you : theme.them }
                        Text { width: 72; text: modelData[1]; color: theme.ghostSoft; font.pixelSize: 14; anchors.verticalCenter: parent.verticalCenter }
                        Text {
                            width: 44
                            horizontalAlignment: Text.AlignRight
                            text: root.shownScores[modelData[0]]
                            color: theme.ghost
                            font.pixelSize: stage.narrow ? 18 : 22
                            font.weight: Font.DemiBold
                            font.features: { "tnum": 1 }
                            Accessible.name: modelData[1] + " " + text
                        }
                    }
                }
                // The match, when it is more than one game: a pip per game needed.
                Column {
                    visible: root.rev >= 0 && controller.match.bestOf > 1
                    spacing: 4
                    topPadding: 4
                    Rectangle { width: 170; height: 1; color: theme.line }
                    Item { width: 1; height: 4 }
                    Text { text: "Match  ·  Best of " + controller.match.bestOf; color: theme.ghostSoft; font.pixelSize: 12 }
                    Repeater {
                        model: [[1, "Computer"], [0, "You"]]
                        Row {
                            required property var modelData
                            spacing: 8
                            Text { width: 64; text: modelData[1]; color: theme.ghostSoft; font.pixelSize: 12 }
                            Row {
                                anchors.verticalCenter: parent.verticalCenter
                                spacing: 4
                                Repeater {
                                    model: root.rev >= 0 ? Match.needed(controller.match) : 0
                                    Rectangle {
                                        required property int index
                                        readonly property color tone: modelData[0] === 0 ? theme.you : theme.them
                                        width: 9; height: 9; radius: 4.5
                                        color: root.rev >= 0 && index < controller.match.wins[modelData[0]] ? tone : "transparent"
                                        border.width: 1.5
                                        border.color: tone
                                    }
                                }
                            }
                        }
                    }
                }
                // Fate.
                Row {
                    visible: controller.fateOn
                    spacing: 8
                    topPadding: 4
                    readonly property bool full: controller.fateLevel >= 100
                    Text { text: "Fate"; color: theme.ghostSoft; font.pixelSize: 12; anchors.verticalCenter: parent.verticalCenter }
                    Rectangle {
                        anchors.verticalCenter: parent.verticalCenter
                        width: 104; height: 6; radius: 3
                        color: theme.line
                        Rectangle {
                            height: parent.height
                            radius: 3
                            width: parent.width * Math.min(100, controller.fateLevel) / 100
                            color: parent.parent.full ? theme.fateFull : theme.fate
                            Behavior on width { NumberAnimation { duration: 600; easing.type: Easing.OutCubic } }
                        }
                    }
                    Text {
                        anchors.verticalCenter: parent.verticalCenter
                        text: parent.full ? "Ready" : Math.round(controller.fateLevel) + "%"
                        color: parent.full ? theme.fateFull : theme.ghostSoft
                        font.pixelSize: 12
                        font.weight: parent.full ? Font.DemiBold : Font.Normal
                    }
                }
            }
        }

        // ---- What just happened, top centre.
        Panel {
            id: eventPanel
            anchors.horizontalCenter: parent.horizontalCenter
            y: 12
            width: eventText.implicitWidth + 28
            height: eventText.implicitHeight + 16
            opacity: 0
            Behavior on opacity { NumberAnimation { duration: 200 } }
            Text { id: eventText; anchors.centerIn: parent; color: theme.ghost; font.pixelSize: 14 }
            Accessible.role: Accessible.StaticText
            Accessible.name: eventText.text
        }

        // ---- The computer's hand, face down, top right.
        Row {
            anchors.right: parent.right
            anchors.rightMargin: 12
            y: 12
            spacing: 4
            visible: !root.dealing && (root.phase === "discard" || root.phase === "play")
            Accessible.name: "Computer's hand"
            Repeater {
                model: root.rev >= 0 && root.g ? root.g.hands[1].length : 0
                Card { cardWidth: 34 }
            }
        }

        // ---- The map, bottom right.
        Panel {
            visible: !stage.narrow
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.margins: 12
            width: map.width + 16
            height: map.height + 16
            TrailMap {
                id: map
                x: 8
                y: 8
                width: 120
                height: implicitHeight
                scene: scene
                fronts: scene.fronts
                onLook: (point) => scene.lookAt(point, true)
            }
        }

        // ---- What to do now, above the table.
        Panel {
            id: promptPanel
            anchors.horizontalCenter: parent.horizontalCenter
            y: table.y - height - 12
            width: Math.min(promptText.implicitWidth + 28, stage.width - 32)
            height: promptText.implicitHeight + 16
            visible: promptText.text !== ""
            Text {
                id: promptText
                anchors.centerIn: parent
                width: Math.min(implicitWidth, stage.width - 60)
                wrapMode: Text.WordWrap
                horizontalAlignment: Text.AlignHCenter
                color: theme.ghost
                font.pixelSize: 15
                text: root.prompt
            }
            Accessible.role: Accessible.StaticText
            Accessible.name: promptText.text
        }

        // ---- The table: starter, crib, the cards laid, and the count.
        Panel {
            id: table
            anchors.horizontalCenter: parent.horizontalCenter
            // On a narrow window the button sits above the hand, so the table moves up for it.
            y: stage.height - stage.cw * 1.41 - 48 - height - (stage.narrow ? 64 : 0)
            width: Math.min(tableRow.implicitWidth + 32, stage.width - 32)
            height: tableRow.implicitHeight + 24
            Row {
                id: tableRow
                x: 16
                y: 12
                spacing: 16
                component Slot: Column {
                    property string label: ""
                    default property alias cards: holder.data
                    spacing: 4
                    Row { id: holder; anchors.horizontalCenter: parent.horizontalCenter; spacing: -stage.pw * 0.8 }
                    Text { anchors.horizontalCenter: parent.horizontalCenter; text: parent.label; color: theme.ghostSoft; font.pixelSize: 11 }
                }
                Slot {
                    label: "Starter"
                    Card {
                        cardWidth: stage.pw
                        card: root.rev >= 0 && root.g ? root.g.starter : null
                        fated: root.fatedStarter && !!card
                        raised: !!card && !!root.receipt && root.hilite >= 0 && root.receipt.lines[root.hilite].cards.some(function (x) { return root.same(x, card); })
                    }
                }
                Slot {
                    visible: !(root.receipt && root.receipt.step === "crib")
                    label: root.rev >= 0 && root.g && root.g.dealer === 0 ? "Your crib" : "Its crib"
                    Repeater {
                        model: root.rev >= 0 && root.g ? Math.max(1, root.g.crib.length) : 1
                        Card { cardWidth: stage.pw; dim: root.rev >= 0 && (!root.g || root.g.crib.length === 0) }
                    }
                }
                Rectangle { width: 1; height: stage.pw * 1.41 + 20; color: theme.line; anchors.verticalCenter: parent.verticalCenter }
                // The pile: yours sit low, the computer's sit high with a blue ring.
                Item {
                    width: Math.max(stage.pw * 2, pileRow.implicitWidth)
                    height: stage.pw * 1.41 + 28
                    Text {
                        visible: !root.receipt && root.pileView.length === 0
                        anchors.centerIn: parent
                        text: root.phase === "play" ? "Lay a card" : "The play starts here"
                        color: theme.ghostSoft
                        font.pixelSize: 12
                    }
                    Row {
                        id: pileRow
                        anchors.verticalCenter: parent.verticalCenter
                        spacing: -stage.pw * 0.42
                        Repeater {
                            model: root.receipt ? root.receipt.cards : root.pileView
                            Card {
                                required property var modelData
                                readonly property bool counted: !!root.receipt && root.hilite >= 0
                                    && root.receipt.lines[root.hilite].cards.some(function (x) { return root.same(x, card); })
                                cardWidth: stage.pw
                                card: root.receipt ? modelData : modelData.card
                                raised: counted
                                ring: !root.receipt && modelData.player === 1 ? theme.them : "transparent"
                                transform: Translate {
                                    y: counted ? -14 : root.receipt ? 0 : modelData.player === 1 ? -12 : 12
                                    Behavior on y { NumberAnimation { duration: 220; easing.type: Easing.OutCubic } }
                                }
                            }
                        }
                    }
                }
                Column {
                    anchors.verticalCenter: parent.verticalCenter
                    width: 64
                    Text {
                        text: root.receipt ? root.receipt.total : root.phase === "play" && root.rev >= 0 ? controller.count() : 0
                        color: theme.ghost
                        font.pixelSize: 44
                        font.weight: Font.DemiBold
                        font.features: { "tnum": 1 }
                    }
                    Text { text: root.receipt ? "points" : "of 31"; color: theme.ghostSoft; font.pixelSize: 11 }
                }
            }
        }

        // ---- Your hand, held as a fan.
        Item {
            id: hand
            anchors.horizontalCenter: parent.horizontalCenter
            y: stage.height - 10 - height
            width: 0
            height: stage.cw * 1.41 + 30
            readonly property var cards: root.rev >= 0 && !root.dealing && root.g && (root.phase === "discard" || root.phase === "play") ? root.sorted(root.g.hands[0]) : []
            readonly property var legal: root.rev >= 0 && root.phase === "play" ? controller.playable(0) : cards
            Repeater {
                model: hand.cards
                Card {
                    required property var modelData
                    required property int index
                    readonly property real off: index - (hand.cards.length - 1) / 2
                    readonly property bool chosen: root.picked.some(function (s) { return root.same(s, modelData); })
                    readonly property bool can: root.phase === "discard" || (controller.yourTurn && hand.legal.some(function (l) { return root.same(l, modelData); }))
                    card: modelData
                    cardWidth: stage.cw
                    interactive: true
                    enabled_: !root.running && can
                    dim: root.phase === "play" && (!can || (root.running && !controller.yourTurn))
                    x: -width / 2
                    y: hand.height - height
                    transformOrigin: Item.Bottom
                    transform: [
                        Rotation { origin.x: stage.cw / 2; origin.y: stage.cw * 1.41 * 1.2; angle: off * 5 },
                        Translate {
                            x: off * 0.8 * stage.cw
                            y: Math.abs(off) * Math.abs(off) * 5 - (chosen ? 30 : 0)
                            Behavior on y { NumberAnimation { duration: 220; easing.type: Easing.OutCubic } }
                        }
                    ]
                    onClicked: root.choose(modelData)
                }
            }
        }

        // ---- The one button for what to do next.
        Column {
            id: actions
            anchors.right: parent.right
            anchors.rightMargin: stage.narrow ? 12 : 160
            anchors.bottom: parent.bottom
            anchors.bottomMargin: stage.narrow ? stage.cw * 1.41 + 40 : 24
            spacing: 6
            Text {
                anchors.right: parent.right
                visible: text !== ""
                text: root.note
                color: theme.ghost
                font.pixelSize: 12
                style: Text.Raised
                styleColor: Qt.rgba(0, 0, 0, 0.8)
            }
            Row {
                anchors.right: parent.right
                spacing: 8
                PillButton {
                    visible: root.awaitingFate
                    pillHeight: 48; fontSize: 15
                    text: "Just cut"
                    onClicked: if (!root.running) controller.justCut()
                }
                PillButton {
                    visible: root.actText !== ""
                    enabled: root.actEnabled
                    primary: !root.awaitingFate
                    glowing: root.awaitingFate
                    pillHeight: 48; fontSize: 15
                    text: root.actText
                    onClicked: root.act()
                }
            }
        }

        // ---- The count of a hand, line by line.
        Panel {
            id: receiptPanel
            visible: !!root.receipt && root.phase !== "over"
            anchors.right: parent.right
            anchors.rightMargin: 12
            y: stage.narrow ? stage.height - height - 8 : 12
            width: Math.min(320, stage.width - 24)
            height: receiptBody.implicitHeight + 24
            Column {
                id: receiptBody
                x: 12
                y: 12
                width: parent.width - 24
                spacing: 2
                Text {
                    leftPadding: 8
                    bottomPadding: 6
                    text: root.showTitle
                    color: theme.ghost
                    font.pixelSize: 15
                    font.weight: Font.DemiBold
                }
                Repeater {
                    model: root.receipt ? root.receipt.lines : []
                    Rectangle {
                        id: lineRow
                        required property var modelData
                        required property int index
                        readonly property int runningTotal: root.receipt.lines.slice(0, index + 1).reduce(function (s, l) { return s + l.points; }, 0)
                        width: receiptBody.width
                        height: 40
                        radius: 10
                        color: index === root.hilite || lineHover.hovered ? theme.pressed : "transparent"
                        activeFocusOnTab: true
                        onActiveFocusChanged: if (activeFocus) root.hilite = index
                        Accessible.role: Accessible.Button
                        Accessible.name: lineLabel.text + ", " + modelData.points + ", " + runningTotal + " so far"
                        Row {
                            x: 8
                            anchors.verticalCenter: parent.verticalCenter
                            spacing: 6
                            Text {
                                id: lineLabel
                                width: 76
                                text: modelData.kind === "run" ? "Run of " + modelData.points : modelData.kind.charAt(0).toUpperCase() + modelData.kind.slice(1)
                                color: theme.ghost
                                font.pixelSize: 14
                            }
                            Text {
                                width: lineRow.width - 16 - 76 - 64 - 18
                                textFormat: Text.StyledText
                                text: modelData.cards.map(function (c) {
                                    const red = c.suit === "h" || c.suit === "d";
                                    return "<font color='" + (red ? "#FF8A7A" : "#A8A8AE") + "'>" + root.rankLabels[c.rank] + root.suitSymbols[c.suit] + "</font>";
                                }).join(" ")
                                font.pixelSize: 14
                                elide: Text.ElideRight
                            }
                            Text { width: 32; horizontalAlignment: Text.AlignRight; text: "+" + modelData.points; color: theme.ghostSoft; font.pixelSize: 14 }
                            Text { width: 32; horizontalAlignment: Text.AlignRight; text: lineRow.runningTotal; color: theme.ghost; font.pixelSize: 14; font.weight: Font.DemiBold }
                        }
                        HoverHandler { id: lineHover; onHoveredChanged: if (hovered) root.hilite = lineRow.index }
                        TapHandler { onTapped: root.hilite = root.hilite === lineRow.index ? -1 : lineRow.index }
                    }
                }
                Text {
                    visible: !!root.receipt && root.receipt.lines.length === 0
                    padding: 8
                    text: "Nothing scores. Nineteen, as they say."
                    color: theme.ghostSoft
                    font.pixelSize: 14
                }
                Rectangle { width: receiptBody.width; height: 1; color: theme.line }
                Item {
                    width: receiptBody.width
                    height: 36
                    Text { x: 8; anchors.bottom: parent.bottom; text: "Total"; color: theme.ghost; font.pixelSize: 15; font.weight: Font.DemiBold }
                    Text {
                        anchors.right: parent.right; anchors.rightMargin: 8; anchors.bottom: parent.bottom
                        text: root.receipt ? root.receipt.total : ""
                        color: theme.ghost; font.pixelSize: 22; font.weight: Font.DemiBold
                    }
                }
            }
        }

        // ---- The end of a game.
        Panel {
            id: banner
            visible: root.phase === "over" && !root.running
            anchors.horizontalCenter: parent.horizontalCenter
            y: stage.height * 0.38 - height / 2
            width: Math.min(bannerBody.implicitWidth + 56, stage.width - 32)
            height: bannerBody.implicitHeight + 48
            Column {
                id: bannerBody
                anchors.centerIn: parent
                spacing: 8
                Repeater {
                    model: root.bannerLines
                    Text {
                        required property var modelData
                        required property int index
                        anchors.horizontalCenter: parent.horizontalCenter
                        text: modelData
                        color: index === 0 ? theme.ghost : theme.ghostSoft
                        font.pixelSize: index === 0 ? 28 : 14
                        font.weight: index === 0 ? Font.DemiBold : Font.Normal
                    }
                }
            }
        }

        // ---- A short riffle shuffle, then six cards each, one at a time.
        Item {
            id: dealer
            anchors.fill: parent
            visible: root.dealing
            property int dealerSeat: 0
            property real t0: 0
            readonly property real duration: 680 + 11 * 70 + 300 + 60
            readonly property real elapsed: scene.now - t0
            readonly property real cw: stage.pw
            readonly property real cx: width / 2 - cw / 2
            readonly property real cy: height * 0.42 - cw * 0.7
            function ease(t) { t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 3); }
            // Two halves part, lean and riffle back together, twice.
            Repeater {
                model: 4
                Card {
                    required property int index
                    readonly property real pass: Math.max(0, Math.min(1, (dealer.elapsed % 340) / 340))
                    readonly property bool shuffling: dealer.elapsed < 680
                    readonly property real out: shuffling ? (pass < 0.45 ? dealer.ease(pass / 0.45) : 1 - dealer.ease((pass - 0.45) / 0.55)) : 0
                    readonly property real side: index % 2 ? 1 : -1
                    cardWidth: dealer.cw
                    x: dealer.cx + side * dealer.cw * 0.62 * out
                    y: dealer.cy - index * 1.5 - 4 * out
                    rotation: side * 7 * out
                    visible: dealer.elapsed < dealer.duration - 60
                }
            }
            // Then the deal, the pone first.
            Repeater {
                model: 12
                Card {
                    required property int index
                    readonly property real t: dealer.ease((dealer.elapsed - 680 - index * 70) / 300)
                    readonly property bool toYou: (index % 2 === 0) === (dealer.dealerSeat === 1)
                    readonly property real spread: (Math.floor(index / 2) - 2.5) * dealer.cw * 0.45
                    readonly property real tx: toYou ? dealer.width / 2 - dealer.cw / 2 : dealer.width - dealer.cw * 3.4
                    readonly property real ty: toYou ? dealer.height - dealer.cw * 1.6 : 12
                    cardWidth: dealer.cw
                    visible: dealer.elapsed >= 680 + index * 70
                    x: dealer.cx + (tx + spread - dealer.cx) * t
                    y: dealer.cy - 6 + (ty - dealer.cy + 6) * t
                    rotation: (Math.floor(index / 2) - 2.5) * 4 * t
                }
            }
        }

        // Rounded corners for the stage: the window's colour drawn into each.
        Canvas {
            anchors.fill: parent
            z: 4
            onWidthChanged: requestPaint()
            onHeightChanged: requestPaint()
            onPaint: {
                const g = getContext("2d"), r = 10, w = width, h = height;
                g.reset();
                g.fillStyle = theme.piano;
                g.beginPath();
                g.moveTo(0, 0); g.lineTo(r, 0); g.arcTo(0, 0, 0, r, r); g.closePath(); g.fill();
                g.beginPath();
                g.moveTo(w, 0); g.lineTo(w, r); g.arcTo(w, 0, w - r, 0, r); g.closePath(); g.fill();
                g.beginPath();
                g.moveTo(w, h); g.lineTo(w - r, h); g.arcTo(w, h, w, h - r, r); g.closePath(); g.fill();
                g.beginPath();
                g.moveTo(0, h); g.lineTo(0, h - r); g.arcTo(0, h, r, h, r); g.closePath(); g.fill();
            }
        }

        // ---- The menu.
        GameMenu {
            id: menu
            visible: root.menuOpen
            anchors.right: parent.right
            anchors.rightMargin: 12
            y: 12
            z: 5
            width: Math.min(380, stage.width - 24)
            height: Math.min(implicitHeight, stage.height - 24)
            clip: true
            length: saved.length
            level: saved.level
            place: saved.place
            pegStyle: saved.pegStyle
            fateOn: controller.fateOn
            onVisibleChanged: if (visible) forceActiveFocus()
            onClosed: root.menuOpen = false
            onStart: (length, level) => {
                saved.length = length;
                saved.level = level;
                controller.level = level;
                root.menuOpen = false;
                root.startMatch(length);
            }
            onPlaceChosen: (place) => saved.place = place
            onPegChosen: (style) => saved.pegStyle = style
            onFateToggled: (on) => { saved.fateOn = on; controller.setFateOn(on); }
        }
    }

    // ---- Words for the moment.
    readonly property string showTitle: !receipt ? ""
        : receipt.step === "crib" ? (receipt.player === 0 ? "Your crib" : "The computer's crib")
        : (receipt.player === 0 ? "Your hand" : "The computer's hand")
    readonly property string prompt: {
        if (rev < 0 || !g) return "";
        if (dealing) return "Shuffling and dealing";
        if (phase === "discard") return "Choose two cards for " + (g.dealer === 0 ? "your crib" : "the computer's crib");
        if (phase === "cut" && awaitingFate) return "Fate is full. Call on it, and the cut falls on the best card for your hand.";
        if (phase === "cut") return "Cutting for the starter";
        if (phase === "play") return controller.yourTurn ? (controller.youMustSayGo ? "Nothing fits under 31. Say go." : "Your turn. Lay a card.") : "The computer is thinking";
        if (phase === "show" && !receipt) return "Counting";
        if (phase === "show") return showTitle + " counts " + receipt.total;
        if (phase === "over" && running) return "Pegging out";
        if (phase === "over") return g.winner === 0 ? "You pegged out" : "The computer pegged out";
        return "";
    }
    readonly property string actText: {
        if (rev < 0 || !g || dealing) return "";
        if (phase === "discard") return "Lay two in the crib";
        if (phase === "cut") return awaitingFate ? "Call on Fate" : "";
        if (phase === "play") return controller.yourTurn && controller.youMustSayGo ? "Go" : "";
        if (phase === "show") return !receipt ? "" : receipt.step === "crib" ? "Deal the next hand" : g.showStep === 0 ? "Count the dealer's hand" : "Turn the crib";
        if (phase === "over") return running ? "" : controller.match.bestOf === 1 ? "Play again" : controller.matchOver ? "New match" : "Next game";
        return "";
    }
    readonly property bool actEnabled: !running && (phase !== "discard" || picked.length === 2)
    readonly property string note: phase === "discard" && picked.length === 2 && g
        ? "The four you keep: " + controller.keptWorth(g.hands[0], picked) + " in hand" : ""
    readonly property var bannerLines: {
        if (rev < 0 || !g || phase !== "over") return [];
        const m = controller.match, w = m.wins, other = g.scores[1 - g.winner];
        const done = m.bestOf > 1 && controller.matchOver;
        const lines = [done ? (w[0] > w[1] ? "Match won" : "Match lost")
            : g.winner === 0 ? "You won, 121 to " + other : "The computer won, 121 to " + other];
        if (done) lines.push((g.winner === 0 ? "You won the last game, 121 to " : "The computer won the last game, 121 to ") + other + ".");
        lines.push(g.skunk === 2 ? "A double skunk: under 61." + (m.bestOf > 1 ? " That counts as three games." : "")
            : g.skunk === 1 ? "A skunk: under 91." + (m.bestOf > 1 ? " That counts as two games." : "")
            : "Pegged out on the trail.");
        if (m.bestOf > 1) {
            const lead = Math.max(w[0], w[1]), trail = Math.min(w[0], w[1]);
            lines.push(done ? (w[0] > w[1] ? "You win the match, " : "The computer wins the match, ") + lead + " to " + trail + "."
                : w[0] === w[1] ? "The match is level at " + w[0] + " each."
                : (w[0] > w[1] ? "You lead the match " : "The computer leads the match ") + lead + " to " + trail + ". First to " + Match.needed(m) + ".");
        }
        return lines;
    }

    Keys.onEscapePressed: menuOpen = false

    Component.onCompleted: {
        controller.level = saved.level;
        controller.setFateOn(saved.fateOn);
        startMatch(saved.length);
    }
}
