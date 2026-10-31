import QtQuick
import "../../board/trail.mjs" as Trail

// The map in the corner: the whole trail, the skunk lines, both pegs, and
// a viewfinder round what the camera frames. Tap a peg to fly to it, or
// anywhere on the trail to look there.
Item {
    id: map

    property var scene                 // the TrailScene
    property var fronts: [0, 0]        // front holes shown
    signal look(var point)

    // The board's own frame, as the prototype's map drew it.
    readonly property rect box: Qt.rect(400, 400, 1800, 2000)
    readonly property real k: width / box.width
    function toMap(x, y) { return Qt.point((x - box.x) * k, (y - box.y) * k); }

    implicitWidth: 120
    implicitHeight: 120 * box.height / box.width

    Accessible.role: Accessible.Grouping
    Accessible.name: "Map of the trail. Choose a peg to look at it."

    Canvas {
        id: trail
        anchors.fill: parent
        onWidthChanged: requestPaint()
        onPaint: {
            const g = getContext("2d");
            g.reset();
            g.scale(map.k, map.k);
            g.translate(-map.box.x, -map.box.y);
            g.beginPath();
            for (let i = 0; i < Trail.samples.length; i += 4) {
                const p = Trail.samples[i];
                if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]);
            }
            g.lineWidth = 40; g.lineCap = "round"; g.lineJoin = "round";
            g.strokeStyle = Qt.rgba(248 / 255, 248 / 255, 1, 0.35);
            g.stroke();
            // Skunk ticks: black with a white middle.
            const tick = function (hole, w) {
                const p = Trail.along(Trail.skunkS(hole));
                g.beginPath();
                g.moveTo(p.x - p.nx * 70, p.y - p.ny * 70);
                g.lineTo(p.x + p.nx * 70, p.y + p.ny * 70);
                g.lineCap = "butt";
                g.lineWidth = w; g.strokeStyle = "#141414"; g.stroke();
                g.lineWidth = 10; g.strokeStyle = "#F8F8FF"; g.stroke();
            };
            tick(60, 44);
            tick(90, 36);
        }
    }

    // Four corner marks round what the camera frames.
    Canvas {
        id: finder
        anchors.fill: parent
        readonly property var cam: map.scene ? [map.scene.camX, map.scene.camY, map.scene.lift] : [0, 0, 0]
        onCamChanged: requestPaint()
        onPaint: {
            const g = getContext("2d");
            g.reset();
            g.scale(map.k, map.k);
            g.translate(-map.box.x, -map.box.y);
            const s = 1 + cam[2] * 1.7, w = 300 * s, h = 190 * s, l = 70;
            const ahead = map.scene ? map.scene.ahead : 150;
            const x0 = cam[0] - w, x1 = cam[0] + w, y0 = cam[1] + ahead - h, y1 = cam[1] + ahead + h;
            g.beginPath();
            g.moveTo(x0, y0 + l); g.lineTo(x0, y0); g.lineTo(x0 + l, y0);
            g.moveTo(x1 - l, y0); g.lineTo(x1, y0); g.lineTo(x1, y0 + l);
            g.moveTo(x1, y1 - l); g.lineTo(x1, y1); g.lineTo(x1 - l, y1);
            g.moveTo(x0 + l, y1); g.lineTo(x0, y1); g.lineTo(x0, y1 - l);
            g.lineWidth = 14; g.lineCap = "round";
            g.strokeStyle = Qt.rgba(248 / 255, 248 / 255, 1, 0.7);
            g.stroke();
        }
    }

    Repeater {
        model: [1, 0]
        delegate: Rectangle {
            id: dot
            required property int modelData
            readonly property var at: Trail.holeAt(modelData, map.fronts[modelData])
            readonly property point p: map.toMap(at.x, at.y)
            width: 120 * map.k
            height: width
            radius: width / 2
            x: p.x - width / 2
            y: p.y - height / 2
            color: modelData === 0 ? "#C8241C" : "#1F5BC8"
            border.width: activeFocus ? 24 * map.k : 0
            border.color: "#F8F8FF"
            activeFocusOnTab: true
            Accessible.role: Accessible.Button
            Accessible.name: modelData === 0 ? "Look at your peg" : "Look at the computer's peg"
            Keys.onReturnPressed: map.look(at)
            Keys.onSpacePressed: map.look(at)
        }
    }

    // A tap near a peg looks at it; elsewhere, at the nearest point of the trail.
    TapHandler {
        onTapped: (point) => {
            const x = point.position.x / map.k + map.box.x, y = point.position.y / map.k + map.box.y;
            for (const player of [0, 1]) {
                const h = Trail.holeAt(player, map.fronts[player]);
                if (Math.hypot(h.x - x, h.y - y) < 160) { map.look(h); return; }
            }
            const near = Trail.nearestOnTrail(x, y);
            if (near.distance < 260) map.look(near);
        }
    }
    HoverHandler { cursorShape: Qt.PointingHandCursor }
}
