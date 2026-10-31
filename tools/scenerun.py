# Runs a QML file that uses the 3D scene, with the Python MeshGeometry
# standing in for the C++ one, and saves a picture of the window.
#   xvfb-run -a python3 tools/scenerun.py tools/ScenePreview.qml out.png [ms]
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PySide6.QtCore import QUrl, QTimer
from PySide6.QtGui import QGuiApplication
from PySide6.QtQml import QQmlApplicationEngine
from PySide6.QtQuick import QQuickWindow  # noqa: F401  (grabWindow)
import meshgeometry

app = QGuiApplication(sys.argv)
app.setOrganizationName("Good Input")
app.setOrganizationDomain("goodinput.co")
app.setApplicationName("kribbage-preview")
meshgeometry.register()
engine = QQmlApplicationEngine()
engine.warnings.connect(lambda ws: [print("WARN", w.toString()) for w in ws])
engine.load(QUrl.fromLocalFile(os.path.abspath(sys.argv[1])))
if not engine.rootObjects():
    print("load failed")
    sys.exit(1)
window = engine.rootObjects()[0]
out = os.path.splitext(sys.argv[2])[0]

# A page can ask for pictures of its own: signal snap(string name).
if hasattr(window, "snap"):
    def snap(name):
        img = window.grabWindow()
        img.save(out + "-" + name + ".png")
        print("snap", name)
    window.snap.connect(snap)
if hasattr(window, "finished"):
    window.finished.connect(lambda: app.quit())


def shot():
    img = window.grabWindow()
    print("saved", img.save(sys.argv[2]), img.width(), img.height())
    app.quit()


if int(sys.argv[3] if len(sys.argv) > 3 else 4000) > 0:
    QTimer.singleShot(int(sys.argv[3]) if len(sys.argv) > 3 else 4000, shot)
sys.exit(app.exec())
