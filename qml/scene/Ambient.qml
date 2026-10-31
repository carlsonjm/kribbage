import QtQuick
import QtQuick3D
import co.goodinput.Kribbage.Mesh
import "../../board/trail.mjs" as Trail
import "../../board/scene.mjs" as Scene

// Life along the trail, about one thing every 40 holes: a campfire, a
// critter (a fox in the woods and the leaves, a hare in the snow) and a
// few birds wheeling overhead.
Node {
    id: life

    property string place: "forest"
    property real now: 0
    property bool still: false
    readonly property var spots: Trail.ambientSpots()
    readonly property var birdMesh: Scene.birdParts()
    readonly property real t: still ? 0 : now

    // ---- The campfire.
    Node {
        id: fire
        readonly property var at: life.spots[0]
        position: Qt.vector3d(at.x, Trail.heightAt(life.place, at.x, at.y), at.y)
        scale: Qt.vector3d(1.5, 1.5, 1.5)
        Model {
            castsShadows: true; receivesShadows: true
            geometry: MeshGeometry { vertices: Scene.campfireParts(life.place === "winter" ? "#7c8592" : "#6d6a62").vertices.buffer }
            materials: PrincipledMaterial { vertexColorsEnabled: true; roughness: 0.85 }
        }
        Repeater3D {
            model: [["#ffb347", 6, 20, 0, 0], ["#ff7a2a", 4.5, 15, 3, 2], ["#ffd27a", 3.5, 12, -3, -2]]
            delegate: Model {
                required property var modelData
                required property int index
                readonly property real k: 1 + 0.18 * Math.sin(life.t / (70 + index * 23) + index) + 0.08 * Math.sin(life.t / 37 + index * 3)
                position: Qt.vector3d(modelData[3], 8, modelData[4])
                scale: Qt.vector3d(modelData[1], modelData[2] * k, modelData[1])
                geometry: MeshGeometry { vertices: life.birdMesh.flame.vertices.buffer }
                materials: PrincipledMaterial {
                    baseColor: modelData[0]
                    emissiveFactor: Qt.vector3d(1.0, 0.55, 0.2).times(0.7)
                    roughness: 1; opacity: 0.92; alphaMode: PrincipledMaterial.Blend
                }
            }
        }
        PointLight {
            y: 44
            color: "#ff9a4a"
            brightness: 0.85 + 0.2 * Math.sin(life.t / 83) + 0.1 * Math.sin(life.t / 41)
            quadraticFade: 1.2
            castsShadow: false
        }
        Repeater3D {
            model: 6
            delegate: Model {
                required property int index
                readonly property real p: ((life.t / 4200) + index / 6) % 1
                position: Qt.vector3d(Math.sin(p * 5 + index) * 6 + p * 18, 28 + p * 120, Math.cos(p * 4 + index) * 5)
                scale: Qt.vector3d(1, 1, 1).times(0.6 + p * 2.2)
                geometry: MeshGeometry { vertices: life.birdMesh.puff.vertices.buffer }
                materials: PrincipledMaterial {
                    baseColor: "#c8c8c8"; roughness: 1
                    opacity: 0.32 * (1 - parent.p); alphaMode: PrincipledMaterial.Blend
                    depthDrawMode: Material.NeverDepthDraw
                }
            }
        }
    }

    // ---- The critter: mostly still, an ear on the trail; every few seconds
    // a hop and a look round.
    Node {
        id: critter
        readonly property var at: life.spots[1]
        readonly property bool fox: life.place !== "winter"
        readonly property var parts: Scene.critterParts(fox, fox ? "#c0652b" : "#e4e7ec", fox ? "#f2e8dc" : "#f7f8fa")
        readonly property real facing: Trail.rng(life.place.length * 17 + 3)()
        readonly property real cyc: (life.t / 1000) % 7
        readonly property real hop: cyc > 5.2 && cyc < 5.8 ? Math.sin((cyc - 5.2) / 0.6 * Math.PI) : 0
        position: Qt.vector3d(at.x, Trail.heightAt(life.place, at.x, at.y), at.y)
        eulerRotation.y: (facing * Math.PI * 2 + Math.floor(life.t / 7000) * 1.7) * 180 / Math.PI
        Node {
            y: critter.hop * (critter.fox ? 6 : 10)
            Model {
                castsShadows: true
                geometry: MeshGeometry { vertices: critter.parts.body.vertices.buffer }
                materials: PrincipledMaterial { vertexColorsEnabled: true; roughness: 0.85 }
            }
            Model {
                castsShadows: true
                position: Qt.vector3d(critter.parts.headAt[0], critter.parts.headAt[1], critter.parts.headAt[2])
                eulerRotation.y: Math.sin(life.t / 1700) * 0.7 * (critter.cyc < 5 ? 1 : 0.2) * 180 / Math.PI
                eulerRotation.x: (critter.cyc > 2 && critter.cyc < 3.2 ? 0.35 * Math.sin((critter.cyc - 2) / 1.2 * Math.PI) : 0) * 180 / Math.PI
                geometry: MeshGeometry { vertices: critter.parts.head.vertices.buffer }
                materials: PrincipledMaterial { vertexColorsEnabled: true; roughness: 0.85 }
            }
        }
    }

    // ---- Birds, wheeling over the third spot.
    Node {
        id: flock
        readonly property var at: life.spots[2]
        readonly property real ground: Trail.heightAt(life.place, at.x, at.y)
        Repeater3D {
            model: 4
            delegate: Node {
                required property int index
                readonly property real r: 70 + index * 22
                readonly property real h: 150 + index * 14
                readonly property real ph: index * 1.6
                readonly property real a: life.t * (0.00042 + index * 0.00005) + ph
                readonly property real flap: Math.sin(life.t / 110 + ph * 3) * 0.7 * (Math.sin(life.t / 2300 + ph) > -0.3 ? 1 : 0.15)
                position: Qt.vector3d(flock.at.x + Math.cos(a) * r, flock.ground + h + Math.sin(life.t / 900 + ph) * 8, flock.at.y + Math.sin(a) * r * 0.7)
                eulerRotation.y: -a * 180 / Math.PI
                Model {
                    castsShadows: true
                    geometry: MeshGeometry { vertices: life.birdMesh.body.vertices.buffer }
                    materials: PrincipledMaterial { vertexColorsEnabled: true; roughness: 0.8 }
                }
                Model {
                    castsShadows: true
                    eulerRotation.z: parent.flap * 180 / Math.PI
                    geometry: MeshGeometry { vertices: life.birdMesh.wing.vertices.buffer }
                    materials: PrincipledMaterial { vertexColorsEnabled: true; roughness: 0.8; cullMode: Material.NoCulling }
                }
                Model {
                    castsShadows: true
                    scale.x: -1
                    eulerRotation.z: -parent.flap * 180 / Math.PI
                    geometry: MeshGeometry { vertices: life.birdMesh.wing.vertices.buffer }
                    materials: PrincipledMaterial { vertexColorsEnabled: true; roughness: 0.8; cullMode: Material.NoCulling }
                }
            }
        }
    }
}
