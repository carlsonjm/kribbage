# The same MeshGeometry as src/meshgeometry.cpp, in Python, so the scene can
# be run and photographed with PySide6 where the C++ app cannot be built.
# Keep the two in step.
import struct
from PySide6.QtCore import Property, Signal, QByteArray
from PySide6.QtGui import QVector3D
from PySide6.QtQml import qmlRegisterType
from PySide6.QtQuick3D import QQuick3DGeometry

FLOATS = 12
STRIDE = FLOATS * 4


class MeshGeometry(QQuick3DGeometry):
    verticesChanged = Signal()
    indicesChanged = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._vertices = QByteArray()
        self._indices = QByteArray()

    def _get_vertices(self):
        return self._vertices

    def _set_vertices(self, data):
        self._vertices = QByteArray(data)
        self._rebuild()
        self.verticesChanged.emit()

    def _get_indices(self):
        return self._indices

    def _set_indices(self, data):
        self._indices = QByteArray(data)
        self._rebuild()
        self.indicesChanged.emit()

    vertices = Property(QByteArray, _get_vertices, _set_vertices, notify=verticesChanged)
    indices = Property(QByteArray, _get_indices, _set_indices, notify=indicesChanged)

    def _rebuild(self):
        A = QQuick3DGeometry.Attribute
        self.clear()
        self.setStride(STRIDE)
        self.setPrimitiveType(QQuick3DGeometry.PrimitiveType.Triangles)
        self.addAttribute(A.Semantic.PositionSemantic, 0, A.ComponentType.F32Type)
        self.addAttribute(A.Semantic.NormalSemantic, 12, A.ComponentType.F32Type)
        self.addAttribute(A.Semantic.TexCoord0Semantic, 24, A.ComponentType.F32Type)
        self.addAttribute(A.Semantic.ColorSemantic, 32, A.ComponentType.F32Type)
        self.setVertexData(self._vertices)
        if self._indices.size():
            self.addAttribute(A.Semantic.IndexSemantic, 0, A.ComponentType.U32Type)
            self.setIndexData(self._indices)
        raw = bytes(self._vertices.data())
        n = len(raw) // STRIDE
        if n:
            import array
            a = array.array('f')
            a.frombytes(raw[:n * STRIDE])
            xs, ys, zs = a[0::FLOATS], a[1::FLOATS], a[2::FLOATS]
            self.setBounds(QVector3D(min(xs), min(ys), min(zs)), QVector3D(max(xs), max(ys), max(zs)))
        self.update()


def register():
    qmlRegisterType(MeshGeometry, 'co.goodinput.Kribbage.Mesh', 1, 0, 'MeshGeometry')
