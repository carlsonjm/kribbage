import QtQuick
import org.kde.kirigami as Kirigami

// The window. Everything inside is the game screen (GameView.qml), built
// to the approved prototype in design/trail-prototype.html.
Kirigami.ApplicationWindow {
    id: window
    title: "Kribbage"
    width: 1440
    height: 820
    minimumWidth: 720
    minimumHeight: 560
    color: "#141414"

    GameView {
        anchors.fill: parent
        // Plasma's "animation speed" at its slowest turns flights and the deal off.
        reducedMotion: Kirigami.Units.longDuration <= 1
        focus: true
    }
}
