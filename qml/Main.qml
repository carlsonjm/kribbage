import QtQuick
import org.kde.kirigami as Kirigami

// The window. The table's screens are drawn from the approved mock-up
// (https://claude.ai/artifact/W1EisEZkPSER1EiHdarwEA) once the owner signs
// off on the look; until then this only proves the app starts.
Kirigami.ApplicationWindow {
    id: window
    title: "Kribbage"
    width: 1440
    height: 820
    minimumWidth: 720
    minimumHeight: 520

    GameController {
        id: controller
        Component.onCompleted: newGame()
    }
}
