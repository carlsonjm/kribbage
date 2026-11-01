import QtQuick

// The table's buttons: a pill, raised grey, or Ghost white when primary.
Rectangle {
    id: root

    property string text: ""
    property bool primary: false
    property bool pressedOn: false     // a chosen option in a group
    property bool glowing: false       // Fate's call: violet, glowing
    property real pillHeight: 40
    property real fontSize: 14
    signal clicked()

    implicitWidth: Math.max(pillHeight, label.implicitWidth + (pillHeight >= 48 ? 48 : 32))
    implicitHeight: pillHeight
    radius: height / 2
    opacity: enabled ? 1 : 0.45
    color: glowing ? "#C49BFF"
        : primary ? (hover.hovered ? "#e4e4ee" : "#F8F8FF")
        : pressedOn ? Qt.rgba(248 / 255, 248 / 255, 1, 0.24)
        : hover.hovered ? "#333333" : "#242424"
    Behavior on color { ColorAnimation { duration: 140 } }

    Accessible.role: Accessible.Button
    Accessible.name: text
    Accessible.checkable: pressedOn
    activeFocusOnTab: enabled
    Keys.onReturnPressed: clicked()
    Keys.onSpacePressed: clicked()

    Rectangle {
        visible: root.glowing
        anchors.fill: parent
        anchors.margins: -6
        radius: height / 2
        color: "transparent"
        border.width: 6
        border.color: Qt.rgba(196 / 255, 155 / 255, 1, 0.35)
    }
    Text {
        id: label
        anchors.centerIn: parent
        text: root.text
        color: root.primary || root.glowing ? "#141414" : "#F8F8FF"
        font.pixelSize: root.fontSize
        font.weight: root.primary ? Font.DemiBold : Font.Normal
    }
    Rectangle {
        visible: root.activeFocus
        anchors.fill: parent
        anchors.margins: -4
        radius: height / 2
        color: "transparent"
        border.width: 2
        border.color: "#F8F8FF"
    }
    HoverHandler { id: hover; cursorShape: Qt.PointingHandCursor }
    TapHandler { onTapped: root.clicked() }
}
