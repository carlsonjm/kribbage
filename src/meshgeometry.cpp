#include "meshgeometry.h"

#include <QVector3D>
#include <cfloat>

namespace {
constexpr int Floats = 12;
constexpr int Stride = Floats * sizeof(float);
}

MeshGeometry::MeshGeometry(QQuick3DObject *parent)
    : QQuick3DGeometry(parent)
{
}

void MeshGeometry::setVertices(const QByteArray &vertices)
{
    m_vertices = vertices;
    rebuild();
    Q_EMIT verticesChanged();
}

void MeshGeometry::setIndices(const QByteArray &indices)
{
    m_indices = indices;
    rebuild();
    Q_EMIT indicesChanged();
}

void MeshGeometry::rebuild()
{
    clear();
    setStride(Stride);
    setPrimitiveType(PrimitiveType::Triangles);
    addAttribute(Attribute::PositionSemantic, 0, Attribute::F32Type);
    addAttribute(Attribute::NormalSemantic, 3 * sizeof(float), Attribute::F32Type);
    addAttribute(Attribute::TexCoord0Semantic, 6 * sizeof(float), Attribute::F32Type);
    addAttribute(Attribute::ColorSemantic, 8 * sizeof(float), Attribute::F32Type);
    setVertexData(m_vertices);
    if (!m_indices.isEmpty()) {
        addAttribute(Attribute::IndexSemantic, 0, Attribute::U32Type);
        setIndexData(m_indices);
    }

    // Bounds, so the scene can cull what the camera cannot see.
    const auto *f = reinterpret_cast<const float *>(m_vertices.constData());
    const qsizetype count = m_vertices.size() / Stride;
    QVector3D lo(FLT_MAX, FLT_MAX, FLT_MAX), hi(-FLT_MAX, -FLT_MAX, -FLT_MAX);
    for (qsizetype i = 0; i < count; ++i) {
        const QVector3D p(f[i * Floats], f[i * Floats + 1], f[i * Floats + 2]);
        lo = QVector3D(qMin(lo.x(), p.x()), qMin(lo.y(), p.y()), qMin(lo.z(), p.z()));
        hi = QVector3D(qMax(hi.x(), p.x()), qMax(hi.y(), p.y()), qMax(hi.z(), p.z()));
    }
    if (count > 0)
        setBounds(lo, hi);
    update();
}
