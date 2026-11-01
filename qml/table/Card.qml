import QtQuick
import QtQuick.Shapes
import QtQuick.Effects

// A playing card, face up (`card` set) or face down (`card` null).
Item {
    id: root

    property var card: null
    property real cardWidth: 70
    property bool dim: false
    property bool raised: false      // lifted, ringed: part of a counted line
    property bool fated: false       // turned by Fate: a violet glow
    property color ring: "transparent"
    property bool interactive: false
    property bool enabled_: true
    signal clicked()

    readonly property bool red: !!card && (card.suit === "h" || card.suit === "d")
    readonly property var rankLabels: ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
    readonly property var suitNames: ({ s: "spades", h: "hearts", d: "diamonds", c: "clubs" })
    readonly property var suitPaths: ({
        h: "M12 21.2s-7.6-4.7-9.7-9.4C.8 8.3 3 4.8 6.5 4.8c2.2 0 3.7 1.3 4.6 2.8L12 9l.9-1.4c.9-1.5 2.4-2.8 4.6-2.8 3.5 0 5.7 3.5 4.2 7-2.1 4.7-9.7 9.4-9.7 9.4z",
        d: "M12 2.2 20.2 12 12 21.8 3.8 12z",
        s: "M12 2.2S2.8 9.2 2.8 14.2c0 2.8 2.2 4.6 4.6 4.6 1.7 0 3-.8 3.8-2L9.9 21.8h4.2l-1.3-5c.8 1.2 2.1 2 3.8 2 2.4 0 4.6-1.8 4.6-4.6C21.2 9.2 12 2.2 12 2.2z",
        c: "M12 2.4a4.3 4.3 0 0 0-3.8 6.3 4.3 4.3 0 1 0 2.6 7.6l-1.1 5.5h4.6l-1.1-5.5a4.3 4.3 0 1 0 2.6-7.6A4.3 4.3 0 0 0 12 2.4z"
    })

    width: cardWidth
    height: cardWidth * 1.41
    opacity: dim ? 0.38 : 1
    Behavior on opacity { NumberAnimation { duration: 160 } }

    Accessible.role: interactive ? Accessible.Button : Accessible.StaticText
    Accessible.name: card ? rankLabels[card.rank] + " of " + suitNames[card.suit] : "A card, face down"
    activeFocusOnTab: interactive && enabled_
    Keys.onReturnPressed: if (enabled_) clicked()
    Keys.onSpacePressed: if (enabled_) clicked()

    component Suit: Shape {
        property string suit: "s"
        property real size: 12
        width: size
        height: size
        preferredRendererType: Shape.CurveRenderer
        ShapePath {
            strokeWidth: -1
            fillColor: root.red ? "#C2402F" : "#141414"
            scale: Qt.size(size / 24, size / 24)
            PathSvg { path: root.suitPaths[suit] || "" }
        }
    }

    Rectangle {
        id: face
        anchors.fill: parent
        radius: 10
        color: root.card ? (hover.hovered && root.interactive && root.enabled_ ? "#ffffff" : "#F8F8FF") : "#242424"
        border.width: root.card ? 0 : 1
        border.color: "#333333"
        layer.enabled: true
        layer.effect: MultiEffect {
            shadowEnabled: true
            shadowColor: root.fated ? "#C49BFF" : "#000000"
            shadowOpacity: root.fated ? 0.9 : 0.45
            shadowBlur: root.fated ? 1 : 0.6
            shadowVerticalOffset: root.fated ? 0 : 6
            autoPaddingEnabled: true
        }

        // Face down: a quiet inner line and four pearls.
        Rectangle {
            visible: !root.card
            anchors.fill: parent
            anchors.margins: 4
            radius: 7
            color: "transparent"
            border.width: 1
            border.color: Qt.rgba(248 / 255, 248 / 255, 1, 0.14)
        }
        Row {
            visible: !root.card
            anchors.centerIn: parent
            spacing: root.width * 0.08
            Repeater {
                model: 4
                Rectangle { width: root.width * 0.09; height: width; radius: width / 2; color: Qt.rgba(248 / 255, 248 / 255, 1, 0.72) }
            }
        }

        // Face up: the index in the corner and one big pip.
        Column {
            visible: !!root.card
            x: root.width * 0.09
            y: root.height * 0.06
            spacing: 2
            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: root.card ? root.rankLabels[root.card.rank] : ""
                color: root.red ? "#C2402F" : "#141414"
                font.pixelSize: root.width * 0.24
                font.weight: Font.DemiBold
            }
            Suit {
                anchors.horizontalCenter: parent.horizontalCenter
                suit: root.card ? root.card.suit : "s"
                size: root.width * 0.15
            }
        }
        Suit {
            visible: !!root.card
            anchors.centerIn: parent
            anchors.verticalCenterOffset: root.height * 0.04
            suit: root.card ? root.card.suit : "s"
            size: root.width * 0.46
        }
    }
    // Rings: white for a counted card, the player's colour on the pile.
    Rectangle {
        anchors.fill: parent
        anchors.margins: root.raised ? -3 : -2
        radius: 12
        color: "transparent"
        border.width: root.raised ? 3 : root.fated ? 3 : 2
        border.color: root.raised ? "#F8F8FF" : root.fated ? "#C49BFF" : root.ring
        visible: root.raised || root.fated || root.ring.a > 0
    }
    Rectangle {
        visible: root.activeFocus
        anchors.fill: parent
        anchors.margins: -5
        radius: 14
        color: "transparent"
        border.width: 2
        border.color: "#F8F8FF"
    }

    HoverHandler { id: hover; enabled: root.interactive; cursorShape: root.enabled_ ? Qt.PointingHandCursor : Qt.ArrowCursor }
    TapHandler { enabled: root.interactive && root.enabled_; onTapped: root.clicked() }
}
