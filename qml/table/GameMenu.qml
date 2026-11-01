import QtQuick
import "../../board/scene.mjs" as Scene

// The menu: what a new game will be, where the trail runs, which pegs,
// and the Fate switch.
Rectangle {
    id: menu

    property int length: 1
    property string level: "steady"
    property string place: "forest"
    property string pegStyle: "brass"
    property bool fateOn: true
    signal start(int length, string level)
    signal placeChosen(string place)
    signal pegChosen(string style)
    signal fateToggled(bool on)
    signal closed()

    color: Qt.rgba(20 / 255, 20 / 255, 20 / 255, 0.92)
    radius: 12
    implicitHeight: body.implicitHeight + 24
    Accessible.role: Accessible.Dialog
    Accessible.name: "Menu"
    Keys.onEscapePressed: closed()

    // Taps on the menu stay on the menu.
    MouseArea { anchors.fill: parent }

    component Heading: Text {
        topPadding: 14
        bottomPadding: 8
        color: Qt.rgba(248 / 255, 248 / 255, 1, 0.66)
        font.pixelSize: 12
        font.weight: Font.DemiBold
        font.capitalization: Font.AllUppercase
        font.letterSpacing: 0.7
    }
    component Option: PillButton {
        pillHeight: 36
        fontSize: 13
    }
    component Divider: Rectangle { width: parent.width; height: 1; color: Qt.rgba(248 / 255, 248 / 255, 1, 0.14) }

    Column {
        id: body
        x: 16
        y: 8
        width: parent.width - 32
        spacing: 0

        Heading { text: "New game" }
        Flow {
            width: parent.width
            spacing: 6
            Repeater {
                model: [[1, "Single"], [3, "Best of 3"], [5, "Best of 5"], [7, "Best of 7"]]
                Option {
                    required property var modelData
                    text: modelData[1]
                    pressedOn: menu.length === modelData[0]
                    onClicked: menu.length = modelData[0]
                }
            }
        }
        Item { width: 1; height: 10 }
        Flow {
            width: parent.width
            spacing: 6
            Repeater {
                model: [["easy", "Easy"], ["steady", "Steady"], ["sharp", "Sharp"]]
                Option {
                    required property var modelData
                    text: modelData[1]
                    pressedOn: menu.level === modelData[0]
                    onClicked: menu.level = modelData[0]
                }
            }
        }
        Item { width: 1; height: 10 }
        PillButton {
            width: parent.width
            primary: true
            text: "Start"
            onClicked: menu.start(menu.length, menu.level)
        }
        Item { width: 1; height: 16 }
        Divider {}

        Heading { text: "Trail" }
        Flow {
            width: parent.width
            spacing: 6
            Repeater {
                model: [["forest", "Forest"], ["autumn", "Autumn"], ["winter", "Winter"]]
                Option {
                    required property var modelData
                    text: modelData[1]
                    pressedOn: menu.place === modelData[0]
                    onClicked: menu.placeChosen(modelData[0])
                }
            }
        }
        Heading { text: "Pegs" }
        Flow {
            width: parent.width
            spacing: 6
            Repeater {
                model: Scene.PEG_STYLES
                Option {
                    required property string modelData
                    text: Scene.PEG_NAMES[modelData]
                    pressedOn: menu.pegStyle === modelData
                    onClicked: menu.pegChosen(modelData)
                }
            }
        }
        Item { width: 1; height: 16 }
        Divider {}

        Item {
            width: parent.width
            height: Math.max(fateText.implicitHeight, 28) + 16
            Column {
                id: fateText
                y: 14
                width: parent.width - 58
                Text { text: "Fate meter"; color: "#F8F8FF"; font.pixelSize: 14 }
                Text {
                    width: parent.width
                    wrapMode: Text.WordWrap
                    text: "Fills on bad luck. Call on it at the cut for the best card."
                    color: Qt.rgba(248 / 255, 248 / 255, 1, 0.66)
                    font.pixelSize: 12
                }
            }
            Rectangle {
                id: toggle
                anchors.right: parent.right
                y: 14
                width: 46
                height: 28
                radius: 14
                color: menu.fateOn ? "#C49BFF" : "#3a3a3a"
                Accessible.role: Accessible.CheckBox
                Accessible.name: "Fate meter"
                Accessible.checked: menu.fateOn
                activeFocusOnTab: true
                Keys.onSpacePressed: menu.fateToggled(!menu.fateOn)
                Keys.onReturnPressed: menu.fateToggled(!menu.fateOn)
                Rectangle {
                    x: menu.fateOn ? 21 : 3
                    y: 3
                    width: 22
                    height: 22
                    radius: 11
                    color: "#F8F8FF"
                    Behavior on x { NumberAnimation { duration: 160; easing.type: Easing.OutCubic } }
                }
                Rectangle {
                    visible: toggle.activeFocus
                    anchors.fill: parent; anchors.margins: -4; radius: 18
                    color: "transparent"; border.width: 2; border.color: "#F8F8FF"
                }
                TapHandler { onTapped: menu.fateToggled(!menu.fateOn) }
            }
        }
    }
}
