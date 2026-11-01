#pragma once

#include <QByteArray>
#include <QQuick3DGeometry>
#include <QtQml/qqmlregistration.h>

// A mesh built in JavaScript (board/meshes.mjs) and handed over as raw
// bytes, so a whole stand of trees or the rolling ground reaches the GPU
// without making a Qt object per vertex. Each vertex is 12 floats:
// position, normal, texture coordinate, colour. Indices are optional
// 32-bit triangles.
class MeshGeometry : public QQuick3DGeometry
{
    Q_OBJECT
    QML_ELEMENT
    Q_PROPERTY(QByteArray vertices READ vertices WRITE setVertices NOTIFY verticesChanged)
    Q_PROPERTY(QByteArray indices READ indices WRITE setIndices NOTIFY indicesChanged)

public:
    explicit MeshGeometry(QQuick3DObject *parent = nullptr);

    QByteArray vertices() const { return m_vertices; }
    void setVertices(const QByteArray &vertices);
    QByteArray indices() const { return m_indices; }
    void setIndices(const QByteArray &indices);

Q_SIGNALS:
    void verticesChanged();
    void indicesChanged();

private:
    void rebuild();

    QByteArray m_vertices;
    QByteArray m_indices;
};
