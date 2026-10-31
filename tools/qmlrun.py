import sys, time
from PySide6.QtCore import QCoreApplication, QUrl
from PySide6.QtQml import QQmlApplicationEngine
app = QCoreApplication(sys.argv)
e = QQmlApplicationEngine()
e.warnings.connect(lambda ws: [print("WARN", w.toString()) for w in ws])
t = time.time()
e.load(QUrl.fromLocalFile(sys.argv[1]))
if not e.rootObjects(): print("load failed"); sys.exit(1)
r = app.exec()
print("seconds", round(time.time() - t, 1))
sys.exit(r)
