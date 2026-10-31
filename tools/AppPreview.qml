import QtQuick
import "../qml"

// The game screen without the Kirigami window, for pictures and checks
// with PySide6 (tools/scenerun.py). Window size: --size=WxH.
Window {
    id: window
    function option(name, fallback) {
        const args = Qt.application.arguments;
        for (let i = 0; i < args.length; i++) {
            if (args[i] === "--" + name) return "1";
            if (args[i].indexOf("--" + name + "=") === 0) return args[i].slice(name.length + 3);
        }
        return fallback;
    }
    width: Number(option("size", "1440x820").split("x")[0])
    height: Number(option("size", "1440x820").split("x")[1])
    visible: true
    color: "#141414"
    GameView {
        anchors.fill: parent
        // --menu opens the menu; --place and --peg choose the look.
        Component.onCompleted: {
            settings.place = window.option("place", "forest");
            settings.pegStyle = window.option("peg", "brass");
            if (window.option("menu", "") !== "") menuOpen = true;
        }
    }
}
